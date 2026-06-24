import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Loader2, CheckCircle, XCircle, Play, Download, UserPlus,
  Settings, RefreshCw, ChevronDown, AlertTriangle,
} from "lucide-react";
import {
  SHOT_PACK, ShotDef, buildPuLIDWorkflow, buildShotPrompt,
  comfyHealth, comfyUploadImage, comfySubmitPrompt, comfyPollResult, comfyFetchOutput,
  WorkflowConfig,
} from "../lib/comfyWorkflow";
import { addAthlete } from "../lib/store";
import type { Athlete } from "../../data/athletes";

// ── Types ─────────────────────────────────────────────────────────────────────

type ShotStatus = "idle" | "uploading" | "generating" | "done" | "failed";

interface ShotResult {
  status: ShotStatus;
  dataUrl?: string;
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SPORT_OPTIONS = [
  "Athletics", "Swimming", "Football", "Basketball", "Tennis",
  "Cycling", "Boxing", "Rugby", "Golf", "Gymnastics", "Generic",
];

const ENV_OPTIONS = [
  "Clean white studio", "Dark dramatic studio", "Outdoor natural light",
  "Urban gritty", "Stadium atmosphere", "Training facility",
];

function StatusDot({ online }: { online: boolean | null }) {
  if (online === null) return <span className="size-2 rounded-full bg-border inline-block" />;
  return online
    ? <span className="size-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
    : <span className="size-2 rounded-full bg-red-400 inline-block" />;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function IdentityStudio() {
  // ComfyUI status
  const [comfyOnline, setComfyOnline] = useState<boolean | null>(null);

  // Master portrait
  const [masterDataUrl,     setMasterDataUrl]     = useState<string | null>(null);
  const [masterFilename,    setMasterFilename]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Shot selection
  const [selectedShots, setSelectedShots] = useState<Set<string>>(
    new Set(["front", "left", "right", "three_q", "full_body"])
  );

  // Config
  const [subjectName,  setSubjectName]  = useState("");
  const [sport,        setSport]        = useState("Athletics");
  const [environment,  setEnvironment]  = useState("Clean white studio");
  const [pulidWeight,  setPulidWeight]  = useState(0.85);
  const [steps,        setSteps]        = useState(20);
  const [cfg,          setCfg]          = useState(3.5);
  const [randomSeed,   setRandomSeed]   = useState(true);
  const [seed,         setSeed]         = useState(42);
  const [fluxModel,    setFluxModel]    = useState("flux1-dev.safetensors");
  const [clipL,        setClipL]        = useState("clip_l.safetensors");
  const [t5xxl,        setT5xxl]        = useState("t5xxl_fp8_e4m3fn.safetensors");
  const [vaeModel,     setVaeModel]     = useState("ae.safetensors");
  const [pulidModel,   setPulidModel]   = useState("pulid_flux_v0.9.1.safetensors");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Generation state
  const [generating,   setGenerating]   = useState(false);
  const [results,      setResults]      = useState<Record<string, ShotResult>>({});
  const [currentShot,  setCurrentShot]  = useState<string | null>(null);

  // Import state
  const [importing,    setImporting]    = useState(false);
  const [imported,     setImported]     = useState(false);

  // Check ComfyUI on mount
  useEffect(() => {
    comfyHealth().then(ok => setComfyOnline(ok));
  }, []);

  const pingComfy = () => {
    setComfyOnline(null);
    comfyHealth().then(ok => setComfyOnline(ok));
  };

  const handleMasterUpload = (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => setMasterDataUrl(e.target!.result as string);
    reader.readAsDataURL(file);
    setMasterFilename(null); // reset so it re-uploads
    setResults({});
    setImported(false);
  };

  const toggleShot = (id: string) =>
    setSelectedShots(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const updateResult = useCallback((shotId: string, patch: Partial<ShotResult>) => {
    setResults(r => ({ ...r, [shotId]: { ...r[shotId], ...patch } }));
  }, []);

  const runGeneration = async () => {
    if (!masterDataUrl || generating) return;
    setGenerating(true);
    setImported(false);

    // Upload master portrait to ComfyUI (once for the whole pack)
    let uploadedFilename = masterFilename;
    if (!uploadedFilename) {
      setCurrentShot("__upload__");
      uploadedFilename = await comfyUploadImage(masterDataUrl);
      if (!uploadedFilename) {
        setGenerating(false);
        setCurrentShot(null);
        return;
      }
      setMasterFilename(uploadedFilename);
    }

    const shotsToRun = SHOT_PACK.filter(s => selectedShots.has(s.id));

    for (const shot of shotsToRun) {
      setCurrentShot(shot.id);
      updateResult(shot.id, { status: "generating" });

      try {
        const positivePrompt = buildShotPrompt(shot, {
          sport:       sport.toLowerCase(),
          environment: environment.toLowerCase(),
        });

        const wfCfg: WorkflowConfig = {
          masterFilename: uploadedFilename,
          positivePrompt,
          fluxModel, clipL, t5xxl, vaeModel, pulidModel,
          weight:  pulidWeight,
          steps,   cfg,
          seed:    randomSeed ? Math.floor(Math.random() * 999999) : seed,
          width:   shot.aspectRatio.w,
          height:  shot.aspectRatio.h,
        };

        const workflow  = buildPuLIDWorkflow(wfCfg);
        const promptId  = await comfySubmitPrompt(workflow);
        if (!promptId) throw new Error("Failed to submit workflow");

        const outputFilename = await comfyPollResult(promptId, 180_000);
        if (!outputFilename) throw new Error("Generation timed out");

        const dataUrl = await comfyFetchOutput(outputFilename);
        if (!dataUrl) throw new Error("Failed to fetch output");

        updateResult(shot.id, { status: "done", dataUrl });
      } catch (e: unknown) {
        updateResult(shot.id, { status: "failed", error: e instanceof Error ? e.message : "Failed" });
      }
    }

    setCurrentShot(null);
    setGenerating(false);
  };

  const doneResults = Object.entries(results).filter(([, r]) => r.status === "done" && r.dataUrl);

  const handleDownloadZip = async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    for (const [shotId, result] of doneResults) {
      if (!result.dataUrl) continue;
      const shot = SHOT_PACK.find(s => s.id === shotId);
      const label = shot?.label.toLowerCase().replace(/\s+/g, "_") ?? shotId;
      const [, b64] = result.dataUrl.split(",");
      zip.file(`${subjectName || "athlete"}_${label}.jpg`, b64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${subjectName || "identity_pack"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportAthlete = () => {
    if (doneResults.length === 0 || !subjectName.trim()) return;
    setImporting(true);
    const frontResult = results["front"] ?? doneResults[0]?.[1];
    const now = new Date().toISOString();
    const athlete: Athlete = {
      id:        `synthetic-${crypto.randomUUID().slice(0, 8)}`,
      name:      subjectName.trim(),
      sport:     sport,
      imageUrl:  frontResult?.dataUrl ?? "",
      createdAt: now,
      updatedAt: now,
    } as unknown as Athlete;
    addAthlete(athlete);
    setImporting(false);
    setImported(true);
  };

  const completedCount = Object.values(results).filter(r => r.status === "done").length;
  const totalSelected  = selectedShots.size;
  const canGenerate    = !!masterDataUrl && totalSelected > 0 && !!comfyOnline;

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-background">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/20">
                Internal · Admin
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Synthetic athlete packs with PuLID + FLUX — consistent identity across angles and contexts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot online={comfyOnline} />
            <span className="text-xs text-muted-foreground">
              ComfyUI: {comfyOnline === null ? "checking…" : comfyOnline ? "connected" : "offline"}
            </span>
            <button onClick={pingComfy} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {!comfyOnline && comfyOnline !== null && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-sm text-amber-300">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" strokeWidth={1.75} />
            <div className="space-y-1">
              <p className="font-medium">ComfyUI not reachable</p>
              <p className="text-xs text-amber-300/70">
                Install ComfyUI with PuLID Flux nodes, FLUX Dev model, and EVA-CLIP. Start with{" "}
                <code className="bg-amber-500/10 px-1 rounded">python main.py --listen 127.0.0.1 --port 8188</code>
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[1fr_320px] gap-6">

          {/* ── Left column ── */}
          <div className="space-y-5">

            {/* Step 1: Master portrait */}
            <Section label="1 · Master Portrait" description="Upload the reference face. Clean frontal shot works best — good lighting, neutral expression.">
              {masterDataUrl ? (
                <div className="flex items-start gap-4">
                  <div className="relative size-28 rounded-xl overflow-hidden border border-border shrink-0">
                    <img src={masterDataUrl} alt="Master" className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setMasterDataUrl(null); setMasterFilename(null); setResults({}); }}
                      className="absolute top-1 right-1 size-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black/90"
                    >
                      <XCircle className="size-3" strokeWidth={2} />
                    </button>
                  </div>
                  <div className="flex-1 space-y-2 pt-1">
                    <p className="text-sm text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="size-3.5" strokeWidth={2} /> Master portrait ready
                    </p>
                    {masterFilename && (
                      <p className="text-xs text-muted-foreground/50 font-mono">{masterFilename}</p>
                    )}
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Replace →
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-36 rounded-xl border-2 border-dashed border-border hover:border-accent/40 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Upload className="size-6" strokeWidth={1.5} />
                  <div className="text-center">
                    <p className="text-sm font-medium">Upload master portrait</p>
                    <p className="text-xs opacity-60">PNG, JPG, WebP</p>
                  </div>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleMasterUpload(e.target.files)} />
            </Section>

            {/* Step 2: Shot pack */}
            <Section label="2 · Shot Pack" description="Select which shots to generate for this identity.">
              <div className="grid grid-cols-4 gap-2">
                {SHOT_PACK.map(shot => {
                  const result   = results[shot.id];
                  const selected = selectedShots.has(shot.id);
                  return (
                    <button
                      key={shot.id}
                      onClick={() => !generating && toggleShot(shot.id)}
                      disabled={generating}
                      className={`relative p-2.5 rounded-lg border-2 text-left transition-all text-xs ${
                        selected
                          ? "border-accent bg-accent/5 text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-accent/30"
                      } disabled:cursor-default`}
                    >
                      <p className="font-medium leading-tight">{shot.label}</p>
                      {result && (
                        <div className="absolute top-1.5 right-1.5">
                          {result.status === "generating" && (
                            <Loader2 className="size-3 animate-spin text-accent" strokeWidth={2} />
                          )}
                          {result.status === "done" && (
                            <CheckCircle className="size-3 text-emerald-400" strokeWidth={2} />
                          )}
                          {result.status === "failed" && (
                            <XCircle className="size-3 text-red-400" strokeWidth={2} />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Step 3: Config */}
            <Section label="3 · Context" description="Sets the prompt context injected into every shot.">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Talent name</label>
                  <input
                    type="text"
                    value={subjectName}
                    onChange={e => setSubjectName(e.target.value)}
                    placeholder="e.g. Alex Jordan"
                    className="w-full h-9 px-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Sport</label>
                  <select
                    value={sport}
                    onChange={e => setSport(e.target.value)}
                    className="w-full h-9 px-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                  >
                    {SPORT_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-muted-foreground">Environment</label>
                  <select
                    value={environment}
                    onChange={e => setEnvironment(e.target.value)}
                    className="w-full h-9 px-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                  >
                    {ENV_OPTIONS.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
              </div>
            </Section>

            {/* Advanced (model + sampler settings) */}
            <div className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Settings className="size-3.5" strokeWidth={1.75} />
                  <span>Advanced — PuLID &amp; sampler settings</span>
                </div>
                <ChevronDown className={`size-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} strokeWidth={1.75} />
              </button>

              {showAdvanced && (
                <div className="px-4 pb-4 space-y-4 border-t border-border pt-4 bg-card/30">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">PuLID identity weight</label>
                      <span className="text-xs font-mono text-foreground">{pulidWeight.toFixed(2)}</span>
                    </div>
                    <input type="range" min={0.3} max={1.0} step={0.05}
                      value={pulidWeight} onChange={e => setPulidWeight(+e.target.value)}
                      className="w-full accent-[var(--accent)]" />
                    <p className="text-[11px] text-muted-foreground/60">
                      Higher = stronger identity lock. 0.85 is the sweet spot — too high can reduce style diversity.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Steps</label>
                      <input type="number" value={steps} min={10} max={50}
                        onChange={e => setSteps(+e.target.value)}
                        className="w-full h-8 px-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-accent" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">CFG</label>
                      <input type="number" value={cfg} min={1} max={10} step={0.5}
                        onChange={e => setCfg(+e.target.value)}
                        className="w-full h-8 px-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:border-accent" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Seed</label>
                      <div className="flex gap-1">
                        <input type="number" value={seed} disabled={randomSeed}
                          onChange={e => setSeed(+e.target.value)}
                          className="flex-1 h-8 px-2 bg-background border border-border rounded-md text-xs focus:outline-none focus:border-accent disabled:opacity-40" />
                        <button onClick={() => setRandomSeed(v => !v)}
                          className={`h-8 px-2 rounded-md border text-[10px] transition-colors ${randomSeed ? "border-accent text-accent bg-accent/5" : "border-border text-muted-foreground"}`}>
                          {randomSeed ? "RND" : "FIX"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">FLUX UNET (models/unet/)</label>
                      <input type="text" value={fluxModel} onChange={e => setFluxModel(e.target.value)}
                        className="w-full h-8 px-2 bg-background border border-border rounded-md text-xs font-mono focus:outline-none focus:border-accent" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">PuLID model (models/pulid/)</label>
                      <input type="text" value={pulidModel} onChange={e => setPulidModel(e.target.value)}
                        className="w-full h-8 px-2 bg-background border border-border rounded-md text-xs font-mono focus:outline-none focus:border-accent" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">CLIP-L (models/clip/)</label>
                      <input type="text" value={clipL} onChange={e => setClipL(e.target.value)}
                        className="w-full h-8 px-2 bg-background border border-border rounded-md text-xs font-mono focus:outline-none focus:border-accent" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">T5-XXL (models/clip/)</label>
                      <input type="text" value={t5xxl} onChange={e => setT5xxl(e.target.value)}
                        className="w-full h-8 px-2 bg-background border border-border rounded-md text-xs font-mono focus:outline-none focus:border-accent" />
                    </div>
                    <div className="space-y-1 col-span-2">
                      <label className="text-xs text-muted-foreground">VAE (models/vae/)</label>
                      <input type="text" value={vaeModel} onChange={e => setVaeModel(e.target.value)}
                        className="w-full h-8 px-2 bg-background border border-border rounded-md text-xs font-mono focus:outline-none focus:border-accent" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: output ── */}
          <div className="space-y-4">
            <Section label="Output Pack" description={
              completedCount > 0
                ? `${completedCount} / ${totalSelected} shots complete`
                : "Generated shots appear here"
            }>

              {/* Generate button */}
              <button
                onClick={runGeneration}
                disabled={!canGenerate || generating}
                className="w-full h-10 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 mb-3"
              >
                {generating
                  ? <><Loader2 className="size-4 animate-spin" /> Generating…</>
                  : <><Play className="size-4" strokeWidth={2} /> Generate Pack</>
                }
              </button>

              {/* Progress */}
              {generating && currentShot && (
                <div className="mb-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {currentShot === "__upload__"
                        ? "Uploading master…"
                        : `Generating: ${SHOT_PACK.find(s => s.id === currentShot)?.label ?? currentShot}`
                      }
                    </span>
                    <span>{completedCount}/{totalSelected}</span>
                  </div>
                  <div className="h-1 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300 rounded-full"
                      style={{ width: `${totalSelected > 0 ? (completedCount / totalSelected) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Shot grid */}
              <div className="grid grid-cols-2 gap-2">
                {SHOT_PACK.filter(s => selectedShots.has(s.id)).map(shot => {
                  const result = results[shot.id];
                  return (
                    <div key={shot.id} className="space-y-1">
                      <div className="aspect-square rounded-lg overflow-hidden border border-border bg-card relative">
                        {result?.dataUrl ? (
                          <img src={result.dataUrl} alt={shot.label} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                            {result?.status === "generating"
                              ? <Loader2 className="size-5 text-accent animate-spin" strokeWidth={1.75} />
                              : result?.status === "failed"
                                ? <XCircle className="size-5 text-red-400" strokeWidth={1.75} />
                                : <div className="size-5 rounded-full bg-border/50" />
                            }
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">{shot.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Import actions */}
              {completedCount > 0 && !generating && (
                <div className="pt-2 space-y-2 border-t border-border mt-3">
                  {!subjectName.trim() && (
                    <input
                      type="text"
                      value={subjectName}
                      onChange={e => setSubjectName(e.target.value)}
                      placeholder="Talent name for import…"
                      className="w-full h-8 px-2 bg-card border border-border rounded-lg text-xs focus:outline-none focus:border-accent placeholder:text-muted-foreground/40"
                    />
                  )}
                  <button
                    onClick={handleDownloadZip}
                    className="w-full h-9 rounded-lg border border-border bg-card hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Download className="size-3.5" strokeWidth={1.75} />
                    Download ZIP ({completedCount} shots)
                  </button>
                  {!imported ? (
                    <button
                      onClick={handleImportAthlete}
                      disabled={importing || !subjectName.trim()}
                      className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                    >
                      {importing
                        ? <Loader2 className="size-3.5 animate-spin" />
                        : <UserPlus className="size-3.5" strokeWidth={1.75} />
                      }
                      Import as Synthetic Athlete
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 py-1">
                        <CheckCircle className="size-3.5" strokeWidth={2} />
                        Imported to Talent
                      </div>
                      <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-lg text-xs text-amber-400/80">
                        <AlertTriangle className="size-3.5 shrink-0 mt-px" strokeWidth={1.75} />
                        <span>Identity readiness: <strong>Incomplete</strong> — open the talent in Talent, upload reference photos in the Capture tab to reach Campaign Ready.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Section>
          </div>
        </div>

        {/* Setup guide */}
        <div className="border border-border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Required Setup</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <SetupItem label="ComfyUI Manager"       note="for node management" />
            <SetupItem label="PuLID Flux nodes"      note="identity injection" />
            <SetupItem label="IPAdapter Plus"         note="optional — alternative approach" />
            <SetupItem label="FLUX Dev or Schnell"    note={`filename: ${fluxModel}`} />
            <SetupItem label="pulid_flux_v0.9.1"      note={`filename: ${pulidModel}`} />
            <SetupItem label="EVA-CLIP (auto-loads)"  note="ships with PuLID nodes" />
          </div>
          <p className="text-[11px] text-muted-foreground/50 font-mono">
            Start ComfyUI: python main.py --listen 127.0.0.1 --port 8188
          </p>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ label, description, children }: {
  label: string; description: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SetupItem({ label, note }: { label: string; note: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
      <span>{label}</span>
      <span className="text-muted-foreground/40">— {note}</span>
    </div>
  );
}
