import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Download, Sparkles } from "lucide-react";
import { Project, type CampaignStatus } from "../../data/projects";
import { generateImage } from "../lib/generate";
import type { AthleteProfile } from "../../data/athletes";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/notifications";
import { scoreOutputWithRetry } from "../lib/store";
import { buildGenerationPrompt } from "../lib/promptEnhancer";
import { getCanonicalReferences } from "../lib/store";
import {
  getAthletes, getCampaignOutputs, addCampaignOutput, updateCampaignOutput,
  getAthleteProfile, saveAthleteProfile, createEmptyProfile,
  getProjects, getRuns, addRun, updateRun, updateProject, appendExportLog,
  setOutputStatus, addOutputComment, addOutputTag, removeOutputTag, addRejectedLikeness,
  canExportOutput, exportBlockReason, subscribeToStore, getUserRole,
  type CampaignOutput, type Run, type OutputStatus, type OutputComment, type ExportLogEntry,
} from "../lib/store";
import { can } from "../lib/permissions";
import { downloadZip } from "../lib/utils";
import {
  mirrorAsset, generatedAssetPath, likenessPath, ASSETS_BUCKET,
} from "../lib/storage";
import type { ApprovedLikeness } from "../../data/athletes";
import { AssetDetailPanel } from "./AssetDetailPanel";
import { CampaignGallery, type OutputTab } from "./CampaignGallery";
import { CampaignSidebar } from "./CampaignSidebar";
import { ComparePanel } from "./ComparePanel";

interface CampaignWorkspaceProps {
  project: Project;
  onBack: () => void;
  onLaunchStudio: (opts: { workspaceId?: string; athleteId?: string }) => void;
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
  const [reviewerUserId, setReviewerUserId] = useState("");
  const [brief, setBrief]               = useState(() => getProjects().find(p => p.id === project.id)?.brief ?? project.brief ?? "");
  const [briefSaved, setBriefSaved]     = useState(false);
  const briefSavedTimerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus>(
    () => (getProjects().find(p => p.id === project.id)?.status as CampaignStatus) ?? "draft"
  );
  const [exportLog, setExportLog] = useState<ExportLogEntry[]>(
    () => getProjects().find(p => p.id === project.id)?.exportLog ?? []
  );
  const [compareMode, setCompareMode]     = useState(false);
  const [compareIds, setCompareIds]       = useState<string[]>([]);
  const [showCompare, setShowCompare]     = useState(false);

  const projAthletes = getProjectAthletes(project);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setReviewerEmail(session.user.email);
      if (session?.user?.id)    setReviewerUserId(session.user.id);
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
    return subscribeToStore(() => { refreshOutputs(); refreshRuns(); });
  }, [refreshOutputs, refreshRuns]);

  // Poll store while any output is being scored — keeps React state in sync with scoring updates
  useEffect(() => {
    const hasPending = outputs.some(
      o => o.identityScoringStatus === "pending" || o.identityScoringStatus === "scoring",
    );
    if (!hasPending) return;
    const id = setInterval(refreshOutputs, 1000);
    return () => clearInterval(id);
  }, [outputs, refreshOutputs]);

  // Keep detailOutput in sync when the underlying output changes (e.g. scoring completes)
  useEffect(() => {
    if (!detailOutput) return;
    const updated = outputs.find(o => o.id === detailOutput.id);
    if (updated && updated !== detailOutput) setDetailOutput(updated);
  }, [outputs, detailOutput]);

  // Keyboard navigation for gallery review
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (showCompare) {
        if (e.key === "Escape") setShowCompare(false);
        return;
      }
      if (detailOutput) {
        if (e.key === "Escape") { setDetailOutput(null); return; }
        if (e.key === "j" || e.key === "J") { changeStatus(detailOutput.id, "approved"); return; }
        if (e.key === "k" || e.key === "K") { changeStatus(detailOutput.id, "rejected"); return; }
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          const idx = visibleOutputs.findIndex(o => o.id === detailOutput.id);
          if (idx < visibleOutputs.length - 1) setDetailOutput(visibleOutputs[idx + 1]);
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          const idx = visibleOutputs.findIndex(o => o.id === detailOutput.id);
          if (idx > 0) setDetailOutput(visibleOutputs[idx - 1]);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailOutput, visibleOutputs, showCompare]);

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

  const changeStatus = (id: string, status: OutputStatus, rejectionReason?: import("../lib/store").RejectionReason) => {
    if (!can(getUserRole(), "outputs:approve")) {
      toast({ type: "error", title: "Permission denied", body: "Your role cannot approve or reject outputs." });
      return;
    }
    const now = new Date().toISOString();
    setOutputStatus(id, status, reviewerEmail, rejectionReason);
    const patch: Partial<import("../lib/store").CampaignOutput> = { status, reviewedBy: reviewerEmail, reviewedAt: now };
    if (status === "rejected" && rejectionReason) patch.rejectionReason = rejectionReason;
    if (status !== "rejected") patch.rejectionReason = undefined;
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

  const handleCompareToggle = (id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 4) return prev; // cap at 4
      return [...prev, id];
    });
  };

  const handleCompareModeChange = (v: boolean) => {
    setCompareMode(v);
    if (!v) { setCompareIds([]); setShowCompare(false); }
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
    const runId = `run-${crypto.randomUUID().slice(0, 8)}-regen`;
    const regenConstraints = athlete ? (getAthleteProfile(athlete.id)?.doNotChange ?? []) : [];
    const prompt = buildGenerationPrompt({ doNotChange: regenConstraints.length ? regenConstraints : undefined });

    addRun({
      id: runId, campaignId: project.id, athleteId: athlete?.id, athleteName: athlete?.name,
      prompt, model: "nano-banana",
      aspectRatio: "9:16", status: "running",
      startedAt: new Date().toISOString(), assetIds: [],
    });
    refreshRuns();

    try {
      let capturedSeed: number | undefined;
      const _prof1 = getAthleteProfile(athlete ? athlete.id : "");
      const refDataUrl = await getCanonicalReferences(_prof1);
      const result = await generateImage({
        prompt,
        aspectRatio: "9:16", onSeed: s => { capturedSeed = s; },
        referenceImageDataUrls: refDataUrl.length > 0 ? refDataUrl : undefined,
      });
      const falUrl = result[0].url;
      const patch = { url: falUrl, originalFalUrl: falUrl, status: "pending" as OutputStatus, runId };
      updateCampaignOutput(output.id, patch);
      setOutputs(prev => prev.map(o => o.id === output.id ? { ...o, ...patch } : o));
      if (detailOutput?.id === output.id) setDetailOutput(prev => prev ? { ...prev, ...patch } : null);
      updateRun(project.id, runId, { status: "complete", seed: capturedSeed, completedAt: new Date().toISOString(), assetIds: [output.id] });
      if (reviewerUserId) {
        mirrorAsset(falUrl, generatedAssetPath(reviewerUserId, project.id, output.id))
          .then(stored => {
            if (stored?.signedUrl) {
              updateCampaignOutput(output.id, { url: stored.signedUrl, storagePath: stored.path });
              setOutputs(prev => prev.map(o => o.id === output.id ? { ...o, url: stored.signedUrl, storagePath: stored.path } : o));
              if (detailOutput?.id === output.id) setDetailOutput(prev => prev ? { ...prev, url: stored.signedUrl, storagePath: stored.path } : null);
            }
          })
          .catch(() => {});
      }
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
      const runId = `run-${crypto.randomUUID().slice(0, 8)}-${athlete.id}`;
      const batchConstraints = getAthleteProfile(athlete.id)?.doNotChange ?? [];
      const enrichedPrompt = buildGenerationPrompt({ doNotChange: batchConstraints.length ? batchConstraints : undefined });

      addRun({
        id: runId, campaignId: project.id, athleteId: athlete.id, athleteName: athlete.name,
        prompt: enrichedPrompt, model: "nano-banana",
        aspectRatio: "9:16", status: "running",
        startedAt: new Date().toISOString(), assetIds: [],
      });
      refreshRuns();

      try {
        let capturedSeed: number | undefined;
        const _prof2 = getAthleteProfile(athlete.id);
        const refDataUrl = await getCanonicalReferences(_prof2);
        const result = await generateImage({
          prompt: enrichedPrompt,
          aspectRatio: "9:16", onSeed: s => { capturedSeed = s; },
          referenceImageDataUrls: refDataUrl.length > 0 ? refDataUrl : undefined,
          });

        if (result[0]?.url) {
          const outId = `out-${crypto.randomUUID().slice(0, 8)}-${athlete.id}`;
          const falUrl = result[0].url;
          const out: CampaignOutput = {
            id: outId, campaignId: project.id, athleteId: athlete.id, runId,
            url: falUrl, originalFalUrl: falUrl, status: "pending", createdAt: new Date().toISOString(),
            identityScoringStatus: athlete.image ? "pending" : undefined,
          };
          addCampaignOutput(out);
          updateRun(project.id, runId, { status: "complete", seed: capturedSeed, completedAt: new Date().toISOString(), assetIds: [outId] });
          generated++;
          refreshOutputs();
          refreshRuns();

          // Mirror to permanent storage non-blocking — updates url once done
          if (reviewerUserId) {
            mirrorAsset(falUrl, generatedAssetPath(reviewerUserId, project.id, outId))
              .then(stored => {
                if (stored?.signedUrl) {
                  updateCampaignOutput(outId, { url: stored.signedUrl, storagePath: stored.path });
                  setOutputs(prev => prev.map(o => o.id === outId ? { ...o, url: stored.signedUrl, storagePath: stored.path } : o));
                }
              })
              .catch(() => {});
          }

          if (athlete.image) {
            scoreOutputWithRetry(outId, athlete.image, falUrl)
              .then(() => refreshOutputs())
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
    const newRunId = `run-${crypto.randomUUID().slice(0, 8)}-rerun`;
    addRun({
      id: newRunId, campaignId: project.id, athleteId: athlete.id, athleteName: athlete.name,
      prompt: run.prompt, negativePrompt: run.negativePrompt,
      model: run.model, aspectRatio: run.aspectRatio,
      status: "running", startedAt: new Date().toISOString(), assetIds: [],
    });
    refreshRuns();

    try {
      let capturedSeed: number | undefined;
      const _prof3 = getAthleteProfile(athlete.id);
      const refDataUrl = await getCanonicalReferences(_prof3);
      const result = await generateImage({
        prompt: run.prompt,
        aspectRatio: run.aspectRatio, seed: run.seed, onSeed: s => { capturedSeed = s; },
        referenceImageDataUrls: refDataUrl.length > 0 ? refDataUrl : undefined,
      });
      if (result[0]?.url) {
        const outId = `out-${crypto.randomUUID().slice(0, 8)}-rerun`;
        const falUrl = result[0].url;
        addCampaignOutput({
          id: outId, campaignId: project.id, athleteId: athlete.id, runId: newRunId,
          url: falUrl, originalFalUrl: falUrl, status: "pending", createdAt: new Date().toISOString(),
          identityScoringStatus: athlete.image ? "pending" : undefined,
        });
        updateRun(project.id, newRunId, { status: "complete", seed: capturedSeed, completedAt: new Date().toISOString(), assetIds: [outId] });
        refreshOutputs();
        toast({ type: "success", title: "Re-run complete", body: `New output for ${athlete.name}` });
        if (athlete.image) {
          scoreOutputWithRetry(outId, athlete.image, falUrl).then(() => refreshOutputs()).catch(() => {});
        }
        if (reviewerUserId) {
          mirrorAsset(falUrl, generatedAssetPath(reviewerUserId, project.id, outId))
            .then(stored => {
              if (stored?.signedUrl) {
                updateCampaignOutput(outId, { url: stored.signedUrl, storagePath: stored.path });
                refreshOutputs();
              }
            })
            .catch(() => {});
        }
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
      context: `Generated · ${new Date().toLocaleDateString()}`,
      approvedAt: new Date().toISOString(),
    };
    const profile = existing ?? createEmptyProfile(athlete.id);
    saveAthleteProfile({ ...profile, approvedLikeness: [...profile.approvedLikeness, entry], version: profile.version + 1, updatedAt: new Date().toISOString() });
    toast({ type: "success", title: "Likeness reference saved", body: `Added to ${athlete.name}'s identity profile` });
    // Mirror the source URL to the approved-likeness path in storage (non-blocking)
    const srcUrl = output.originalFalUrl ?? output.url;
    if (reviewerUserId && srcUrl && !srcUrl.startsWith("data:")) {
      mirrorAsset(srcUrl, likenessPath(reviewerUserId, athlete.id, "approved", output.id))
        .then(stored => {
          if (stored?.signedUrl) {
            // Patch the entry with the permanent URL
            const p = getAthleteProfile(athlete.id);
            if (p) {
              const updated = p.approvedLikeness.map(e => e.imageUrl === entry.imageUrl ? { ...e, imageUrl: stored.signedUrl } : e);
              saveAthleteProfile({ ...p, approvedLikeness: updated, version: p.version + 1, updatedAt: new Date().toISOString() });
            }
          }
        })
        .catch(() => {});
    }
  };

  const handleExport = async () => {
    if (!can(getUserRole(), "outputs:export")) {
      toast({ type: "error", title: "Permission denied", body: "Your role cannot export assets." });
      return;
    }
    const approved = outputs.filter(o => o.status === "approved");
    const exportable = approved.filter(canExportOutput);
    const blocked = approved.length - exportable.length;
    if (exportable.length === 0) {
      const blockedReasons = blocked > 0
        ? approved.filter(o => !canExportOutput(o)).map(o => exportBlockReason(o)).filter(Boolean)
        : [];
      const uniqueReasons = [...new Set(blockedReasons)];
      toast({
        type: "error",
        title: "Nothing export-ready",
        body: blocked > 0
          ? uniqueReasons.length > 0
            ? uniqueReasons.join("; ")
            : `${blocked} approved asset${blocked > 1 ? "s" : ""} blocked from export. Open each asset to review.`
          : "No approved assets to export.",
      });
      return;
    }
    if (blocked > 0) {
      const blockedReasons = approved.filter(o => !canExportOutput(o)).map(o => exportBlockReason(o)).filter(Boolean);
      const uniqueReasons = [...new Set(blockedReasons)];
      toast({
        type: "warning",
        title: `${blocked} asset${blocked > 1 ? "s" : ""} excluded from export`,
        body: uniqueReasons.length > 0
          ? uniqueReasons.join("; ")
          : `${blocked} asset${blocked > 1 ? "s" : ""} blocked. ${exportable.length} export-ready asset${exportable.length > 1 ? "s" : ""} will be included.`,
      });
    }
    setIsExporting(true);
    try {
      await downloadZip(
        exportable.map((o, i) => ({
          url: o.url,
          filename: `${project.name.replace(/\s+/g, "-").toLowerCase()}-${i + 1}.jpg`,
          meta: { id: o.id, status: o.status, athleteId: o.athleteId, createdAt: o.createdAt },
        })),
        `${project.name.replace(/\s+/g, "-").toLowerCase()}-approved.zip`,
      );
      const entry: ExportLogEntry = {
        exportedAt: new Date().toISOString(),
        exportedBy: reviewerEmail,
        assetCount: exportable.length,
      };
      appendExportLog(project.id, entry);
      setExportLog(prev => [entry, ...prev]);
    } finally {
      setIsExporting(false);
    }
  };

  const handleMarkRejectedLikeness = (output: CampaignOutput) => {
    if (!output.athleteId) return;
    const athlete = getAthletes().find(a => a.id === output.athleteId);
    addRejectedLikeness(output.athleteId, {
      imageUrl: output.url,
      context: `Generated · ${new Date().toLocaleDateString()}`,
      rejectedAt: new Date().toISOString(),
    });
    toast({ type: "success", title: "Rejected likeness saved", body: `Added to ${athlete?.name ?? "athlete"}'s profile as what to avoid` });
    // Mirror to rejected-likeness path in storage (non-blocking)
    const srcUrl = output.originalFalUrl ?? output.url;
    if (reviewerUserId && output.athleteId && srcUrl && !srcUrl.startsWith("data:")) {
      mirrorAsset(srcUrl, likenessPath(reviewerUserId, output.athleteId, "rejected", output.id))
        .then(stored => {
          if (stored?.signedUrl) {
            // Patch the last rejected entry with the permanent URL
            const p = getAthleteProfile(output.athleteId!);
            if (p?.rejectedLikeness?.length) {
              const entries = [...p.rejectedLikeness];
              const last = entries[entries.length - 1];
              if (last.imageUrl === output.url) {
                entries[entries.length - 1] = { ...last, imageUrl: stored.signedUrl };
                saveAthleteProfile({ ...p, rejectedLikeness: entries, version: p.version + 1, updatedAt: new Date().toISOString() });
              }
            }
          }
        })
        .catch(() => {});
    }
  };

  const handleRetryScoring = (output: CampaignOutput) => {
    const athlete = output.athleteId ? getAthletes().find(a => a.id === output.athleteId) : undefined;
    const referenceUrl = athlete?.image;
    const generatedUrl = output.originalFalUrl ?? output.url;
    if (!referenceUrl || !generatedUrl) return;
    updateCampaignOutput(output.id, { identityScoringStatus: "pending", identityScoringError: undefined });
    scoreOutputWithRetry(output.id, referenceUrl, generatedUrl)
      .then(() => refreshOutputs())
      .catch(() => {});
  };

  const detailRun = detailOutput?.runId ? runs.find(r => r.id === detailOutput.runId) : undefined;
  const detailAthlete = detailOutput?.athleteId ? getAthletes().find(a => a.id === detailOutput.athleteId) : undefined;
  const approvedCount = tabCounts.approved;
  const exportableCount = outputs.filter(o => o.status === "approved" && canExportOutput(o)).length;
  const exportBlockedCount = approvedCount - exportableCount;

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
          <button
            onClick={handleExport}
            disabled={approvedCount === 0 || isExporting}
            title={exportBlockedCount > 0 ? `${exportBlockedCount} approved asset${exportBlockedCount > 1 ? "s" : ""} excluded — score or approval gate` : undefined}
            className="h-8 px-2 rounded-md bg-card border border-border hover:bg-secondary text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            <Download className="size-3.5" strokeWidth={1.75} />
            {isExporting
              ? "Exporting…"
              : exportableCount > 0
                ? `Export ${exportableCount}${exportBlockedCount > 0 ? ` (${exportBlockedCount} blocked)` : ""}`
                : approvedCount > 0 ? `Export (${approvedCount} blocked)` : "Export"
            }
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
          compareMode={compareMode}
          setCompareMode={handleCompareModeChange}
          compareIds={compareIds}
          onCompareToggle={handleCompareToggle}
          onCompareOpen={() => setShowCompare(true)}
        />
        <CampaignSidebar
          project={project}
          projAthletes={projAthletes}
          brief={brief}
          setBrief={setBrief}
          briefSaved={briefSaved}
          onBriefBlur={handleBriefBlur}
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
          onRetryScoring={handleRetryScoring}
        />
      )}

      {showCompare && compareIds.length >= 2 && (
        <ComparePanel
          outputs={outputs.filter(o => compareIds.includes(o.id))}
          onClose={() => setShowCompare(false)}
          onStatusChange={changeStatus}
          onMarkLikeness={markAsLikeness}
          onSelectOutput={output => { setShowCompare(false); setDetailOutput(output); }}
        />
      )}
    </div>
  );
}
