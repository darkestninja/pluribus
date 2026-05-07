import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Share2, Download, MoreHorizontal, Sparkles,
  Check, X, RefreshCw, Bookmark, CheckSquare, Clock, RotateCcw, Info,
} from "lucide-react";
import { Project } from "../../data/projects";
import { generateImage } from "../lib/generate";
import { toast } from "../lib/notifications";
import { computeResemblanceScore } from "../lib/faceScore";
import { buildCampaignPrompt } from "../lib/promptEnhancer";
import {
  getAthletes, getCampaignOutputs, addCampaignOutput, updateCampaignOutput,
  getAthleteProfile, saveAthleteProfile, createEmptyProfile, getProfilePromptConstraints,
  getRecipes, getRuns, addRun, updateRun,
  type CampaignOutput, type Run,
} from "../lib/store";
import type { ApprovedLikeness } from "../../data/athletes";

interface CampaignWorkspaceProps {
  project: Project;
  onBack: () => void;
  onLaunchStudio: (opts: { workspaceId?: string; workflowId?: string; athleteId?: string }) => void;
}

type OutputTab = "all" | "approved" | "pending" | "rejected";

const STATUS_COLOR: Record<string, string> = {
  "In Progress": "bg-muted-foreground/40",
  Review: "bg-accent",
  Complete: "bg-emerald-500",
};

function getProjectAthletes(p: Project) {
  const athletes = getAthletes();
  if (p.athleteIds?.length) return athletes.filter(a => p.athleteIds!.includes(a.id));
  if (p.athleteName) {
    const found = athletes.find(a => a.name === p.athleteName);
    return found ? [found] : [];
  }
  return [];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function CampaignWorkspace({ project, onBack, onLaunchStudio }: CampaignWorkspaceProps) {
  const [outputs, setOutputs] = useState<CampaignOutput[]>(() => getCampaignOutputs(project.id));
  const [runs, setRuns] = useState<Run[]>(() => getRuns(project.id));
  const [activeTab, setActiveTab] = useState<OutputTab>("all");
  const [activeRunFilter, setActiveRunFilter] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [detailOutput, setDetailOutput] = useState<CampaignOutput | null>(null);

  const projAthletes = getProjectAthletes(project);
  const wf = getRecipes().find(r => r.id === project.workflowId);

  const refreshOutputs = useCallback(() => {
    setOutputs(getCampaignOutputs(project.id));
  }, [project.id]);

  const refreshRuns = useCallback(() => {
    setRuns(getRuns(project.id));
  }, [project.id]);

  useEffect(() => {
    refreshOutputs();
    refreshRuns();
  }, [refreshOutputs, refreshRuns]);

  const tabCounts = {
    all: outputs.length,
    approved: outputs.filter(o => o.status === "approved").length,
    pending: outputs.filter(o => o.status === "pending").length,
    rejected: outputs.filter(o => o.status === "rejected").length,
  };

  const filteredByRun = activeRunFilter
    ? outputs.filter(o => o.runId === activeRunFilter)
    : outputs;
  const visibleOutputs = activeTab === "all"
    ? filteredByRun
    : filteredByRun.filter(o => o.status === activeTab);

  const approveOutput = (id: string) => {
    updateCampaignOutput(id, { status: "approved" });
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: "approved" } : o));
    if (detailOutput?.id === id) setDetailOutput(prev => prev ? { ...prev, status: "approved" } : null);
  };

  const rejectOutput = (id: string) => {
    updateCampaignOutput(id, { status: "rejected" });
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: "rejected" } : o));
    if (detailOutput?.id === id) setDetailOutput(prev => prev ? { ...prev, status: "rejected" } : null);
  };

  const regenerateOutput = async (output: CampaignOutput) => {
    const athlete = getAthletes().find(a => a.id === output.athleteId);
    const runId = `run-${Date.now()}-regen`;
    const basePrompt = wf?.prompt ?? `Professional sports portrait. Athlete: ${athlete?.name ?? "athlete"}`;
    const constraints = getProfilePromptConstraints(athlete ? getAthleteProfile(athlete.id) : null);
    const prompt = athlete ? buildCampaignPrompt(basePrompt, athlete, constraints) : basePrompt;

    addRun({
      id: runId,
      campaignId: project.id,
      athleteId: athlete?.id,
      athleteName: athlete?.name,
      recipeId: project.workflowId,
      recipeName: wf?.name,
      prompt,
      negativePrompt: wf?.negativePrompt || undefined,
      model: "regenerate",
      aspectRatio: wf?.aspectRatio ?? "9:16",
      status: "running",
      startedAt: new Date().toISOString(),
      assetIds: [],
    });
    refreshRuns();

    try {
      let capturedSeed: number | undefined;
      const result = await generateImage({
        prompt,
        negativePrompt: wf?.negativePrompt || undefined,
        aspectRatio: wf?.aspectRatio ?? "9:16",
        onSeed: s => { capturedSeed = s; },
      });
      updateCampaignOutput(output.id, { url: result[0].url, status: "pending", runId });
      updateRun(project.id, runId, {
        status: "complete",
        seed: capturedSeed,
        completedAt: new Date().toISOString(),
        assetIds: [output.id],
      });
      setOutputs(prev => prev.map(o => o.id === output.id ? { ...o, url: result[0].url, status: "pending", runId } : o));
      if (detailOutput?.id === output.id) {
        setDetailOutput(prev => prev ? { ...prev, url: result[0].url, status: "pending", runId } : null);
      }
    } catch (err: any) {
      updateRun(project.id, runId, { status: "failed", errorMessage: err?.message, completedAt: new Date().toISOString() });
      toast({ type: "error", title: "Regeneration failed", body: err?.message });
    }
    refreshRuns();
  };

  const runBatch = async () => {
    if (batchRunning || projAthletes.length === 0) return;
    setBatchRunning(true);
    setBatchProgress(0);
    let generated = 0;

    for (let i = 0; i < projAthletes.length; i++) {
      const athlete = projAthletes[i];
      const runId = `run-${Date.now()}-${athlete.id}`;
      const basePrompt = wf?.prompt ?? `Professional sports portrait. Athlete: ${athlete.name}.`;
      const constraints = getProfilePromptConstraints(getAthleteProfile(athlete.id));
      const enrichedPrompt = buildCampaignPrompt(basePrompt, athlete, constraints);

      addRun({
        id: runId,
        campaignId: project.id,
        athleteId: athlete.id,
        athleteName: athlete.name,
        recipeId: project.workflowId,
        recipeName: wf?.name,
        prompt: enrichedPrompt,
        negativePrompt: wf?.negativePrompt || undefined,
        model: "batch",
        aspectRatio: wf?.aspectRatio ?? "9:16",
        status: "running",
        startedAt: new Date().toISOString(),
        assetIds: [],
      });
      refreshRuns();

      try {
        let capturedSeed: number | undefined;
        const result = await generateImage({
          prompt: enrichedPrompt,
          negativePrompt: wf?.negativePrompt || undefined,
          aspectRatio: wf?.aspectRatio ?? "9:16",
          onSeed: s => { capturedSeed = s; },
        });

        if (result[0]?.url) {
          const outId = `out-${Date.now()}-${athlete.id}`;
          const out: CampaignOutput = {
            id: outId,
            campaignId: project.id,
            athleteId: athlete.id,
            runId,
            url: result[0].url,
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          addCampaignOutput(out);
          updateRun(project.id, runId, {
            status: "complete",
            seed: capturedSeed,
            completedAt: new Date().toISOString(),
            assetIds: [outId],
          });
          generated++;
          refreshOutputs();
          refreshRuns();

          if (athlete.image) {
            computeResemblanceScore(athlete.image, result[0].url)
              .then(score => {
                if (score !== null) {
                  updateCampaignOutput(outId, { resemblanceScore: score });
                  refreshOutputs();
                }
              })
              .catch(() => {});
          }
        }
      } catch (err: any) {
        updateRun(project.id, runId, { status: "failed", errorMessage: err?.message, completedAt: new Date().toISOString() });
        toast({ type: "error", title: `Error for ${athlete.name}`, body: err?.message });
        refreshRuns();
      }
      setBatchProgress(Math.round(((i + 1) / projAthletes.length) * 100));
    }

    setBatchRunning(false);
    setBatchProgress(0);
    toast({ type: "success", title: "Generation complete", body: `${generated} image${generated !== 1 ? "s" : ""} generated` });
    refreshOutputs();
    refreshRuns();
  };

  const rerunFromRun = async (run: Run) => {
    if (batchRunning) return;
    const athlete = run.athleteId ? getAthletes().find(a => a.id === run.athleteId) : undefined;
    if (!athlete) {
      toast({ type: "error", title: "Cannot re-run", body: "Athlete no longer found." });
      return;
    }
    const newRunId = `run-${Date.now()}-rerun`;
    addRun({
      id: newRunId,
      campaignId: project.id,
      athleteId: athlete.id,
      athleteName: athlete.name,
      recipeId: run.recipeId,
      recipeName: run.recipeName,
      prompt: run.prompt,
      negativePrompt: run.negativePrompt,
      model: run.model,
      aspectRatio: run.aspectRatio,
      status: "running",
      startedAt: new Date().toISOString(),
      assetIds: [],
    });
    refreshRuns();

    try {
      let capturedSeed: number | undefined;
      const result = await generateImage({
        prompt: run.prompt,
        negativePrompt: run.negativePrompt || undefined,
        aspectRatio: run.aspectRatio,
        seed: run.seed,
        onSeed: s => { capturedSeed = s; },
      });
      if (result[0]?.url) {
        const outId = `out-${Date.now()}-rerun`;
        const out: CampaignOutput = {
          id: outId,
          campaignId: project.id,
          athleteId: athlete.id,
          runId: newRunId,
          url: result[0].url,
          status: "pending",
          createdAt: new Date().toISOString(),
        };
        addCampaignOutput(out);
        updateRun(project.id, newRunId, {
          status: "complete",
          seed: capturedSeed,
          completedAt: new Date().toISOString(),
          assetIds: [outId],
        });
        refreshOutputs();
        toast({ type: "success", title: "Re-run complete", body: `New output for ${athlete.name}` });
      }
    } catch (err: any) {
      updateRun(project.id, newRunId, { status: "failed", errorMessage: err?.message, completedAt: new Date().toISOString() });
      toast({ type: "error", title: "Re-run failed", body: err?.message });
    }
    refreshRuns();
  };

  const markAsLikeness = (output: CampaignOutput) => {
    const athlete = getAthletes().find(a => a.id === output.athleteId);
    if (!athlete) return;
    const existing = getAthleteProfile(athlete.id);
    const entry: ApprovedLikeness = {
      imageUrl: output.url,
      context: `${wf?.name ?? "Generated"} · ${new Date().toLocaleDateString()}`,
      approvedAt: new Date().toISOString(),
    };
    const profile = existing ?? createEmptyProfile(athlete.id);
    saveAthleteProfile({
      ...profile,
      approvedLikeness: [...profile.approvedLikeness, entry],
      version: profile.version + 1,
      updatedAt: new Date().toISOString(),
    });
    toast({ type: "success", title: "Likeness reference saved", body: `Added to ${athlete.name}'s identity profile` });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href + "/review/" + project.id).then(() => {
      toast({ type: "success", title: "Link copied", body: "Review link copied to clipboard" });
    });
  };

  const handleExport = () => {
    outputs.filter(o => o.status === "approved").forEach(o => window.open(o.url, "_blank"));
  };

  // Derive run details for the asset detail panel
  const detailRun = detailOutput?.runId
    ? runs.find(r => r.id === detailOutput.runId)
    : undefined;
  const detailAthlete = detailOutput?.athleteId
    ? getAthletes().find(a => a.id === detailOutput.athleteId)
    : undefined;

  const approvedCount = tabCounts.approved;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border px-4 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <ArrowLeft className="size-3.5" strokeWidth={1.75} />
            Campaigns
          </button>
          <span className="text-muted-foreground/40">/</span>
          <div className="flex items-center gap-2 min-w-0">
            {project.status && (
              <span className={`size-2 rounded-full shrink-0 ${STATUS_COLOR[project.status] ?? "bg-muted-foreground/40"}`} />
            )}
            <h1 className="text-sm font-semibold truncate">{project.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleShare}
            className="h-8 px-3 rounded-md bg-card border border-border hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <Share2 className="size-3.5" strokeWidth={1.75} /> Share
          </button>
          <button onClick={handleExport} disabled={approvedCount === 0}
            className="h-8 px-3 rounded-md bg-card border border-border hover:bg-secondary text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors flex items-center gap-1.5">
            <Download className="size-3.5" strokeWidth={1.75} />
            Export {approvedCount > 0 ? approvedCount : ""}
          </button>
          <button className="size-8 rounded-md bg-card border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center">
            <MoreHorizontal className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Gallery */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tab + generate bar */}
          <div className="h-11 border-b border-border px-4 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-0.5">
              {(["all", "approved", "pending", "rejected"] as OutputTab[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`h-7 px-3 rounded-md text-xs transition-colors flex items-center gap-1.5 ${
                    activeTab === tab ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-card"
                  }`}>
                  <span className="capitalize">{tab}</span>
                  <span className="text-muted-foreground/60">{tabCounts[tab]}</span>
                </button>
              ))}
              {activeRunFilter && (
                <button onClick={() => setActiveRunFilter(null)}
                  className="h-7 px-2 rounded-md text-xs bg-accent/10 text-accent border border-accent/30 flex items-center gap-1 ml-1">
                  Run filter
                  <X className="size-2.5" strokeWidth={2} />
                </button>
              )}
            </div>
            <button onClick={runBatch} disabled={batchRunning}
              className={`h-7 px-3 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                batchRunning ? "bg-card border border-border text-muted-foreground" : "bg-accent hover:bg-accent/90 text-accent-foreground"
              }`}>
              {batchRunning ? (
                <><span className="size-1.5 rounded-full bg-current pulse-dot" />{batchProgress}%</>
              ) : (
                <><Sparkles className="size-3" strokeWidth={2} />Generate all</>
              )}
            </button>
          </div>

          {/* Output grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {visibleOutputs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                <Sparkles className="size-10 text-muted-foreground/40" strokeWidth={1} />
                <div>
                  <p className="text-sm font-medium">No outputs yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeRunFilter ? "No outputs for this run" : "Generate images to see them here"}
                  </p>
                </div>
                {!activeRunFilter && (
                  <button onClick={runBatch} disabled={batchRunning}
                    className="h-9 px-4 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors">
                    Generate now →
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibleOutputs.map(output => {
                  const athlete = getAthletes().find(a => a.id === output.athleteId);
                  return (
                    <div key={output.id}
                      className={`group relative rounded-lg overflow-hidden border transition-all ${
                        output.status === "approved" ? "ring-2 ring-emerald-500 border-emerald-500/40"
                          : output.status === "rejected" ? "border-border opacity-40"
                          : "border-border"
                      }`}>
                      <div className="aspect-[3/4] relative overflow-hidden">
                        {/* Clickable image → detail panel */}
                        <button
                          onClick={() => setDetailOutput(output)}
                          className="absolute inset-0 w-full h-full"
                          title="View details"
                        >
                          <img src={output.url} alt="" className="w-full h-full object-cover" />
                        </button>

                        {/* Status badge */}
                        {output.status === "approved" && (
                          <div className="absolute top-2 right-2 size-5 rounded-full bg-emerald-500 flex items-center justify-center pointer-events-none">
                            <Check className="size-3 text-white" strokeWidth={2.5} />
                          </div>
                        )}
                        {output.status === "rejected" && (
                          <div className="absolute top-2 right-2 size-5 rounded-full bg-red-500 flex items-center justify-center pointer-events-none">
                            <X className="size-3 text-white" strokeWidth={2.5} />
                          </div>
                        )}

                        {/* Athlete + resemblance */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between pointer-events-none">
                          {athlete && (
                            <div className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white/90 leading-tight">
                              {athlete.name.split(" ")[0]}
                            </div>
                          )}
                          {output.resemblanceScore !== undefined && output.resemblanceScore !== null && (
                            <div className={`px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight ${
                              output.resemblanceScore >= 75 ? "bg-emerald-500/80 text-white"
                                : output.resemblanceScore >= 55 ? "bg-amber-500/80 text-white"
                                : "bg-red-500/80 text-white"
                            }`}>
                              {output.resemblanceScore}%
                            </div>
                          )}
                        </div>

                        {/* Hover action overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3 gap-2">
                          <button onClick={e => { e.stopPropagation(); approveOutput(output.id); }} title="Approve"
                            className="size-8 rounded-full bg-emerald-500/90 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors">
                            <Check className="size-3.5" strokeWidth={2.5} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); rejectOutput(output.id); }} title="Reject"
                            className="size-8 rounded-full bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center transition-colors">
                            <X className="size-3.5" strokeWidth={2.5} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); regenerateOutput(output); }} title="Regenerate"
                            className="size-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors">
                            <RefreshCw className="size-3.5" strokeWidth={1.75} />
                          </button>
                          {output.athleteId && (
                            <button onClick={e => { e.stopPropagation(); markAsLikeness(output); }} title="Save as likeness reference"
                              className="size-8 rounded-full bg-black/60 hover:bg-accent text-white flex items-center justify-center transition-colors">
                              <Bookmark className="size-3.5" strokeWidth={1.75} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="w-72 border-l border-border bg-background flex flex-col shrink-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-6">

              {/* Athletes */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Athletes</p>
                {projAthletes.length > 0 ? (
                  <div className="space-y-1.5">
                    {projAthletes.map(a => (
                      <div key={a.id} className="flex items-center gap-2.5 p-2.5 bg-card border border-border rounded-lg">
                        <img src={a.image.startsWith("blob:") ? "/athletes/placeholder.jpg" : a.image}
                          alt={a.name} className="size-8 rounded-md object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{a.sport}</p>
                        </div>
                        <button onClick={() => onLaunchStudio({ athleteId: a.id, workflowId: project.workflowId })}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 px-1.5 py-1 rounded hover:bg-secondary">
                          Studio →
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No athletes assigned.</p>
                )}
              </div>

              {/* Recipe */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Recipe</p>
                {wf ? (
                  <div className="flex items-center gap-3 p-2.5 bg-card border border-border rounded-lg">
                    <div className="size-10 rounded-md overflow-hidden shrink-0">
                      <img src={wf.thumbnail} alt={wf.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{wf.name}</p>
                      {wf.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{wf.description}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No recipe selected.</p>
                )}
              </div>

              {/* Checklist */}
              {wf && wf.qualityChecklist.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="size-3" strokeWidth={1.75} />
                    Review checklist
                  </p>
                  <div className="space-y-1.5">
                    {wf.qualityChecklist.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 px-2.5 py-1.5 bg-card border border-border rounded-md">
                        <div className="size-3.5 rounded border border-border shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground leading-tight">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Stats</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Generated", value: outputs.length },
                    { label: "Approved", value: tabCounts.approved },
                    { label: "Rejected", value: tabCounts.rejected },
                    { label: "Pending", value: tabCounts.pending },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-2.5 bg-card border border-border rounded-lg text-center">
                      <p className="text-base font-semibold">{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Run History */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="size-3" strokeWidth={1.75} />
                  Run history
                  <span className="ml-auto">{runs.length}</span>
                </p>
                {runs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No runs yet — generate to start tracking.</p>
                ) : (
                  <div className="space-y-1.5">
                    {runs.slice(0, 10).map(run => (
                      <div key={run.id}
                        className={`p-2.5 bg-card border rounded-lg transition-colors cursor-pointer ${
                          activeRunFilter === run.id ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"
                        }`}
                        onClick={() => setActiveRunFilter(activeRunFilter === run.id ? null : run.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{run.athleteName ?? "Unknown"}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{run.recipeName ?? "No recipe"}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={`size-1.5 rounded-full ${
                              run.status === "complete" ? "bg-emerald-500"
                                : run.status === "running" ? "bg-accent animate-pulse"
                                : "bg-red-500"
                            }`} />
                            <span className="text-[10px] text-muted-foreground">{relativeTime(run.startedAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1.5 gap-2">
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{run.assetIds.length} output{run.assetIds.length !== 1 ? "s" : ""}</span>
                            {run.seed !== undefined && <span>seed {run.seed}</span>}
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); rerunFromRun(run); }}
                            title="Re-run with same parameters"
                            className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-accent transition-colors">
                            <RotateCcw className="size-2.5" strokeWidth={2} />
                            Re-run
                          </button>
                        </div>
                      </div>
                    ))}
                    {runs.length > 10 && (
                      <p className="text-[10px] text-muted-foreground text-center">+{runs.length - 10} older runs</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border p-4 space-y-2 shrink-0">
            <button onClick={runBatch} disabled={batchRunning}
              className="w-full h-9 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <Sparkles className="size-4" strokeWidth={2} />
              Generate all athletes
            </button>
            <button onClick={() => onLaunchStudio({ workspaceId: project.id, workflowId: project.workflowId })}
              className="w-full h-9 rounded-md bg-card border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
              Open in Studio
            </button>
          </div>
        </aside>
      </div>

      {/* Asset detail panel */}
      {detailOutput && (
        <div onClick={() => setDetailOutput(null)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()}
            className="bg-popover border border-border rounded-xl overflow-hidden flex max-w-3xl w-full max-h-[90vh]">
            {/* Image */}
            <div className="w-64 shrink-0 bg-black">
              <img src={detailOutput.url} alt="" className="w-full h-full object-contain" />
            </div>

            {/* Details */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`h-5 px-2 rounded-full text-xs font-medium flex items-center ${
                    detailOutput.status === "approved" ? "bg-emerald-500/20 text-emerald-400"
                      : detailOutput.status === "rejected" ? "bg-red-500/20 text-red-400"
                      : "bg-secondary text-muted-foreground"
                  }`}>
                    {detailOutput.status}
                  </span>
                  {detailOutput.resemblanceScore !== undefined && (
                    <span className={`h-5 px-2 rounded-full text-xs font-medium flex items-center ${
                      detailOutput.resemblanceScore >= 75 ? "bg-emerald-500/20 text-emerald-400"
                        : detailOutput.resemblanceScore >= 55 ? "bg-amber-500/20 text-amber-400"
                        : "bg-red-500/20 text-red-400"
                    }`}>
                      {detailOutput.resemblanceScore}% match
                    </span>
                  )}
                </div>
                <button onClick={() => setDetailOutput(null)}
                  className="size-7 rounded-md flex items-center justify-center hover:bg-secondary">
                  <X className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Subject */}
                {detailAthlete && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Subject</p>
                    <div className="flex items-center gap-2.5">
                      <img src={detailAthlete.image.startsWith("blob:") ? "/athletes/placeholder.jpg" : detailAthlete.image}
                        alt={detailAthlete.name} className="size-8 rounded-md object-cover" />
                      <div>
                        <p className="text-sm font-medium">{detailAthlete.name}</p>
                        <p className="text-xs text-muted-foreground">{detailAthlete.sport}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generation details */}
                {detailRun ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Generation lineage</p>
                      <div className="bg-card border border-border rounded-md overflow-hidden text-xs">
                        {[
                          { label: "Recipe", value: detailRun.recipeName ?? "—" },
                          { label: "Model", value: detailRun.model },
                          { label: "Aspect ratio", value: detailRun.aspectRatio },
                          { label: "Seed", value: detailRun.seed !== undefined ? String(detailRun.seed) : "random" },
                          { label: "Generated", value: relativeTime(detailRun.startedAt) },
                        ].map((row, i, arr) => (
                          <div key={row.label} className={`flex justify-between px-3 py-2 ${i < arr.length - 1 ? "border-b border-border" : ""}`}>
                            <span className="text-muted-foreground">{row.label}</span>
                            <span className="font-medium truncate ml-4 text-right">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Prompt used</p>
                      <p className="text-xs text-muted-foreground leading-relaxed bg-card border border-border rounded-md p-3">
                        {detailRun.prompt}
                      </p>
                    </div>

                    {detailRun.negativePrompt && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Negative prompt</p>
                        <p className="text-xs text-muted-foreground leading-relaxed bg-card border border-border rounded-md p-3">
                          {detailRun.negativePrompt}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-md p-3">
                    <Info className="size-3.5 shrink-0" strokeWidth={1.75} />
                    No run record — generated before lineage tracking was added.
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-5 pb-5 pt-4 border-t border-border flex gap-2 shrink-0">
                <button onClick={() => approveOutput(detailOutput.id)}
                  disabled={detailOutput.status === "approved"}
                  className="flex-1 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
                  <Check className="size-3" strokeWidth={2.5} /> Approve
                </button>
                <button onClick={() => rejectOutput(detailOutput.id)}
                  disabled={detailOutput.status === "rejected"}
                  className="flex-1 h-8 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 disabled:opacity-40 text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
                  <X className="size-3" strokeWidth={2.5} /> Reject
                </button>
                <button onClick={() => { regenerateOutput(detailOutput); setDetailOutput(null); }}
                  className="h-8 px-3 rounded-md bg-card border border-border hover:bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors flex items-center gap-1.5">
                  <RefreshCw className="size-3" strokeWidth={1.75} /> Regen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
