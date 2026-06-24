import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Zap, Download, FolderPlus, Check, X, Eye, Pencil } from "lucide-react";
import {
  getProjects, getRuns, getJobs, updateRun, addRun, addJob, deductCredits,
  addCampaignOutput, getCampaignOutputs, getAthleteProfile, subscribeToStore,
  Run, GenerationJob,
} from "../lib/store";
import type { Project } from "../../data/projects";
import { toast } from "../lib/notifications";

type StatusFilter = "all" | "running" | "complete" | "failed";

interface RunRow extends Run {
  campaignName: string;
  previewUrl?: string;
}

function getAllRuns(): RunRow[] {
  const projects = getProjects();
  const outputs  = getCampaignOutputs();
  const rows: RunRow[] = [];
  for (const p of projects) {
    for (const r of getRuns(p.id)) {
      const previewUrl = r.assetIds.length > 0
        ? outputs.find(o => r.assetIds.includes(o.id))?.url
        : undefined;
      rows.push({ ...r, campaignName: p.name, previewUrl });
    }
  }
  for (const r of getRuns("studio")) {
    const previewUrl = r.assetIds.length > 0
      ? outputs.find(o => r.assetIds.includes(o.id))?.url
      : undefined;
    rows.push({ ...r, campaignName: "Studio", previewUrl });
  }
  return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_DOT: Record<Run["status"], string> = {
  running:  "bg-accent animate-pulse",
  complete: "bg-emerald-500",
  failed:   "bg-red-400",
};
const STATUS_TEXT: Record<Run["status"], string> = {
  running:  "text-accent",
  complete: "text-emerald-400",
  failed:   "text-red-400",
};
const STATUS_LABEL: Record<Run["status"], string> = {
  running: "Running", complete: "Done", failed: "Failed",
};

const JOB_DOT: Record<GenerationJob["status"], string> = {
  queued:   "bg-amber-400 animate-pulse",
  running:  "bg-accent animate-pulse",
  complete: "bg-emerald-500",
  failed:   "bg-red-400",
};
const JOB_TEXT: Record<GenerationJob["status"], string> = {
  queued: "text-amber-400", running: "text-accent", complete: "text-emerald-400", failed: "text-red-400",
};
const JOB_LABEL: Record<GenerationJob["status"], string> = {
  queued: "Queued", running: "Running", complete: "Done", failed: "Failed",
};

// ── Preview modal ─────────────────────────────────────────────────────────────

interface PreviewItem {
  url: string;
  label: string;
  aspectRatio?: string;
}

function PreviewModal({ item, onClose }: { item: PreviewItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-sm font-medium text-white">{item.label}</span>
          <div className="flex items-center gap-2">
            {item.aspectRatio && (
              <span className="text-xs text-white/50">{item.aspectRatio}</span>
            )}
            <a
              href={item.url}
              download
              target="_blank"
              rel="noreferrer"
              className="h-7 px-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-xs flex items-center gap-1.5 transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <Download className="size-3" strokeWidth={1.75} /> Download
            </a>
            <button
              onClick={onClose}
              className="h-7 w-7 rounded-md bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <X className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <img
          src={item.url}
          alt={item.label}
          className="w-full rounded-xl object-contain max-h-[80vh]"
        />
      </div>
    </div>
  );
}

// ── Edit modal ────────────────────────────────────────────────────────────────

interface EditItem {
  subjectId: string;
  subjectName: string;
  imageUrl: string;
  aspectRatio: string;
  campaignId: string;
}

function EditModal({ item, onClose, onSubmitted }: {
  item: EditItem;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [notes, setNotes]       = useState("");
  const [ratio, setRatio]       = useState(item.aspectRatio);
  const [loading, setLoading]   = useState(false);

  const RATIOS = ["9:16", "4:5", "1:1", "16:9", "3:4", "4:3"];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!notes.trim()) return;
    setLoading(true);
    try {
      const { getCanonicalReferences } = await import("../lib/store");
      const { submitGeneration }       = await import("../lib/generate");

      const profile  = getAthleteProfile(item.subjectId);
      const refs     = await getCanonicalReferences(profile);
      const runId    = `run-${crypto.randomUUID().slice(0, 8)}`;
      const jobId    = `job-${crypto.randomUUID().slice(0, 8)}`;
      const prompt   = notes.trim();

      addRun({
        id: runId, campaignId: item.campaignId,
        athleteId: item.subjectId, athleteName: item.subjectName,
        prompt, model: "Identity generation", aspectRatio: ratio,
        status: "running", startedAt: new Date().toISOString(), assetIds: [],
      });
      deductCredits(4);

      const { requestId, modelId } = await submitGeneration({
        prompt, aspectRatio: ratio, numImages: 1,
        referenceImageDataUrls: refs.length > 0 ? refs : undefined,
      });

      addJob({
        id: jobId, subjectId: item.subjectId, subjectName: item.subjectName,
        prompt, aspectRatio: ratio, modelId, requestId,
        status: "queued", progress: 5, resultUrls: [],
        startedAt: new Date().toISOString(), runId,
        campaignId: item.campaignId, mode: "image",
      });

      toast({ type: "info", title: "Refinement queued", body: `${item.subjectName} — generating in background` });
      onSubmitted();
    } catch (err: any) {
      toast({ type: "error", title: "Failed to submit", body: err?.message ?? "Retry" });
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-background border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
          <div>
            <p className="text-sm font-semibold">Refine generation</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.subjectName}</p>
          </div>
          <button onClick={onClose} className="size-7 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors">
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current image */}
          <div className="flex gap-4">
            <img src={item.imageUrl} alt="Current" className="w-20 rounded-lg object-cover shrink-0 self-start" />
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">What to change</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. stadium background, blue jersey, slam dunk pose…"
                  rows={3}
                  autoFocus
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50 resize-none leading-relaxed"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Aspect ratio</label>
                <div className="flex flex-wrap gap-1.5">
                  {RATIOS.map(r => (
                    <button
                      key={r}
                      onClick={() => setRatio(r)}
                      className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                        ratio === r ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40 hover:text-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!notes.trim() || loading}
            className="w-full h-10 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-sm font-medium transition-colors"
          >
            {loading ? "Submitting…" : "Generate refinement →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── QueuePage ─────────────────────────────────────────────────────────────────

interface QueuePageProps {
  onOpenStudio?: (opts: { athleteId?: string; campaignId?: string }) => void;
}

export function QueuePage({ onOpenStudio }: QueuePageProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [rows,   setRows]   = useState<RunRow[]>([]);
  const [jobs,   setJobs]   = useState<GenerationJob[]>([]);
  const [preview, setPreview] = useState<PreviewItem | null>(null);
  const [editItem, setEditItem] = useState<EditItem | null>(null);

  const refresh = useCallback(() => {
    setRows(getAllRuns());
    setJobs(getJobs());
  }, []);

  useEffect(() => {
    refresh();
    return subscribeToStore(refresh);
  }, [refresh]);

  const hasActive = rows.some(r => r.status === "running") || jobs.some(j => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!hasActive) return;
    const id = setInterval(refresh, 1500);
    return () => clearInterval(id);
  }, [hasActive, refresh]);

  const filteredRuns = rows.filter(r => filter === "all" || r.status === filter);
  const filteredJobs = jobs.filter(j => {
    if (filter === "running") return j.status === "queued" || j.status === "running";
    if (filter === "complete") return j.status === "complete";
    if (filter === "failed")   return j.status === "failed";
    return true;
  });

  const activeJobs = filteredJobs.filter(j => j.status === "queued" || j.status === "running");
  const doneJobs   = filteredJobs.filter(j => j.status === "complete" || j.status === "failed");

  const counts: Record<StatusFilter, number> = {
    all:      rows.length + jobs.length,
    running:  rows.filter(r => r.status === "running").length + jobs.filter(j => j.status === "queued" || j.status === "running").length,
    complete: rows.filter(r => r.status === "complete").length + jobs.filter(j => j.status === "complete").length,
    failed:   rows.filter(r => r.status === "failed").length  + jobs.filter(j => j.status === "failed").length,
  };

  const TABS: { key: StatusFilter; label: string }[] = [
    { key: "all",      label: "All"     },
    { key: "running",  label: "Running" },
    { key: "complete", label: "Done"    },
    { key: "failed",   label: "Failed"  },
  ];

  const showEmpty = filteredRuns.length === 0 && activeJobs.length === 0 && doneJobs.length === 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Runs</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Every generation across all campaigns</p>
          </div>
          <button onClick={refresh} className="size-8 rounded-md border border-border bg-card hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center" title="Refresh">
            <RefreshCw className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex gap-3">
          {[
            { label: "Total",     value: counts.all      },
            { label: "Completed", value: counts.complete  },
            { label: "Running",   value: counts.running   },
            { label: "Failed",    value: counts.failed    },
          ].map(s => (
            <div key={s.label} className="flex-1 rounded-lg bg-card border border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-semibold tracking-tight mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`h-8 px-2 rounded-md text-sm transition-colors flex items-center gap-1.5 ${filter === t.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-card"}`}
            >
              {t.label}
              <span className="text-xs text-muted-foreground/60">{counts[t.key]}</span>
            </button>
          ))}
        </div>

        {showEmpty ? (
          <div className="rounded-xl border border-border bg-card px-8 py-16 text-center">
            <div className="size-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4">
              <Zap className="size-5 text-accent" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-medium">No runs yet</p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-[240px] mx-auto">
              Generate from a campaign or the Studio to see your runs here.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {activeJobs.map(job => (
              <JobCard key={job.id} job={job} onRefresh={refresh}
                onPreview={setPreview} onEdit={setEditItem} />
            ))}
            {filteredRuns.map(run => (
              <RunCard key={run.id} run={run}
                onPreview={setPreview} onEdit={setEditItem} />
            ))}
            {doneJobs.map(job => (
              <JobCard key={job.id} job={job} onRefresh={refresh}
                onPreview={setPreview} onEdit={setEditItem} />
            ))}
          </div>
        )}
      </div>

      {preview && <PreviewModal item={preview} onClose={() => setPreview(null)} />}
      {editItem && (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSubmitted={() => { setEditItem(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ── JobCard ───────────────────────────────────────────────────────────────────

function JobCard({ job, onRefresh, onPreview, onEdit }: {
  job: GenerationJob;
  onRefresh: () => void;
  onPreview: (item: PreviewItem) => void;
  onEdit: (item: EditItem) => void;
}) {
  const isActive = job.status === "queued" || job.status === "running";
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const [addedToCampaign, setAddedToCampaign] = useState(false);
  const projects = getProjects().filter(p => p.type === "active");

  const handleAddToCampaign = (project: Project) => {
    if (!job.resultUrls[0]) return;
    const existing = getCampaignOutputs().find(
      o => o.originalFalUrl === job.resultUrls[0] && o.campaignId === (job.campaignId ?? "studio"),
    );
    if (existing) {
      import("../lib/store").then(({ updateCampaignOutput }) => {
        updateCampaignOutput(existing.id, { campaignId: project.id });
      });
    } else {
      addCampaignOutput({
        id:             `out-${crypto.randomUUID().slice(0, 8)}`,
        campaignId:     project.id,
        athleteId:      job.subjectId,
        runId:          job.runId,
        url:            job.resultUrls[0],
        originalFalUrl: job.resultUrls[0],
        status:         "pending",
        createdAt:      new Date().toISOString(),
      });
    }
    toast({ type: "success", title: "Added to campaign", body: project.name });
    setAddedToCampaign(true);
    setShowCampaignPicker(false);
  };

  return (
    <div className="bg-card px-4 py-3 flex items-start gap-4 hover:bg-secondary/30 transition-colors relative group">
      <span className={`size-2 rounded-full shrink-0 mt-1.5 ${JOB_DOT[job.status]}`} />

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">
            {job.subjectName ?? "No subject"}
          </span>
          {job.packName && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-violet-500/30 bg-violet-500/10 text-violet-400 font-medium">
              {job.packName}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate max-w-[400px]">{job.prompt.slice(0, 140)}</p>

        {isActive && (
          <div className="w-52 h-1 bg-border rounded-full overflow-hidden mt-1">
            <div className="h-full bg-accent transition-all duration-700" style={{ width: `${Math.max(4, job.progress)}%` }} />
          </div>
        )}

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-muted-foreground/70">{job.aspectRatio}</span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs text-muted-foreground/70">{relativeTime(job.startedAt)}</span>
          {isActive && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground/70">{job.progress}%</span>
            </>
          )}
          {job.error && <span className="text-xs text-red-400 truncate max-w-[200px]">{job.error}</span>}
        </div>

        {showCampaignPicker && (
          <div className="mt-2 rounded-lg border border-border bg-popover shadow-lg p-1 w-52 z-10">
            {projects.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1.5">No campaigns yet</p>
            ) : (
              projects.map(p => (
                <button key={p.id} onClick={() => handleAddToCampaign(p)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary text-left transition-colors">
                  <span className="flex-1 truncate">{p.name}</span>
                </button>
              ))
            )}
            <div className="border-t border-border mt-1 pt-1">
              <button onClick={() => setShowCampaignPicker(false)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground rounded hover:bg-secondary transition-colors">
                <X className="size-3" strokeWidth={1.75} /> Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Result thumbnail — clickable to preview */}
      {job.resultUrls[0] && (
        <button
          onClick={() => onPreview({ url: job.resultUrls[0], label: job.subjectName ?? "Result", aspectRatio: job.aspectRatio })}
          className="size-14 rounded-md overflow-hidden shrink-0 mt-0.5 ring-0 hover:ring-2 hover:ring-accent/50 transition-all"
        >
          <img src={job.resultUrls[0]} alt="Result" className="w-full h-full object-cover" />
        </button>
      )}

      <span className={`text-xs font-medium shrink-0 mt-1 ${JOB_TEXT[job.status]}`}>
        {JOB_LABEL[job.status]}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
        {job.resultUrls[0] && !isActive && (
          <>
            <button
              onClick={() => onPreview({ url: job.resultUrls[0], label: job.subjectName ?? "Result", aspectRatio: job.aspectRatio })}
              title="Preview"
              className="h-7 w-7 rounded-md border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            >
              <Eye className="size-3.5" strokeWidth={1.75} />
            </button>
            {job.subjectId && (
              <button
                onClick={() => onEdit({
                  subjectId: job.subjectId!,
                  subjectName: job.subjectName ?? "Subject",
                  imageUrl: job.resultUrls[0],
                  aspectRatio: job.aspectRatio,
                  campaignId: job.campaignId ?? "studio",
                })}
                title="Refine"
                className="h-7 w-7 rounded-md border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
              >
                <Pencil className="size-3" strokeWidth={1.75} />
              </button>
            )}
            <a
              href={job.resultUrls[0]}
              download target="_blank" rel="noreferrer"
              title="Download"
              className="h-7 w-7 rounded-md border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            >
              <Download className="size-3.5" strokeWidth={1.75} />
            </a>
            <button
              onClick={() => setShowCampaignPicker(v => !v)}
              title={addedToCampaign ? "Added" : "Add to campaign"}
              className={`h-7 w-7 rounded-md border border-border bg-background hover:bg-secondary transition-colors flex items-center justify-center ${addedToCampaign ? "text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
            >
              {addedToCampaign ? <Check className="size-3.5" strokeWidth={1.75} /> : <FolderPlus className="size-3.5" strokeWidth={1.75} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── RunCard ───────────────────────────────────────────────────────────────────

function RunCard({ run, onPreview, onEdit }: {
  run: RunRow;
  onPreview: (item: PreviewItem) => void;
  onEdit: (item: EditItem) => void;
}) {
  const modelLabel = run.model === "flux-schnell" ? "Draft" : run.model === "flux-dev" ? "Standard" : run.model === "flux-pro" ? "Premium" : run.model;

  return (
    <div className="bg-card px-4 py-3 flex items-center gap-4 group hover:bg-secondary/30 transition-colors">
      <span className={`size-2 rounded-full shrink-0 ${STATUS_DOT[run.status]}`} />

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium truncate">
            {run.athleteName ?? "No talent"}
          </span>
          {run.assetIds.length > 0 && (
            <span className="text-xs text-muted-foreground/60 shrink-0">{run.assetIds.length} image{run.assetIds.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate max-w-[300px]">{run.prompt}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground/70">{run.aspectRatio}</span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs text-muted-foreground/70">{modelLabel}</span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-xs text-muted-foreground/70">{relativeTime(run.startedAt)}</span>
          {run.errorMessage && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-red-400 truncate max-w-[200px]">{run.errorMessage}</span>
            </>
          )}
        </div>
      </div>

      {/* Preview thumbnail */}
      {run.previewUrl && (
        <button
          onClick={() => onPreview({ url: run.previewUrl!, label: run.athleteName ?? "Result", aspectRatio: run.aspectRatio })}
          className="size-14 rounded-md overflow-hidden shrink-0 ring-0 hover:ring-2 hover:ring-accent/50 transition-all"
        >
          <img src={run.previewUrl} alt="Preview" className="w-full h-full object-cover" />
        </button>
      )}

      <span className={`text-xs font-medium shrink-0 ${STATUS_TEXT[run.status]}`}>{STATUS_LABEL[run.status]}</span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {run.previewUrl && run.status === "complete" && (
          <>
            <button
              onClick={() => onPreview({ url: run.previewUrl!, label: run.athleteName ?? "Result", aspectRatio: run.aspectRatio })}
              title="Preview"
              className="h-7 w-7 rounded-md border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            >
              <Eye className="size-3.5" strokeWidth={1.75} />
            </button>
            {run.athleteId && (
              <button
                onClick={() => onEdit({
                  subjectId: run.athleteId!,
                  subjectName: run.athleteName ?? "Subject",
                  imageUrl: run.previewUrl!,
                  aspectRatio: run.aspectRatio,
                  campaignId: run.campaignId,
                })}
                title="Refine"
                className="h-7 w-7 rounded-md border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
              >
                <Pencil className="size-3" strokeWidth={1.75} />
              </button>
            )}
            <a
              href={run.previewUrl}
              download target="_blank" rel="noreferrer"
              title="Download"
              className="h-7 w-7 rounded-md border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
            >
              <Download className="size-3.5" strokeWidth={1.75} />
            </a>
          </>
        )}
      </div>
    </div>
  );
}
