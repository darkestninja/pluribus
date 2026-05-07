import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Share2, Download, MoreHorizontal, Sparkles,
  Check, X, RefreshCw, Bookmark, CheckSquare,
} from "lucide-react";
import { Project } from "../../data/projects";
import { generateImage } from "../lib/generate";
import { toast } from "../lib/notifications";
import { computeResemblanceScore } from "../lib/faceScore";
import { buildCampaignPrompt } from "../lib/promptEnhancer";
import {
  getAthletes, getCampaignOutputs, addCampaignOutput, updateCampaignOutput,
  getAthleteProfile, saveAthleteProfile, createEmptyProfile, getProfilePromptConstraints,
  getRecipes,
  type CampaignOutput,
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

export function CampaignWorkspace({ project, onBack, onLaunchStudio }: CampaignWorkspaceProps) {
  const [outputs, setOutputs] = useState<CampaignOutput[]>(() => getCampaignOutputs(project.id));
  const [activeTab, setActiveTab] = useState<OutputTab>("all");
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  const projAthletes = getProjectAthletes(project);
  const wf = getRecipes().find(r => r.id === project.workflowId);

  const refreshOutputs = useCallback(() => {
    setOutputs(getCampaignOutputs(project.id));
  }, [project.id]);

  useEffect(() => {
    refreshOutputs();
  }, [refreshOutputs]);

  const tabCounts = {
    all: outputs.length,
    approved: outputs.filter(o => o.status === "approved").length,
    pending: outputs.filter(o => o.status === "pending").length,
    rejected: outputs.filter(o => o.status === "rejected").length,
  };

  const visibleOutputs = activeTab === "all" ? outputs : outputs.filter(o => o.status === activeTab);

  const approveOutput = (id: string) => {
    updateCampaignOutput(id, { status: "approved" });
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: "approved" } : o));
  };

  const rejectOutput = (id: string) => {
    updateCampaignOutput(id, { status: "rejected" });
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, status: "rejected" } : o));
  };

  const regenerateOutput = async (output: CampaignOutput) => {
    const athlete = getAthletes().find(a => a.id === output.athleteId);
    try {
      const basePrompt = wf?.prompt ?? `Professional sports portrait. Athlete: ${athlete?.name ?? "athlete"}`;
      const constraints = getProfilePromptConstraints(athlete ? getAthleteProfile(athlete.id) : null);
      const prompt = athlete
        ? buildCampaignPrompt(basePrompt, athlete, constraints)
        : basePrompt;
      const result = await generateImage({
        prompt,
        negativePrompt: wf?.negativePrompt || undefined,
        aspectRatio: wf?.aspectRatio ?? "9:16",
      });
      updateCampaignOutput(output.id, { url: result[0].url, status: "pending" });
      setOutputs(prev => prev.map(o => o.id === output.id ? { ...o, url: result[0].url, status: "pending" } : o));
    } catch (err: any) {
      toast({ type: "error", title: "Regeneration failed", body: err?.message });
    }
  };

  const runBatch = async () => {
    if (batchRunning || projAthletes.length === 0) return;
    setBatchRunning(true);
    setBatchProgress(0);
    let generated = 0;

    for (let i = 0; i < projAthletes.length; i++) {
      const athlete = projAthletes[i];
      try {
        const basePrompt = wf?.prompt ?? `Professional sports portrait. Athlete: ${athlete.name}.`;
        const constraints = getProfilePromptConstraints(getAthleteProfile(athlete.id));
        const enrichedPrompt = buildCampaignPrompt(basePrompt, athlete, constraints);

        const result = await generateImage({
          prompt: enrichedPrompt,
          negativePrompt: wf?.negativePrompt || undefined,
          aspectRatio: wf?.aspectRatio ?? "9:16",
        });

        if (result[0]?.url) {
          const outId = `out-${Date.now()}-${athlete.id}`;
          const out: CampaignOutput = {
            id: outId,
            campaignId: project.id,
            athleteId: athlete.id,
            url: result[0].url,
            status: "pending",
            createdAt: new Date().toISOString(),
          };
          addCampaignOutput(out);
          generated++;
          refreshOutputs();

          // Compute resemblance score asynchronously
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
        toast({ type: "error", title: `Error for ${athlete.name}`, body: err?.message });
      }
      setBatchProgress(Math.round(((i + 1) / projAthletes.length) * 100));
    }

    setBatchRunning(false);
    setBatchProgress(0);
    toast({ type: "success", title: "Generation complete", body: `${generated} image${generated !== 1 ? "s" : ""} generated` });
    refreshOutputs();
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
    const url = window.location.href + "/review/" + project.id;
    navigator.clipboard.writeText(url).then(() => {
      toast({ type: "success", title: "Link copied", body: "Review link copied to clipboard" });
    });
  };

  const handleExport = () => {
    const approved = outputs.filter(o => o.status === "approved");
    approved.forEach(o => window.open(o.url, "_blank"));
  };

  const approvedCount = tabCounts.approved;

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border px-4 flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
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
          <button
            onClick={handleShare}
            className="h-8 px-3 rounded-md bg-card border border-border hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Share2 className="size-3.5" strokeWidth={1.75} />
            Share
          </button>
          <button
            onClick={handleExport}
            disabled={approvedCount === 0}
            className="h-8 px-3 rounded-md bg-card border border-border hover:bg-secondary text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
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
        {/* Left: Output gallery */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tab bar */}
          <div className="h-11 border-b border-border px-4 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-0.5">
              {(["all", "approved", "pending", "rejected"] as OutputTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`h-7 px-3 rounded-md text-xs transition-colors flex items-center gap-1.5 ${
                    activeTab === tab
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-card"
                  }`}
                >
                  <span className="capitalize">{tab}</span>
                  <span className="text-muted-foreground/60">{tabCounts[tab]}</span>
                </button>
              ))}
            </div>
            <button
              onClick={runBatch}
              disabled={batchRunning}
              className={`h-7 px-3 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                batchRunning
                  ? "bg-card border border-border text-muted-foreground"
                  : "bg-accent hover:bg-accent/90 text-accent-foreground"
              }`}
            >
              {batchRunning ? (
                <>
                  <span className="size-1.5 rounded-full bg-current pulse-dot" />
                  {batchProgress}%
                </>
              ) : (
                <>
                  <Sparkles className="size-3" strokeWidth={2} />
                  Generate all
                </>
              )}
            </button>
          </div>

          {/* Gallery */}
          <div className="flex-1 overflow-y-auto p-4">
            {visibleOutputs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                <Sparkles className="size-10 text-muted-foreground/40" strokeWidth={1} />
                <div>
                  <p className="text-sm font-medium">No outputs yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Generate images to see them here</p>
                </div>
                <button
                  onClick={runBatch}
                  disabled={batchRunning}
                  className="h-9 px-4 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors"
                >
                  Generate now →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {visibleOutputs.map(output => {
                  const athlete = getAthletes().find(a => a.id === output.athleteId);
                  return (
                    <div
                      key={output.id}
                      className={`group relative rounded-lg overflow-hidden border transition-all ${
                        output.status === "approved"
                          ? "ring-2 ring-emerald-500 border-emerald-500/40"
                          : output.status === "rejected"
                          ? "border-border opacity-40"
                          : "border-border"
                      }`}
                    >
                      <div className="aspect-[3/4] relative overflow-hidden">
                        <img src={output.url} alt="" className="w-full h-full object-cover" />

                        {/* Status badge top-right */}
                        {output.status === "approved" && (
                          <div className="absolute top-2 right-2 size-5 rounded-full bg-emerald-500 flex items-center justify-center">
                            <Check className="size-3 text-white" strokeWidth={2.5} />
                          </div>
                        )}
                        {output.status === "rejected" && (
                          <div className="absolute top-2 right-2 size-5 rounded-full bg-red-500 flex items-center justify-center">
                            <X className="size-3 text-white" strokeWidth={2.5} />
                          </div>
                        )}

                        {/* Athlete badge + resemblance score bottom */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
                          {athlete && (
                            <div className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white/90 leading-tight">
                              {athlete.name.split(" ")[0]}
                            </div>
                          )}
                          {output.resemblanceScore !== undefined && output.resemblanceScore !== null && (
                            <div
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight ${
                                output.resemblanceScore >= 75
                                  ? "bg-emerald-500/80 text-white"
                                  : output.resemblanceScore >= 55
                                  ? "bg-amber-500/80 text-white"
                                  : "bg-red-500/80 text-white"
                              }`}
                            >
                              {output.resemblanceScore}%
                            </div>
                          )}
                        </div>

                        {/* Hover overlay actions */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3 gap-2">
                          <button
                            onClick={() => approveOutput(output.id)}
                            title="Approve"
                            className="size-8 rounded-full bg-emerald-500/90 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors"
                          >
                            <Check className="size-3.5" strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={() => rejectOutput(output.id)}
                            title="Reject"
                            className="size-8 rounded-full bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center transition-colors"
                          >
                            <X className="size-3.5" strokeWidth={2.5} />
                          </button>
                          <button
                            onClick={() => regenerateOutput(output)}
                            title="Regenerate"
                            className="size-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
                          >
                            <RefreshCw className="size-3.5" strokeWidth={1.75} />
                          </button>
                          {output.athleteId && (
                            <button
                              onClick={() => markAsLikeness(output)}
                              title="Save as likeness reference"
                              className="size-8 rounded-full bg-black/60 hover:bg-accent text-white flex items-center justify-center transition-colors"
                            >
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
              {/* Athletes section */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Athletes</p>
                {projAthletes.length > 0 ? (
                  <div className="space-y-1.5">
                    {projAthletes.map(a => (
                      <div key={a.id} className="flex items-center gap-2.5 p-2.5 bg-card border border-border rounded-lg">
                        <img src={a.image} alt={a.name} className="size-8 rounded-md object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{a.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{a.sport}</p>
                        </div>
                        <button
                          onClick={() => onLaunchStudio({ athleteId: a.id, workflowId: project.workflowId })}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 px-1.5 py-1 rounded hover:bg-secondary"
                        >
                          Studio →
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No athletes assigned.</p>
                )}
              </div>

              {/* Recipe section */}
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

              {/* Quality checklist */}
              {wf && wf.qualityChecklist && wf.qualityChecklist.length > 0 && (
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

              {/* Stats grid */}
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
            </div>
          </div>

          {/* Sticky footer */}
          <div className="border-t border-border p-4 space-y-2 shrink-0">
            <button
              onClick={runBatch}
              disabled={batchRunning}
              className="w-full h-9 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="size-4" strokeWidth={2} />
              Generate all athletes
            </button>
            <button
              onClick={() => onLaunchStudio({ workspaceId: project.id, workflowId: project.workflowId })}
              className="w-full h-9 rounded-md bg-card border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
            >
              Open in Studio
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
