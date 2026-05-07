import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Download, Sparkles } from "lucide-react";
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
import { downloadZip } from "../lib/utils";
import type { ApprovedLikeness } from "../../data/athletes";
import { AssetDetailPanel } from "./AssetDetailPanel";
import { CampaignGallery, type OutputTab } from "./CampaignGallery";
import { CampaignSidebar } from "./CampaignSidebar";

interface CampaignWorkspaceProps {
  project: Project;
  onBack: () => void;
  onLaunchStudio: (opts: { workspaceId?: string; workflowId?: string; athleteId?: string }) => void;
}

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

  const tabCounts = {
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
      id: runId, campaignId: project.id, athleteId: athlete?.id, athleteName: athlete?.name,
      recipeId: project.workflowId, recipeName: wf?.name, prompt,
      negativePrompt: wf?.negativePrompt || undefined, model: DEFAULT_IMAGE_MODEL.id,
      aspectRatio: wf?.aspectRatio ?? "9:16", status: "running",
      startedAt: new Date().toISOString(), assetIds: [],
    });
    refreshRuns();

    try {
      let capturedSeed: number | undefined;
      const result = await generateImage({
        prompt, negativePrompt: wf?.negativePrompt || undefined,
        aspectRatio: wf?.aspectRatio ?? "9:16", onSeed: s => { capturedSeed = s; },
      });
      const patch = { url: result[0].url, status: "pending" as OutputStatus, runId };
      updateCampaignOutput(output.id, patch);
      setOutputs(prev => prev.map(o => o.id === output.id ? { ...o, ...patch } : o));
      if (detailOutput?.id === output.id) setDetailOutput(prev => prev ? { ...prev, ...patch } : null);
      updateRun(project.id, runId, { status: "complete", seed: capturedSeed, completedAt: new Date().toISOString(), assetIds: [output.id] });
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
        id: runId, campaignId: project.id, athleteId: athlete.id, athleteName: athlete.name,
        recipeId: project.workflowId, recipeName: wf?.name, prompt: enrichedPrompt,
        negativePrompt: wf?.negativePrompt || undefined, model: DEFAULT_IMAGE_MODEL.id,
        aspectRatio: wf?.aspectRatio ?? "9:16", status: "running",
        startedAt: new Date().toISOString(), assetIds: [],
      });
      refreshRuns();

      try {
        let capturedSeed: number | undefined;
        const result = await generateImage({
          prompt: enrichedPrompt, negativePrompt: wf?.negativePrompt || undefined,
          aspectRatio: wf?.aspectRatio ?? "9:16", onSeed: s => { capturedSeed = s; },
        });

        if (result[0]?.url) {
          const outId = `out-${Date.now()}-${athlete.id}`;
          const out: CampaignOutput = {
            id: outId, campaignId: project.id, athleteId: athlete.id, runId,
            url: result[0].url, status: "pending", createdAt: new Date().toISOString(),
          };
          addCampaignOutput(out);
          updateRun(project.id, runId, { status: "complete", seed: capturedSeed, completedAt: new Date().toISOString(), assetIds: [outId] });
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
      id: newRunId, campaignId: project.id, athleteId: athlete.id, athleteName: athlete.name,
      recipeId: run.recipeId, recipeName: run.recipeName, prompt: run.prompt,
      negativePrompt: run.negativePrompt, model: run.model, aspectRatio: run.aspectRatio,
      status: "running", startedAt: new Date().toISOString(), assetIds: [],
    });
    refreshRuns();

    try {
      let capturedSeed: number | undefined;
      const result = await generateImage({
        prompt: run.prompt, negativePrompt: run.negativePrompt || undefined,
        aspectRatio: run.aspectRatio, seed: run.seed, onSeed: s => { capturedSeed = s; },
      });
      if (result[0]?.url) {
        const outId = `out-${Date.now()}-rerun`;
        addCampaignOutput({
          id: outId, campaignId: project.id, athleteId: athlete.id, runId: newRunId,
          url: result[0].url, status: "pending", createdAt: new Date().toISOString(),
        });
        updateRun(project.id, newRunId, { status: "complete", seed: capturedSeed, completedAt: new Date().toISOString(), assetIds: [outId] });
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
    saveAthleteProfile({ ...profile, approvedLikeness: [...profile.approvedLikeness, entry], version: profile.version + 1, updatedAt: new Date().toISOString() });
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
        <CampaignGallery
          visibleOutputs={visibleOutputs}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          tabCounts={tabCounts}
          activeRunFilter={activeRunFilter}
          setActiveRunFilter={setActiveRunFilter}
          batchRunning={batchRunning}
          batchProgress={batchProgress}
          runBatch={runBatch}
          onStatusChange={changeStatus}
          onRegenerate={regenerateOutput}
          onSelectOutput={setDetailOutput}
          onMarkLikeness={markAsLikeness}
        />
        <CampaignSidebar
          project={project}
          projAthletes={projAthletes}
          wf={wf}
          brief={brief}
          setBrief={setBrief}
          briefSaved={briefSaved}
          onBriefBlur={handleBriefBlur}
          directionOpen={directionOpen}
          setDirectionOpen={setDirectionOpen}
          checkedItems={checkedItems}
          setCheckedItems={setCheckedItems}
          statsOutputCounts={{
            generated: outputs.length,
            approved: tabCounts.approved,
            revision: tabCounts.needs_revision,
            flagged: tabCounts.flagged,
          }}
          exportLog={exportLog}
          runs={runs}
          showAllRuns={showAllRuns}
          setShowAllRuns={setShowAllRuns}
          activeRunFilter={activeRunFilter}
          setActiveRunFilter={setActiveRunFilter}
          batchRunning={batchRunning}
          runBatch={runBatch}
          rerunFromRun={rerunFromRun}
          onLaunchStudio={onLaunchStudio}
        />
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
