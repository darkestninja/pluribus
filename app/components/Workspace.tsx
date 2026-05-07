import { useState, useCallback, useEffect } from "react";
import {
  RotateCcw, Redo2, RefreshCw, Maximize, Sparkles, Video, Image as ImageIcon,
  Download, Copy, Check, Zap, AlertCircle, X, ChevronDown, Search, Users, Plus,
  SlidersHorizontal, Loader2,
} from "lucide-react";
import { generateImage, generateVideo, IMAGE_MODELS, DEFAULT_IMAGE_MODEL, type LoraWeight } from "../lib/generate";
import { getAthletes, pushQueueItem, updateQueueItem, getCredits, deductCredits, getStudioMode, setStudioMode, getRecipes } from "../lib/store";
import { computeResemblanceScore } from "../lib/faceScore";
import { enhancePrompt } from "../lib/promptEnhancer";
import { toast } from "../lib/notifications";

interface WorkspaceProps {
  workspaceId: string;
  prefill?: { workflowId?: string; athleteId?: string };
  onBack: () => void;
}

// 1 credit = $0.01 USD (maps to real fal.ai per-second video billing)
// Pika ~$0.05/s, Kling ~$0.07/s, Kling Pro ~$0.10/s, Sora ~$0.30/s
// Costs below are per generation at the default 5s duration.
const QUALITY_TIERS = [
  { id: "pika",      label: "Fast",      description: "Pika 2.2 · 25cr ≈ $0.25",    credits: 25 },
  { id: "kling",     label: "Standard",  description: "Kling 2 · 35cr ≈ $0.35",     credits: 35 },
  { id: "kling-pro", label: "Pro",       description: "Kling Pro · 50cr ≈ $0.50",   credits: 50 },
  { id: "sora",      label: "Cinematic", description: "Sora 2 · 150cr ≈ $1.50",     credits: 150 },
] as const;

const RATIO_OPTIONS = [
  { value: "1:1",  label: "1:1 — Square" },
  { value: "4:5",  label: "4:5 — Portrait" },
  { value: "3:4",  label: "3:4 — Portrait" },
  { value: "2:3",  label: "2:3 — Portrait" },
  { value: "9:16", label: "9:16 — Story" },
  { value: "16:9", label: "16:9 — Landscape" },
  { value: "4:3",  label: "4:3 — Classic" },
  { value: "3:2",  label: "3:2 — Photo" },
  { value: "5:4",  label: "5:4 — Large format" },
  { value: "21:9", label: "21:9 — Ultrawide" },
];

const RESOLUTIONS = ["2K", "4K", "8K"] as const;
const VIDEO_DURATIONS = ["3s", "5s", "10s", "15s"];
const COLOR_TREATMENTS = ["Colour", "B&W", "Duotone", "Sepia", "Chrome"];

// Popular public LoRA presets (CivitAI / HF paths that work on FLUX Dev/Schnell)
const LORA_PRESETS = [
  { label: "None",        url: "" },
  { label: "Film grain",  url: "https://huggingface.co/multimodalart/flux-lora-the-explorer/resolve/main/film_grain.safetensors" },
  { label: "Cinematic",   url: "https://huggingface.co/Shakker-Labs/FLUX.1-dev-LoRA-add-details/resolve/main/FLUX-dev-lora-add_details.safetensors" },
  { label: "B&W photo",   url: "https://huggingface.co/XLabs-AI/flux-lora-collection/resolve/main/bw-lora.safetensors" },
  { label: "Editorial",   url: "https://huggingface.co/XLabs-AI/flux-lora-collection/resolve/main/realism-lora.safetensors" },
  { label: "Custom…",     url: "custom" },
] as const;

const POSE_CATS = {
  Posed:      ["Neutral stand", "Arms crossed", "Hands on hips", "One arm raised", "Arms wide", "Three-quarter turn"],
  Expressive: ["Profile left", "Profile right", "Over-shoulder", "Head down", "Looking up", "Face to lens", "Eyes closed"],
  Action:     ["Low crouch", "Explosive start", "Mid-stride lean", "One knee down", "Pre-throw wind-up", "Seated forward"],
} as const;
type PoseCat = keyof typeof POSE_CATS;
type PoseValue = typeof POSE_CATS[PoseCat][number];

const seedVariations = ["/variations/v1.jpg", "/variations/v2.jpg", "/variations/v3.jpg", "/variations/v4.jpg"];

type GenMode = "image" | "video";
type GenState = "idle" | "generating" | "done";
type PromptMode = "template" | "custom";

export function Workspace({ workspaceId: _id, prefill, onBack }: WorkspaceProps) {
  const athletes = getAthletes();

  const initialPreset  = prefill?.workflowId ?? "";
  const initialAthlete = prefill?.athleteId  ?? athletes[0]?.id ?? "";
  const initialWorkflow = getRecipes().find(r => r.id === initialPreset);
  const initialRatio = initialWorkflow?.aspectRatio ?? "9:16";

  // Mode
  const [mode, setMode] = useState<GenMode>("image");
  const [promptMode, setPromptMode] = useState<PromptMode>(initialPreset ? "template" : "custom");

  // Athlete(s)
  const [selectedAthleteId, setSelectedAthleteId] = useState(initialAthlete);
  const [teamAthleteIds, setTeamAthleteIds] = useState<string[]>([]);
  const [teamMode, setTeamMode] = useState(false);
  const [showAthleteSwap, setShowAthleteSwap] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [athleteSearch, setAthleteSearch] = useState("");

  // Template / prompt
  const [selectedPreset, setSelectedPreset] = useState(initialPreset);
  const [customNotes, setCustomNotes] = useState("");
  const [prompt, setPrompt] = useState(
    initialWorkflow?.prompt ?? "A heroic portrait of an Olympic athlete on the victory podium, dramatic stadium lighting, low angle shot, photorealistic, ultra high detail, shot on Phase One, f/2.8"
  );

  // Pose
  const [poseCat, setPoseCat] = useState<PoseCat>("Posed");
  const [selectedPose, setSelectedPose] = useState<PoseValue>("Neutral stand");

  // Render settings
  const [selectedRatio, setSelectedRatio] = useState(initialRatio);
  const [selectedRes, setSelectedRes] = useState<typeof RESOLUTIONS[number]>("4K");
  const [colorTreatment, setColorTreatment] = useState("Colour");
  const [qualityTier, setQualityTier] = useState(2);
  const [videoDuration, setVideoDuration] = useState("5s");

  // Generation parameters
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_IMAGE_MODEL.id);
  const [resemblanceStrength, setResemblanceStrength] = useState(75);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [imageStrength, setImageStrength] = useState(80);
  // LoRA
  const [loraPreset, setLoraPreset] = useState("");          // "" = none, "custom" = show URL input
  const [loraCustomUrl, setLoraCustomUrl] = useState("");
  const [loraScale, setLoraScale] = useState(0.85);

  // Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedExpression, setSelectedExpression] = useState("Confident");
  const [selectedUniform, setSelectedUniform] = useState("Team USA Official");
  const [randomSeed, setRandomSeed] = useState(true);
  const [seedValue, setSeedValue] = useState(42);

  // Gen state
  const [genState, setGenState] = useState<GenState>("idle");
  const [genProgress, setGenProgress] = useState(0);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [generatedVariations, setGeneratedVariations] = useState<string[]>([]);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [credits, setCredits] = useState(getCredits);

  // Resemblance scoring
  const [resemblanceScores, setResemblanceScores] = useState<(number | null)[]>([]);
  const [scoringState, setScoringState] = useState<"idle" | "computing" | "done">("idle");

  // Style picker
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  // Studio mode
  const [studioMode, setStudioModeState] = useState<"quick" | "expert">(getStudioMode);

  // Right rail visibility (for mobile)
  const [showRail, setShowRail] = useState(false);

  const athlete = athletes.find(a => a.id === selectedAthleteId);
  const preset  = getRecipes().find(r => r.id === selectedPreset);
  const tier    = QUALITY_TIERS[qualityTier];
  const isTemplate = promptMode === "template" && !!preset;
  const selectedModel = IMAGE_MODELS.find(m => m.id === selectedModelId) ?? DEFAULT_IMAGE_MODEL;

  const activeLoras: LoraWeight[] = (() => {
    if (!selectedModel.supportsLora) return [];
    const url = loraPreset === "custom" ? loraCustomUrl.trim() : loraPreset;
    if (!url) return [];
    return [{ url, scale: loraScale }];
  })();

  // Auto-apply style defaults when template/mode changes
  useEffect(() => {
    if (isTemplate && preset) {
      if (preset.defaultLook)     setColorTreatment(preset.defaultLook);
      if (preset.aspectRatio)     setSelectedRatio(preset.aspectRatio);
    }
  }, [selectedPreset, promptMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const teamAthletes = teamMode
    ? athletes.filter(a => teamAthleteIds.includes(a.id))
    : [];

  const creditsPerGen = mode === "image"
    ? selectedModel.credits * (selectedRes === "8K" ? 6 : selectedRes === "4K" ? 2 : 1)
    : tier.credits;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAthleteSwap)  setShowAthleteSwap(false);
        if (showTeamPicker)   setShowTeamPicker(false);
        if (showStylePicker)  setShowStylePicker(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAthleteSwap, showTeamPicker, showStylePicker]);

  const handleEnhancePrompt = async () => {
    setEnhancing(true);
    // Small synthetic delay for UX feedback
    await new Promise(r => setTimeout(r, 600));
    const enhanced = enhancePrompt({
      basePrompt: prompt,
      athlete: athlete ?? null,
      look: colorTreatment,
    });
    setPrompt(enhanced);
    setEnhancing(false);
    toast({ type: "info", title: "Prompt enhanced", body: "AI-powered prompt enrichment applied." });
  };

  const switchStyle = (id: string) => {
    const wf = getRecipes().find(r => r.id === id);
    if (!wf) return;
    setSelectedPreset(id);
    setPromptMode("template");
    if (wf.defaultLook)  setColorTreatment(wf.defaultLook);
    if (wf.aspectRatio)  setSelectedRatio(wf.aspectRatio);
    setCustomNotes("");
    setShowStylePicker(false);
  };

  const buildPrompt = useCallback(() => {
    const subjectStr = teamMode && teamAthletes.length > 0
      ? teamAthletes.map(a => a.name).join(", ")
      : athlete?.name ?? "athlete";
    const sportStr = athlete?.sport ?? "";

    if (isTemplate && preset?.prompt) {
      return `${preset.prompt}${customNotes ? ` Additional notes: ${customNotes}` : ""} Athletes: ${subjectStr}.${!randomSeed ? ` Seed: ${seedValue}.` : ""}`;
    }
    return `${prompt}. Subject: ${subjectStr}${sportStr ? `, sport: ${sportStr}` : ""}, pose: ${selectedPose}, expression: ${selectedExpression}, uniform: ${selectedUniform}, color treatment: ${colorTreatment}.${!randomSeed ? ` Seed: ${seedValue}.` : ""}`;
  }, [prompt, athlete, selectedPose, selectedExpression, selectedUniform, colorTreatment, isTemplate, preset, customNotes, teamMode, teamAthletes, randomSeed, seedValue]);

  const scoreVariations = async (urls: string[], refUrl: string | undefined, autoSelect: boolean) => {
    if (!refUrl || urls.length === 0 || mode !== "image") return;
    setScoringState("computing");
    setResemblanceScores([]);
    const scores = await Promise.all(urls.map(url => computeResemblanceScore(refUrl, url)));
    setResemblanceScores(scores);
    setScoringState("done");
    if (autoSelect && scores.some(s => s !== null)) {
      const bestIdx = scores.reduce(
        (best, s, i) => (s !== null && (scores[best] === null || s > (scores[best] ?? 0))) ? i : best,
        0
      );
      setSelectedVariation(bestIdx);
      setGeneratedUrl(urls[bestIdx]);
    }
  };

  const runGeneration = async (batchCount = 1, autoSelect = false) => {
    setGenState("generating");
    setGenProgress(0);
    setGenError(null);
    setGeneratedVariations([]);
    setResemblanceScores([]);
    setScoringState("idle");

    const enrichedPrompt = buildPrompt();
    const queueId = `q-${Date.now()}`;
    const modelLabel = mode === "image" ? selectedModel.label : tier.label;

    pushQueueItem({
      id: queueId,
      name: `${preset?.name ?? "Render"} – ${selectedRatio}`,
      athleteName: teamMode && teamAthletes.length > 0
        ? teamAthletes.map(a => a.name).join(", ")
        : athlete?.name ?? "",
      type: mode,
      model: modelLabel,
      status: "rendering",
      progress: 0,
      credits: creditsPerGen * batchCount,
      thumb: athlete?.image,
      startedAt: new Date().toLocaleTimeString(),
      duration: mode === "video" ? videoDuration : undefined,
    });

    try {
      const urls: string[] = [];
      for (let i = 0; i < batchCount; i++) {
        if (mode === "image") {
          const images = await generateImage({
            prompt: enrichedPrompt,
            negativePrompt: preset?.negativePrompt || undefined,
            modelId: selectedModelId,
            aspectRatio: selectedRatio,
            numImages: 1,
            loras: activeLoras.length ? activeLoras : undefined,
            guidanceScale: studioMode === "expert" ? guidanceScale : undefined,
            onProgress: pct => { setGenProgress(pct); updateQueueItem(queueId, { progress: pct }); },
          });
          if (images[0]?.url) urls.push(images[0].url);
        } else {
          const video = await generateVideo({
            prompt: enrichedPrompt,
            model: tier.id as "pika" | "kling" | "kling-pro" | "sora",
            duration: parseInt(videoDuration),
            aspectRatio: selectedRatio,
            onProgress: pct => { setGenProgress(pct); updateQueueItem(queueId, { progress: pct }); },
          });
          if (video?.url) urls.push(video.url);
        }
      }
      setGeneratedUrl(urls[0] ?? null);
      setGeneratedVariations(urls);
      updateQueueItem(queueId, { status: "done", progress: 100, resultUrl: urls[0] });
      const remaining = deductCredits(creditsPerGen * batchCount);
      setCredits(remaining);
      setGenState("done");
      toast({ type: "success", title: "Generation complete", body: `${urls.length} image${urls.length !== 1 ? "s" : ""} ready.` });
      scoreVariations(urls, athlete?.image, autoSelect);
    } catch (err: any) {
      const msg = err?.message ?? "Generation failed";
      setGenError(msg);
      updateQueueItem(queueId, { status: "failed", error: msg });
      setGenState("idle");
      toast({ type: "error", title: "Generation failed", body: msg });
    }
  };

  const variationsToShow = generatedVariations.length > 0 ? generatedVariations : seedVariations;

  const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );

  const scoreClass = (s: number) =>
    s >= 80 ? "bg-accent/15 text-accent border-accent/30" :
    s >= 65 ? "bg-amber-400/15 text-amber-400 border-amber-400/30" :
              "bg-red-400/15 text-red-400 border-red-400/30";

  const toggleStudioMode = (m: "quick" | "expert") => {
    setStudioMode(m);
    setStudioModeState(m);
  };

  const Chip = ({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`h-7 px-2.5 rounded-md text-xs transition-colors ${
        active ? "bg-foreground text-background" : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-accent/40"
      }`}
    >
      {children}
    </button>
  );

  const toggleTeamAthlete = (id: string) => {
    setTeamAthleteIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-full flex bg-background overflow-hidden">
      {/* Center: canvas */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Toolbar */}
        <div className="h-12 border-b border-border bg-background px-3 sm:px-4 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 text-sm text-muted-foreground min-w-0">
            <button onClick={onBack} className="hover:text-foreground transition-colors shrink-0">Back</button>
            <span className="text-muted-foreground/60">/</span>
            {teamMode && teamAthletes.length > 0 ? (
              <button
                onClick={() => setShowTeamPicker(true)}
                className="flex items-center gap-1 hover:text-foreground transition-colors min-w-0"
              >
                <div className="flex -space-x-1.5">
                  {teamAthletes.slice(0, 3).map(a => (
                    <img key={a.id} src={a.image} alt={a.name} className="size-5 rounded-full object-cover ring-1 ring-background" />
                  ))}
                </div>
                <span className="text-xs text-foreground hidden sm:inline ml-1">{teamAthletes.length} athletes</span>
                <ChevronDown className="size-3 shrink-0" />
              </button>
            ) : (
              <button
                onClick={() => setShowAthleteSwap(true)}
                className="flex items-center gap-1.5 hover:text-foreground transition-colors group min-w-0"
              >
                {athlete && <img src={athlete.image} alt="" className="size-5 rounded-full object-cover shrink-0" />}
                <span className="text-foreground truncate max-w-[140px] sm:max-w-none">{athlete?.name ?? "Select athlete"}</span>
                <ChevronDown className="size-3 shrink-0" />
              </button>
            )}
            {preset && promptMode === "template" && (
              <>
                <span className="text-muted-foreground/60 hidden sm:inline">/</span>
                <span className="hidden sm:inline truncate max-w-[120px]">{preset.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {[
              { icon: RotateCcw, tip: "Undo" },
              { icon: Redo2, tip: "Redo" },
              { icon: RefreshCw, tip: "Regenerate", onClick: () => runGeneration(1) },
              { icon: Maximize, tip: "Fullscreen" },
            ].map(({ icon: Icon, tip, onClick }) => (
              <button key={tip} title={tip} onClick={onClick}
                className="size-7 rounded-md flex items-center justify-center hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
              </button>
            ))}
            {/* Mobile: rail toggle */}
            <button
              onClick={() => setShowRail(s => !s)}
              className="sm:hidden size-7 rounded-md flex items-center justify-center hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
              title="Settings"
            >
              <SlidersHorizontal className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-background p-4 sm:p-8">
          <div className="relative w-full flex justify-center">
            {genState === "generating" ? (
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <img
                    src={variationsToShow[0]}
                    alt=""
                    style={{ aspectRatio: selectedRatio.replace(":", "/") }}
                    className="max-h-[calc(100vh-280px)] max-w-full opacity-25 blur-md rounded-lg"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <span className="size-2 rounded-full bg-accent pulse-dot" />
                      {mode === "video" ? "Generating video" : "Generating image"}
                    </div>
                    <div className="w-48 h-0.5 bg-card overflow-hidden rounded-full">
                      <div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.min(genProgress, 100)}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground">{Math.round(Math.min(genProgress, 100))}%</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative group">
                {genError && (
                  <div className="flex flex-col items-center gap-2 p-6 bg-card border border-destructive/40 rounded-lg max-w-sm">
                    <AlertCircle className="size-5 text-destructive" />
                    <p className="text-sm text-destructive text-center">{genError}</p>
                  </div>
                )}
                {!genError && mode === "video" && generatedUrl ? (
                  <video src={generatedUrl} autoPlay loop muted playsInline className="max-h-[calc(100vh-280px)] max-w-full rounded-lg shadow-lg" />
                ) : !genError ? (
                  <img
                    src={generatedUrl ?? variationsToShow[selectedVariation]}
                    alt="Generated render"
                    className="max-h-[calc(100vh-280px)] max-w-full rounded-lg shadow-lg"
                  />
                ) : null}
                {/* Resemblance score badge */}
                {scoringState === "computing" && (
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-md text-xs bg-background/80 backdrop-blur-sm border border-border text-muted-foreground flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-accent pulse-dot" /> Scoring…
                  </div>
                )}
                {scoringState === "done" && resemblanceScores[selectedVariation] != null && (
                  <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-xs font-semibold border backdrop-blur-sm ${scoreClass(resemblanceScores[selectedVariation]!)}`}>
                    {resemblanceScores[selectedVariation]}% match
                  </div>
                )}
                {genState === "done" && generatedUrl && (
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={generatedUrl} download target="_blank" rel="noreferrer"
                      className="h-8 px-3 rounded-md bg-foreground text-background text-xs font-medium flex items-center gap-1.5 hover:bg-foreground/90 transition-colors"
                    >
                      <Download className="size-3.5" strokeWidth={2} /> Download
                    </a>
                    <button
                      onClick={() => navigator.clipboard.writeText(generatedUrl)}
                      className="h-8 px-3 rounded-md bg-card border border-border text-foreground text-xs font-medium flex items-center gap-1.5 hover:bg-secondary transition-colors"
                    >
                      <Copy className="size-3.5" strokeWidth={1.75} /> Copy URL
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Variations strip */}
        <div className="h-24 border-t border-border bg-background px-4 sm:px-6 flex items-center gap-3 shrink-0">
          <p className="text-xs text-muted-foreground shrink-0">Variations</p>
          <div className="flex gap-2 flex-1 overflow-x-auto scrollbar-hide">
            {variationsToShow.map((v, i) => (
              <button
                key={i}
                onClick={() => { setSelectedVariation(i); if (generatedVariations[i]) setGeneratedUrl(generatedVariations[i]); }}
                className={`relative shrink-0 h-16 aspect-[3/4] rounded-md overflow-hidden transition-all border-2 ${
                  selectedVariation === i
                    ? "border-accent opacity-100"
                    : "border-transparent opacity-40 hover:opacity-75"
                }`}
              >
                <img src={v} alt={`Variation ${i + 1}`} className="w-full h-full object-cover" />
                {scoringState === "done" && resemblanceScores[i] != null && (
                  <div className={`absolute bottom-0 inset-x-0 text-center text-[9px] font-bold py-0.5 ${
                    resemblanceScores[i]! >= 80 ? "bg-accent/80 text-white" :
                    resemblanceScores[i]! >= 65 ? "bg-amber-400/80 text-black" :
                                                   "bg-red-400/80 text-white"
                  }`}>
                    {resemblanceScores[i]}%
                  </div>
                )}
              </button>
            ))}
            <button className="shrink-0 h-16 aspect-[3/4] rounded-md bg-card border-2 border-dashed border-border hover:border-accent/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <span className="text-base">+</span>
            </button>
          </div>
          <div className="text-xs text-muted-foreground shrink-0">
            <span className="text-foreground font-medium">{variationsToShow.length}</span> of 8
          </div>
        </div>
      </div>

      {/* Right rail — hidden on mobile unless toggled */}
      <aside className={`${showRail ? "flex" : "hidden"} sm:flex w-full sm:w-[300px] lg:w-[320px] border-l border-border bg-background flex-col shrink-0 overflow-hidden absolute sm:relative inset-0 sm:inset-auto z-10 sm:z-auto`}>
        {/* Mobile close */}
        <div className="sm:hidden flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-sm font-medium">Settings</p>
          <button onClick={() => setShowRail(false)} className="size-7 flex items-center justify-center hover:bg-secondary rounded-md">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-4 space-y-5 pb-2">

            {/* Quick / Expert toggle */}
            <div className="flex items-center gap-1 p-0.5 bg-card border border-border rounded-md">
              {(["quick", "expert"] as const).map(m => (
                <button key={m} onClick={() => toggleStudioMode(m)}
                  className={`flex-1 h-7 rounded text-xs capitalize transition-colors ${
                    studioMode === m ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "quick" ? "Quick" : "Expert"}
                </button>
              ))}
            </div>

            {/* Athlete parameter */}
            <div className="flex items-center gap-2.5 p-2.5 bg-card border border-border rounded-md">
              <div className="size-10 rounded-md overflow-hidden shrink-0 bg-secondary">
                {athlete && <img src={athlete.image} alt={athlete.name} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Subject</p>
                <p className="text-sm font-medium truncate">{athlete?.name ?? "No athlete"}</p>
                {athlete && <p className="text-xs text-muted-foreground truncate">{athlete.sport}</p>}
              </div>
              <button onClick={() => setShowAthleteSwap(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 px-1.5 py-1 rounded hover:bg-secondary"
              >
                Change
              </button>
            </div>

            {/* Mode tabs */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-card border border-border rounded-md">
              {(["image", "video"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`h-8 rounded text-sm flex items-center justify-center gap-1.5 transition-colors ${
                    mode === m ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "image" ? <ImageIcon className="size-3.5" strokeWidth={1.75} /> : <Video className="size-3.5" strokeWidth={1.75} />}
                  {m === "image" ? "Image" : "Video"}
                </button>
              ))}
            </div>

            {/* Template / Custom toggle */}
            <div className="flex items-center gap-2 p-1 bg-card border border-border rounded-md">
              {(["template", "custom"] as const).map(pm => (
                <button key={pm} onClick={() => setPromptMode(pm)}
                  className={`flex-1 h-7 rounded text-xs capitalize transition-colors ${
                    promptMode === pm ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  disabled={pm === "template" && !preset}
                  title={pm === "template" && !preset ? "Select a shoot brief first" : undefined}
                >
                  {pm === "template" ? "Style" : "Custom"}
                </button>
              ))}
            </div>

            {/* TEMPLATE MODE */}
            {isTemplate && preset ? (
              <>
                <Section label="Style">
                  <div className="bg-card border border-border rounded-md overflow-hidden">
                    <div className="flex gap-3 p-3">
                      <div className="size-14 rounded-md overflow-hidden shrink-0">
                        <img src={preset.thumbnail} alt={preset.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{preset.name}</p>
                        {preset.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{preset.description}</p>}
                        {preset.defaultLook && (
                          <span className="inline-block mt-1.5 text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{preset.defaultLook} default</span>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-border px-3 py-2">
                      <button
                        onClick={() => setShowStylePicker(true)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Change style →
                      </button>
                    </div>
                  </div>
                </Section>

                <Section label="Extra notes">
                  <textarea
                    value={customNotes}
                    onChange={e => setCustomNotes(e.target.value)}
                    rows={3}
                    placeholder="Append extra instructions to the style…"
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-md text-sm leading-relaxed resize-none focus-visible:border-accent placeholder:text-muted-foreground"
                  />
                </Section>

                <Section label="Pose override">
                  <select
                    value={selectedPose}
                    onChange={e => setSelectedPose(e.target.value as PoseValue)}
                    className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus-visible:border-accent text-foreground"
                  >
                    <option value="">— Style default —</option>
                    {(Object.values(POSE_CATS).flat() as string[]).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Section>
              </>
            ) : (
              <>
                {/* CUSTOM MODE */}
                <Section label="Describe your shot">
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={5}
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-md text-sm leading-relaxed resize-none focus-visible:border-accent placeholder:text-muted-foreground"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleEnhancePrompt}
                      disabled={enhancing}
                      className="flex-1 h-7 rounded-md bg-card border border-border hover:border-accent/40 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {enhancing
                        ? <><Loader2 className="size-3 animate-spin" /> Enhancing…</>
                        : <><Sparkles className="size-3" strokeWidth={1.75} /> Enhance with AI</>
                      }
                    </button>
                    <button
                      onClick={() => setPrompt("A heroic portrait of an Olympic athlete on the victory podium, dramatic stadium lighting, low angle shot, photorealistic, ultra high detail, shot on Phase One, f/2.8")}
                      className="h-7 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </Section>

                {/* Pose — categorised (custom mode only) */}
                <Section label="Pose">
                  <div className="flex gap-1 mb-2">
                    {(Object.keys(POSE_CATS) as PoseCat[]).map(cat => (
                      <button key={cat} onClick={() => setPoseCat(cat)}
                        className={`h-6 px-2.5 rounded text-xs transition-colors ${
                          poseCat === cat ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-card"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(POSE_CATS[poseCat] as readonly string[]).map(p => (
                      <Chip key={p} active={selectedPose === p} onClick={() => setSelectedPose(p as PoseValue)}>{p}</Chip>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* Aspect ratio — dropdown */}
            <Section label="Aspect ratio">
              <select
                value={selectedRatio}
                onChange={e => setSelectedRatio(e.target.value)}
                className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus-visible:border-accent text-foreground"
              >
                {RATIO_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Section>

            {studioMode === "expert" && (
              <>
                {/* Resolution / Quality */}
                {mode === "image" ? (
                  <Section label="Resolution">
                    <div className="flex gap-1.5">
                      {RESOLUTIONS.map(r => <Chip key={r} active={selectedRes === r} onClick={() => setSelectedRes(r)}>{r}</Chip>)}
                    </div>
                  </Section>
                ) : (
                  <>
                    <Section label="Quality">
                      <div className="space-y-2">
                        <input type="range" min={0} max={3} step={1} value={qualityTier}
                          onChange={e => setQualityTier(+e.target.value)}
                          className="w-full accent-[var(--accent)] cursor-pointer"
                        />
                        <div className="flex justify-between">
                          {QUALITY_TIERS.map((t, i) => (
                            <button key={t.id} onClick={() => setQualityTier(i)}
                              className={`text-xs ${qualityTier === i ? "text-foreground" : "text-muted-foreground"}`}
                            >{t.label}</button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{tier.description}</p>
                      </div>
                    </Section>
                    <Section label="Duration">
                      <div className="flex gap-1.5">
                        {VIDEO_DURATIONS.map(d => <Chip key={d} active={videoDuration === d} onClick={() => setVideoDuration(d)}>{d}</Chip>)}
                      </div>
                    </Section>
                  </>
                )}

                {/* Look */}
                <Section label="Look">
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_TREATMENTS.map(c => <Chip key={c} active={colorTreatment === c} onClick={() => setColorTreatment(c)}>{c}</Chip>)}
                  </div>
                  {isTemplate && preset?.defaultLook && colorTreatment !== preset.defaultLook && (
                    <button
                      onClick={() => setColorTreatment(preset.defaultLook!)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                    >
                      ↩ Reset to style default ({preset.defaultLook})
                    </button>
                  )}
                </Section>

                {/* Model */}
                <Section label="Model">
                  <div className="space-y-1.5">
                    {IMAGE_MODELS.map(m => {
                      const active = selectedModelId === m.id;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModelId(m.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
                            active ? "border-accent bg-accent/5" : "border-border hover:border-accent/40 bg-card"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-medium">{m.label}</p>
                              {m.supportsLora && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent border border-accent/20">LoRA</span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{m.description}</p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">{m.credits}cr</span>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                {/* Resemblance */}
                {mode === "image" && (
                  <Section label={`Resemblance · ${resemblanceStrength}%`}>
                    <input type="range" min={0} max={100} step={5} value={resemblanceStrength}
                      onChange={e => setResemblanceStrength(+e.target.value)}
                      className="w-full accent-[var(--accent)] cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground">How closely the output matches the athlete's face.</p>
                  </Section>
                )}

                {/* Guidance */}
                <Section label={`Guidance · ${guidanceScale.toFixed(1)}`}>
                  <input type="range" min={1} max={15} step={0.5} value={guidanceScale}
                    onChange={e => setGuidanceScale(+e.target.value)}
                    className="w-full accent-[var(--accent)] cursor-pointer"
                  />
                </Section>

                {/* Advanced */}
                <div>
                  <button
                    onClick={() => setShowAdvanced(s => !s)}
                    className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>Advanced</span>
                    <ChevronDown className={`size-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} strokeWidth={1.75} />
                  </button>
                  {showAdvanced && (
                    <div className="mt-3 space-y-4">

                      {/* Team shoot */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Team shoot</p>
                          <button
                            onClick={() => { setTeamMode(t => !t); if (!teamMode) setShowTeamPicker(true); }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${teamMode ? "bg-accent" : "bg-border"}`}
                          >
                            <span className={`inline-block size-3.5 rounded-full bg-white transition-transform ${teamMode ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        </div>
                        {teamMode && (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1.5">
                              {teamAthletes.map(a => (
                                <div key={a.id} className="flex items-center gap-1 h-6 px-2 bg-secondary rounded-md text-xs text-foreground">
                                  <img src={a.image} alt="" className="size-4 rounded-full object-cover" />
                                  <span className="truncate max-w-[80px]">{a.name.split(" ")[0]}</span>
                                  <button onClick={() => toggleTeamAthlete(a.id)} className="text-muted-foreground hover:text-foreground ml-0.5">
                                    <X className="size-2.5" />
                                  </button>
                                </div>
                              ))}
                              <button
                                onClick={() => setShowTeamPicker(true)}
                                className="h-6 px-2 rounded-md bg-card border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors flex items-center gap-1"
                              >
                                <Plus className="size-2.5" /> Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Seed */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Random seed</p>
                          <button
                            onClick={() => setRandomSeed(s => !s)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${randomSeed ? "bg-accent" : "bg-border"}`}
                          >
                            <span className={`inline-block size-3.5 rounded-full bg-white transition-transform ${randomSeed ? "translate-x-4" : "translate-x-0.5"}`} />
                          </button>
                        </div>
                        {!randomSeed && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={seedValue}
                              onChange={e => setSeedValue(parseInt(e.target.value) || 0)}
                              className="flex-1 h-8 px-3 bg-card border border-border rounded-md text-sm focus-visible:border-accent"
                            />
                            <button
                              onClick={() => setSeedValue(Math.floor(Math.random() * 99999))}
                              className="h-8 px-2.5 rounded-md bg-card border border-border hover:border-accent/40 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Shuffle
                            </button>
                          </div>
                        )}
                        {!randomSeed && <p className="text-xs text-muted-foreground">Fixed seed produces reproducible results.</p>}
                      </div>

                      <Section label={`Image strength · ${imageStrength}%`}>
                        <input type="range" min={0} max={100} step={5} value={imageStrength}
                          onChange={e => setImageStrength(+e.target.value)}
                          className="w-full accent-[var(--accent)] cursor-pointer"
                        />
                        <p className="text-xs text-muted-foreground">How much the output deviates from the reference.</p>
                      </Section>

                      <Section label="LoRA style">
                        {!selectedModel.supportsLora ? (
                          <p className="text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
                            Switch to FLUX Schnell or FLUX Dev to enable LoRA.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {/* Preset chips */}
                            <div className="flex flex-wrap gap-1.5">
                              {LORA_PRESETS.map(p => (
                                <Chip
                                  key={p.label}
                                  active={loraPreset === p.url}
                                  onClick={() => setLoraPreset(loraPreset === p.url ? "" : p.url)}
                                >
                                  {p.label}
                                </Chip>
                              ))}
                            </div>
                            {/* Custom URL input */}
                            {loraPreset === "custom" && (
                              <input
                                type="url"
                                value={loraCustomUrl}
                                onChange={e => setLoraCustomUrl(e.target.value)}
                                placeholder="HuggingFace or CivitAI .safetensors URL"
                                className="w-full h-8 px-3 bg-card border border-border rounded-md text-xs focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
                              />
                            )}
                            {/* Scale slider — only show when a LoRA is active */}
                            {(loraPreset && loraPreset !== "custom") || (loraPreset === "custom" && loraCustomUrl) ? (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                  <span>Strength</span>
                                  <span>{loraScale.toFixed(2)}</span>
                                </div>
                                <input
                                  type="range" min={0} max={1} step={0.05}
                                  value={loraScale}
                                  onChange={e => setLoraScale(+e.target.value)}
                                  className="w-full accent-[var(--accent)] cursor-pointer"
                                />
                              </div>
                            ) : null}
                          </div>
                        )}
                      </Section>

                      <Section label="Expression">
                        <div className="flex flex-wrap gap-1.5">
                          {["Neutral", "Confident", "Intense", "Celebration", "Determined"].map(e => (
                            <Chip key={e} active={selectedExpression === e} onClick={() => setSelectedExpression(e)}>{e}</Chip>
                          ))}
                        </div>
                      </Section>
                      <Section label="Uniform">
                        <select
                          value={selectedUniform}
                          onChange={e => setSelectedUniform(e.target.value)}
                          className="w-full h-8 px-2.5 bg-card border border-border rounded-md text-sm focus-visible:border-accent"
                        >
                          {["Team USA Official", "Competition Gear", "Podium Ceremony", "Training Gear"].map(u => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      </Section>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sticky generate footer */}
        <div className="border-t border-border bg-background p-4 space-y-2 shrink-0">
          {genState === "idle" && (
            <>
              <button
                onClick={() => runGeneration(1)}
                className="w-full h-10 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="size-4" strokeWidth={2} />
                {mode === "image" ? "Generate image" : "Generate video"}
                {teamMode && teamAthletes.length > 0 && <span className="text-accent-foreground/70 text-xs ml-1">({teamAthletes.length} athletes)</span>}
              </button>
              {studioMode === "expert" && (
                <button
                  onClick={() => runGeneration(4, true)}
                  className="w-full h-8 rounded-md bg-card border border-border hover:border-accent/40 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                >
                  <Zap className="size-3.5" strokeWidth={1.75} /> Smart generate · picks best match
                </button>
              )}
            </>
          )}
          {genState === "generating" && (
            <div className="w-full h-10 rounded-md bg-card border border-border text-sm text-muted-foreground flex items-center justify-center gap-2">
              <span className="size-1.5 rounded-full bg-accent pulse-dot" />
              {Math.round(Math.min(genProgress, 100))}%
            </div>
          )}
          {genState === "done" && (
            <button
              onClick={() => { setGenState("idle"); setGeneratedUrl(null); }}
              className="w-full h-10 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Check className="size-4" strokeWidth={2} /> Generate again
            </button>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {selectedModel.label}
              {activeLoras.length > 0 && (
                <span className="px-1 py-0.5 rounded bg-accent/10 text-accent text-[10px] border border-accent/20">+ LoRA</span>
              )}
            </span>
            <span>
              <span className="text-foreground font-medium">{creditsPerGen}cr</span>
              <span className="text-muted-foreground/60"> ≈ ${(creditsPerGen * 0.01).toFixed(2)}</span>
              <span className="mx-1">·</span>
              {credits}cr left
            </span>
          </div>
        </div>
      </aside>

      {/* Athlete swap modal */}
      {showAthleteSwap && (
        <div onClick={() => setShowAthleteSwap(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div onClick={e => e.stopPropagation()} className="bg-popover border border-border rounded-lg w-full max-w-lg overflow-hidden">
            <div className="px-5 h-12 flex items-center justify-between border-b border-border">
              <h2 className="text-base font-semibold tracking-tight">Switch athlete</h2>
              <button onClick={() => setShowAthleteSwap(false)} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary">
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="p-4">
              <div className="relative mb-3">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" strokeWidth={1.75} />
                <input type="text" placeholder="Search athletes…" value={athleteSearch} onChange={e => setAthleteSearch(e.target.value)}
                  className="w-full pl-8 pr-3 h-9 bg-card border border-border rounded-md text-sm focus-visible:border-accent placeholder:text-muted-foreground"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto scrollbar-thin">
                {athletes.filter(a => a.name.toLowerCase().includes(athleteSearch.toLowerCase())).map(a => (
                  <button key={a.id}
                    onClick={() => { setSelectedAthleteId(a.id); setShowAthleteSwap(false); setAthleteSearch(""); }}
                    className={`group rounded-md overflow-hidden text-left border transition-colors ${
                      selectedAthleteId === a.id ? "border-accent" : "border-border hover:border-accent/40"
                    }`}
                  >
                    <div className="aspect-square overflow-hidden">
                      <img src={a.image} alt={a.name} className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]" />
                    </div>
                    <div className="p-2 bg-card">
                      <p className="text-sm font-medium truncate">{a.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.sport}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team picker modal */}
      {showTeamPicker && (
        <div onClick={() => setShowTeamPicker(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div onClick={e => e.stopPropagation()} className="bg-popover border border-border rounded-lg w-full max-w-lg overflow-hidden">
            <div className="px-5 h-12 flex items-center justify-between border-b border-border">
              <h2 className="text-base font-semibold tracking-tight">Team shoot — select athletes</h2>
              <button onClick={() => setShowTeamPicker(false)} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary">
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-3">{teamAthleteIds.length} selected · click to toggle</p>
              <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto scrollbar-thin">
                {athletes.map(a => {
                  const selected = teamAthleteIds.includes(a.id);
                  return (
                    <button key={a.id}
                      onClick={() => toggleTeamAthlete(a.id)}
                      className={`group rounded-md overflow-hidden text-left border-2 transition-colors relative ${
                        selected ? "border-accent" : "border-border hover:border-accent/40"
                      }`}
                    >
                      <div className="aspect-square overflow-hidden">
                        <img src={a.image} alt={a.name} className="w-full h-full object-cover transition-transform group-hover:scale-[1.03]" />
                      </div>
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-accent flex items-center justify-center">
                          <Check className="size-3 text-accent-foreground" strokeWidth={2.5} />
                        </div>
                      )}
                      <div className="p-2 bg-card">
                        <p className="text-xs font-medium truncate">{a.name}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => setShowTeamPicker(false)}
                  className="h-9 px-4 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Style picker modal */}
      {showStylePicker && (
        <div onClick={() => setShowStylePicker(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div onClick={e => e.stopPropagation()} className="bg-popover border border-border rounded-lg w-full max-w-md overflow-hidden">
            <div className="px-5 h-12 flex items-center justify-between border-b border-border">
              <h2 className="text-base font-semibold tracking-tight">Choose a style</h2>
              <button onClick={() => setShowStylePicker(false)} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary">
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {getRecipes().map(recipe => (
                <button
                  key={recipe.id}
                  onClick={() => switchStyle(recipe.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                    selectedPreset === recipe.id
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/40 hover:bg-card"
                  }`}
                >
                  <div className="size-16 rounded-md overflow-hidden shrink-0">
                    <img src={recipe.thumbnail} alt={recipe.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{recipe.name}</p>
                      {selectedPreset === recipe.id && <Check className="size-3.5 text-accent shrink-0" strokeWidth={2.5} />}
                    </div>
                    {recipe.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{recipe.description}</p>}
                    <div className="flex items-center gap-2 mt-1.5">
                      {recipe.defaultLook && <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{recipe.defaultLook}</span>}
                      {recipe.aspectRatio && <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{recipe.aspectRatio}</span>}
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => { setPromptMode("custom"); setSelectedPreset(""); setShowStylePicker(false); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-border hover:border-accent/40 text-left transition-all"
              >
                <div className="size-16 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  <Sparkles className="size-5 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Custom prompt</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Write your own prompt and choose any pose</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
