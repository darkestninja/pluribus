import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft, Download, Sparkles,
  Check, X, RefreshCw, Bookmark, CheckSquare, Clock, RotateCcw, Flag, PenLine,
  ChevronDown, FileText,
} from "lucide-react";
import { Project, type CampaignStatus } from "../../data/projects";
import { generateImage, DEFAULT_IMAGE_MODEL } from "../lib/generate";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/notifications";
import { computeResemblanceScore } from "../lib/faceScore";
import { buildCampaignPrompt } from "../lib/promptEnhancer";
import {
  getAthletes, getCampaignOutputs, addCampaignOutput, updateCampaignOutput,
  getAthleteProfile, saveAthleteProfile, createEmptyProfile, getProfilePromptConstraints,
  getProjects, getRecipes, getRuns, addRun, updateRun, updateProject, appendExportLog,
  setOutputStatus, addOutputComment, addOutputTag, removeOutputTag, addRejectedLikeness,
  type CampaignOutput, type Run, type OutputStatus, type OutputComment, type ExportLogEntry,
} from "../lib/store";
import { relativeTime, downloadZip } from "../lib/utils";
import type { ApprovedLikeness } from "../../data/athletes";
import { AssetDetailPanel } from "./AssetDetailPanel";

interface CampaignWorkspaceProps {
  project: Project;
  onBack: () => void;
  onLaunchStudio: (opts: { workspaceId?: string; workflowId?: string; athleteId?: string }) => void;
}

type OutputTab = "all" | "approved" | "pending" | "needs_revision" | "flagged" | "rejected";

const TAB_LABELS: Record<OutputTab, string> = {
  all:            "All",
  approved:       "Approved",
  pending:        "Pending",
  needs_revision: "Revision",
  flagged:        "Flagged",
  rejected:       "Rejected",
};

const CAMPAIGN_STATUSES: { value: CampaignStatus; label: string; dot: string }[] = [
  { value: "draft",     label: "Draft",      dot: "bg-muted-foreground/40" },
  { value: "in_review", label: "In Review",  dot: "bg-accent" },
  { value: "approved",  label: "Approved",   dot: "bg-emerald-500" },
  { value: "delivered", label: "Delivered",  dot: "bg-purple-500" },
];

function getProjectAthletes(p: Project) {
  const athletes = getAthletes();
  if (p.athleteIds?.length) return athletes.filter(a => p.athleteIds!.includes(a.id));
  if (p.athleteName) {
    const found = athletes.find(a => a.name === p.athleteName);
    return found ? [found] : [];
  }
  return [];
}


function cardBorderClass(status: OutputStatus): string {
  switch (status) {
    case "approved":       return "ring-2 ring-emerald-500 border-emerald-500/40";
    case "needs_revision": return "ring-2 ring-blue-500 border-blue-500/40";
    case "flagged":        return "ring-2 ring-amber-500 border-amber-500/40";
    case "rejected":       return "border-border opacity-40";
    default:               return "border-border";
  }
}

export function CampaignWorkspace({ project, onBack, onLaunchStudio }: CampaignWorkspaceProps) {
  const [outputs, setOutputs]             = useState<CampaignOutput[]>(() => getCampaignOutputs(project.id));
  const [runs, setRuns]                   = useState<Run[]>(() => getRuns(project.id));
  const [activeTab, setActiveTab]         = useState<OutputTab>("all");
  const [activeRunFilter, setActiveRunFilter] = useState<string | null>(null);
  const [batchRunning, setBatchRunning]   = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [isExporting, setIsExporting]     = useState(false);
  const [detailOutput, setDetailOutput]   = useState<CampaignOutput | null>(null);
  const [showAllRuns, setShowAllRuns]     = useState(false);
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [brief, setBrief]               = useState(() => getProjects().find(p => p.id === project.id)?.brief ?? project.brief ?? "");
  const [briefSaved, setBriefSaved]     = useState(false);
  const briefSavedTimerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [directionOpen, setDirectionOpen] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>(
    () => (getProjects().find(p => p.id === project.id)?.status as CampaignStatus) ?? "draft"
  );
  const [exportLog, setExportLog] = useState<ExportLogEntry[]>(
    () => getProjects().find(p => p.id === project.id)?.exportLog ?? []
  );

  const projAthletes = getProjectAthletes(project);
  const wf = getRecipes().find(r => r.id === project.workflowId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setReviewerEmail(session.user.email);
    });
  }, []);

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

  const tabCounts: Record<OutputTab, number> = {
    all:            outputs.length,
    approved:       outputs.filter(o => o.status === "approved").length,
    pending:        outputs.filter(o => o.status === "pending").length,
    needs_revision: outputs.filter(o => o.status === "needs_revision").length,
    flagged:        outputs.filter(o => o.status === "flagged").length,
    rejected:       outputs.filter(o => o.status === "rejected").length,
  };

  const filteredByRun = activeRunFilter
    ? outputs.filter(o => o.runId === activeRunFilter)
    : outputs;
  const visibleOutputs = activeTab === "all"
    ? filteredByRun
    : filteredByRun.filter(o => o.status === activeTab);

  const changeStatus = (id: string, status: OutputStatus) => {
    const now = new Date().toISOString();
    setOutputStatus(id, status, reviewerEmail);
    const patch = { status, reviewedBy: reviewerEmail, reviewedAt: now };
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
    if (detailOutput?.id === id) setDetailOutput(prev => prev ? { ...prev, ...patch } : null);
  };

  const handleCommentAdded = (outputId: string, comment: OutputComment) => {
    addOutputComment(outputId, comment);
    setOutputs(prev => prev.map(o =>
      o.id === outputId ? { ...o, comments: [...(o.comments ?? []), comment] } : o
    ));
    if (detailOutput?.id === outputId) {
      setDetailOutput(prev => prev
        ? { ...prev, comments: [...(prev.comments ?? []), comment] }
        : null
      );
    }
  };

  const handleTagAdded = (outputId: string, tag: string) => {
    addOutputTag(outputId, tag);
    const patch = (o: CampaignOutput) => o.id === outputId
      ? { ...o, tags: [...(o.tags ?? []).filter(t => t !== tag), tag] }
      : o;
    setOutputs(prev => prev.map(patch));
    if (detailOutput?.id === outputId) setDetailOutput(prev => prev ? patch(prev) : null);
  };

  const handleTagRemoved = (outputId: string, tag: string) => {
    removeOutputTag(outputId, tag);
    const patch = (o: CampaignOutput) => o.id === outputId
      ? { ...o, tags: (o.tags ?? []).filter(t => t !== tag) }
      : o;
    setOutputs(prev => prev.map(patch));
    if (detailOutput?.id === outputId) setDetailOutput(prev => prev ? patch(prev) : null);
  };

  const handleBriefBlur = () => {
    updateProject(project.id, { brief: brief.trim() || undefined });
    setBriefSaved(true);
    if (briefSavedTimerRef.current) clearTimeout(briefSavedTimerRef.current);
    briefSavedTimerRef.current = setTimeout(() => setBriefSaved(false), 2000);
  };

  useEffect(() => () => { if (briefSavedTimerRef.current) clearTimeout(briefSavedTimerRef.current); }, []);

  const regenerateOutput = async (output: CampaignOutput) => {
    if (batchRunning) return;
    setBatchRunning(true);
    const athlete = getAthletes().find(a => a.id === output.athleteId);
    const runId = `run-${Date.now()}-regen`;
    const basePrompt = wf?.prompt ?? `Professional sports portrait. Athlete: ${athlete?.name ?? "athlete"}`;
    const constraints = getProfilePromptConstraints(athlete ? getAthleteProfile(athlete.id) : null);
    const prompt = athlete ? buildCampaignPrompt(basePrompt, athlete, constraints, brief || undefined) : basePrompt;

    addRun({
      id: runId,
      campaignId: project.id,
      athleteId: athlete?.id,
      athleteName: athlete?.name,
      recipeId: project.workflowId,
      recipeName: wf?.name,
      prompt,
      negativePrompt: wf?.negativePrompt || undefined,
      model: DEFAULT_IMAGE_MODEL.id,
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
      const patch = { url: result[0].url, status: "pending" as OutputStatus, runId };
      updateCampaignOutput(output.id, patch);
      setOutputs(prev => prev.map(o => o.id === output.id ? { ...o, ...patch } : o));
      if (detailOutput?.id === output.id) setDetailOutput(prev => prev ? { ...prev, ...patch } : null);
      updateRun(project.id, runId, {
        status: "complete",
        seed: capturedSeed,
        completedAt: new Date().toISOString(),
        assetIds: [output.id],
      });
    } catch (err: any) {
      updateRun(project.id, runId, { status: "failed", errorMessage: err?.message, completedAt: new Date().toISOString() });
      toast({ type: "error", title: "Regeneration failed", body: err?.message });
    } finally {
      setBatchRunning(false);
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
      const enrichedPrompt = buildCampaignPrompt(basePrompt, athlete, constraints, brief || undefined);

      addRun({
        id: runId,
        campaignId: project.id,
        athleteId: athlete.id,
        athleteName: athlete.name,
        recipeId: project.workflowId,
        recipeName: wf?.name,
        prompt: enrichedPrompt,
        negativePrompt: wf?.negativePrompt || undefined,
        model: DEFAULT_IMAGE_MODEL.id,
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
                  setOutputs(prev => prev.map(o => o.id === outId ? { ...o, resemblanceScore: score } : o));
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
    setBatchRunning(true);
    const athlete = run.athleteId ? getAthletes().find(a => a.id === run.athleteId) : undefined;
    if (!athlete) {
      setBatchRunning(false);
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
    } finally {
      setBatchRunning(false);
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

  const handleExport = async () => {
    const approved = outputs.filter(o => o.status === "approved");
    if (approved.length === 0) return;
    setIsExporting(true);
    try {
      await downloadZip(
        approved.map((o, i) => ({
          url: o.url,
          filename: `${project.name.replace(/\s+/g, "-").toLowerCase()}-${i + 1}.jpg`,
          meta: { id: o.id, status: o.status, athleteId: o.athleteId, createdAt: o.createdAt },
        })),
        `${project.name.replace(/\s+/g, "-").toLowerCase()}-approved.zip`,
      );
      const entry: ExportLogEntry = {
        exportedAt: new Date().toISOString(),
        exportedBy: reviewerEmail,
        assetCount: approved.length,
      };
      appendExportLog(project.id, entry);
      setExportLog(prev => [entry, ...prev]);
    } finally {
      setIsExporting(false);
    }
  };

  const handleMarkRejectedLikeness = (output: CampaignOutput) => {
    if (!output.athleteId) return;
    addRejectedLikeness(output.athleteId, {
      imageUrl: output.url,
      context: `${wf?.name ?? "Generated"} · ${new Date().toLocaleDateString()}`,
      rejectedAt: new Date().toISOString(),
    });
    const athlete = getAthletes().find(a => a.id === output.athleteId);
    toast({ type: "success", title: "Rejected likeness saved", body: `Added to ${athlete?.name ?? "athlete"}'s profile as what to avoid` });
  };

  const detailRun = detailOutput?.runId ? runs.find(r => r.id === detailOutput.runId) : undefined;
  const detailAthlete = detailOutput?.athleteId ? getAthletes().find(a => a.id === detailOutput.athleteId) : undefined;
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
            <h1 className="text-sm font-semibold truncate">{project.name}</h1>
            <select
              value={campaignStatus}
              onChange={e => {
                const s = e.target.value as CampaignStatus;
                setCampaignStatus(s);
                updateProject(project.id, { status: s });
              }}
              className="h-6 pl-2 pr-6 rounded-md text-[11px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground focus:outline-none focus:border-accent cursor-pointer appearance-none"
              style={{ backgroundImage: "none" }}
              title="Campaign status"
            >
              {CAMPAIGN_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <span className={`size-2 rounded-full shrink-0 ${CAMPAIGN_STATUSES.find(s => s.value === campaignStatus)?.dot ?? "bg-muted-foreground/40"}`} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleExport} disabled={approvedCount === 0 || isExporting}
            className="h-8 px-3 rounded-md bg-card border border-border hover:bg-secondary text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors flex items-center gap-1.5">
            <Download className="size-3.5" strokeWidth={1.75} />
            {isExporting ? "Exporting…" : `Export ${approvedCount > 0 ? approvedCount : ""}`}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Gallery */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Tab + generate bar */}
          <div className="h-11 border-b border-border px-4 flex items-center justify-between shrink-0 gap-2">
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
              {(Object.keys(TAB_LABELS) as OutputTab[]).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`h-7 px-2.5 rounded-md text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    activeTab === tab ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-card"
                  }`}>
                  <span>{TAB_LABELS[tab]}</span>
                  <span className="text-muted-foreground/60">{tabCounts[tab]}</span>
                </button>
              ))}
              {activeRunFilter && (
                <button onClick={() => setActiveRunFilter(null)}
                  className="h-7 px-2 rounded-md text-xs bg-accent/10 text-accent border border-accent/30 flex items-center gap-1 ml-1 shrink-0">
                  Run filter
                  <X className="size-2.5" strokeWidth={2} />
                </button>
              )}
            </div>
            <button onClick={runBatch} disabled={batchRunning}
              className={`h-7 px-3 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
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
                      className={`group relative rounded-lg overflow-hidden border transition-all ${cardBorderClass(output.status)}`}>
                      <div className="aspect-[3/4] relative overflow-hidden">
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
                        {output.status === "needs_revision" && (
                          <div className="absolute top-2 right-2 size-5 rounded-full bg-blue-500 flex items-center justify-center pointer-events-none">
                            <PenLine className="size-2.5 text-white" strokeWidth={2.5} />
                          </div>
                        )}
                        {output.status === "flagged" && (
                          <div className="absolute top-2 right-2 size-5 rounded-full bg-amber-500 flex items-center justify-center pointer-events-none">
                            <Flag className="size-2.5 text-white" strokeWidth={2.5} />
                          </div>
                        )}
                        {/* Comment count badge */}
                        {(output.comments?.length ?? 0) > 0 && (
                          <div className="absolute top-2 left-2 h-4 px-1.5 rounded bg-black/60 backdrop-blur-sm flex items-center gap-1 pointer-events-none">
                            <span className="text-[9px] text-white/80">{output.comments!.length}</span>
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
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3 gap-1.5">
                          <button onClick={e => { e.stopPropagation(); changeStatus(output.id, "approved"); }} title="Approve"
                            className="size-8 rounded-full bg-emerald-500/90 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors">
                            <Check className="size-3.5" strokeWidth={2.5} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); changeStatus(output.id, "needs_revision"); }} title="Needs revision"
                            className="size-8 rounded-full bg-blue-500/90 hover:bg-blue-500 text-white flex items-center justify-center transition-colors">
                            <PenLine className="size-3.5" strokeWidth={2} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); changeStatus(output.id, "flagged"); }} title="Flag"
                            className="size-8 rounded-full bg-amber-500/90 hover:bg-amber-500 text-white flex items-center justify-center transition-colors">
                            <Flag className="size-3.5" strokeWidth={2} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); changeStatus(output.id, "rejected"); }} title="Reject"
                            className="size-8 rounded-full bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center transition-colors">
                            <X className="size-3.5" strokeWidth={2.5} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); regenerateOutput(output); }} title="Regenerate"
                            disabled={batchRunning}
                            className="size-8 rounded-full bg-black/60 hover:bg-black/80 disabled:opacity-40 text-white flex items-center justify-center transition-colors">
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

              {/* Subjects */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Subjects</p>
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
                  <p className="text-xs text-muted-foreground">No subjects assigned.</p>
                )}
              </div>

              {/* Creative brief */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="size-3" strokeWidth={1.75} />
                  Creative brief
                  {briefSaved && <span className="ml-auto text-[10px] text-emerald-400">saved</span>}
                </p>
                <textarea
                  value={brief}
                  onChange={e => { setBrief(e.target.value); setBriefSaved(false); }}
                  onBlur={handleBriefBlur}
                  placeholder="Add campaign-specific direction…"
                  rows={3}
                  maxLength={280}
                  className="w-full px-3 py-2 bg-card border border-border rounded-md text-xs focus:outline-none focus:border-accent placeholder:text-muted-foreground/50 resize-none leading-relaxed"
                />
                <p className="text-[10px] text-muted-foreground/40 text-right -mt-1">{brief.length}/280</p>
              </div>

              {/* Recipe + direction */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Recipe</p>
                {wf ? (
                  <div>
                    <button
                      onClick={() => setDirectionOpen(v => !v)}
                      className="w-full flex items-center gap-3 p-2.5 bg-card border border-border rounded-lg hover:border-accent/40 transition-colors text-left"
                    >
                      <div className="size-10 rounded-md overflow-hidden shrink-0">
                        <img src={wf.thumbnail} alt={wf.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{wf.name}</p>
                        {wf.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{wf.description}</p>}
                      </div>
                      <ChevronDown className={`size-3 text-muted-foreground shrink-0 transition-transform duration-150 ${directionOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
                    </button>

                    {directionOpen && (
                      <div className="mt-2 space-y-3 px-0.5">
                        {wf.styleRules.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Style</p>
                            <ul className="space-y-0.5">
                              {wf.styleRules.map((r, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <span className="shrink-0 mt-[5px] size-1 rounded-full bg-muted-foreground/30" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {wf.lightingRules.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Lighting</p>
                            <ul className="space-y-0.5">
                              {wf.lightingRules.map((r, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <span className="shrink-0 mt-[5px] size-1 rounded-full bg-muted-foreground/30" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {wf.compositionRules.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Composition</p>
                            <ul className="space-y-0.5">
                              {wf.compositionRules.map((r, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                  <span className="shrink-0 mt-[5px] size-1 rounded-full bg-muted-foreground/30" />
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {wf.negativePrompt && (
                          <div>
                            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Negative prompt</p>
                            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{wf.negativePrompt}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No recipe selected.</p>
                )}
              </div>

              {/* Quality checklist */}
              {wf && wf.qualityChecklist.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="size-3" strokeWidth={1.75} />
                    Review checklist
                    <span className="ml-auto text-[10px] tabular-nums">{checkedItems.size} / {wf.qualityChecklist.length}</span>
                  </p>
                  <div className="space-y-1.5">
                    {wf.qualityChecklist.map((item, i) => {
                      const checked = checkedItems.has(i);
                      return (
                        <button
                          key={i}
                          onClick={() => setCheckedItems(prev => {
                            const next = new Set(prev);
                            checked ? next.delete(i) : next.add(i);
                            return next;
                          })}
                          className={`w-full flex items-start gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors border ${
                            checked
                              ? "bg-emerald-500/5 border-emerald-500/30"
                              : "bg-card border-border hover:border-accent/40"
                          }`}
                        >
                          <div className={`size-3.5 rounded shrink-0 mt-0.5 flex items-center justify-center border transition-colors ${
                            checked ? "bg-emerald-500 border-emerald-500" : "border-border"
                          }`}>
                            {checked && <Check className="size-2.5 text-white" strokeWidth={3} />}
                          </div>
                          <p className={`text-xs leading-tight transition-colors ${
                            checked ? "text-muted-foreground/40 line-through" : "text-muted-foreground"
                          }`}>{item}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Stats</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Generated",  value: outputs.length },
                    { label: "Approved",   value: tabCounts.approved },
                    { label: "Revision",   value: tabCounts.needs_revision },
                    { label: "Flagged",    value: tabCounts.flagged },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-2.5 bg-card border border-border rounded-lg text-center">
                      <p className="text-base font-semibold">{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export log */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Download className="size-3" strokeWidth={1.75} />
                  Export log
                  {exportLog.length > 0 && <span className="ml-auto">{exportLog.length}</span>}
                </p>
                {exportLog.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No exports yet — approve and export assets to log deliveries.</p>
                ) : (
                  <div className="space-y-1.5">
                    {exportLog.slice(0, 5).map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-card border border-border rounded-md text-xs">
                        <span className="shrink-0 h-4 px-1.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-medium flex items-center">
                          {entry.assetCount} asset{entry.assetCount !== 1 ? "s" : ""}
                        </span>
                        <span className="text-muted-foreground truncate">
                          {entry.exportedBy ? entry.exportedBy.split("@")[0] : "—"}
                        </span>
                        <span className="text-muted-foreground/50 shrink-0 ml-auto">{relativeTime(entry.exportedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
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
                    {(showAllRuns ? runs : runs.slice(0, 10)).map(run => (
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
                      <button
                        onClick={() => setShowAllRuns(v => !v)}
                        className="w-full text-[10px] text-muted-foreground hover:text-foreground text-center transition-colors py-1">
                        {showAllRuns ? "Show less" : `+${runs.length - 10} older runs`}
                      </button>
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
        <AssetDetailPanel
          output={detailOutput}
          run={detailRun}
          athlete={detailAthlete}
          reviewerEmail={reviewerEmail}
          onClose={() => setDetailOutput(null)}
          onStatusChange={changeStatus}
          onRegenerate={regenerateOutput}
          onMarkLikeness={markAsLikeness}
          onMarkRejectedLikeness={handleMarkRejectedLikeness}
          onCommentAdded={handleCommentAdded}
          onTagAdded={handleTagAdded}
          onTagRemoved={handleTagRemoved}
        />
      )}
    </div>
  );
}
