import { useState } from "react";
import { Download, Sparkles, FileText, ChevronDown, CheckSquare, Check, Clock, RotateCcw, Share2, Copy, CheckCheck } from "lucide-react";
import type { Project } from "../../data/projects";
import type { Athlete } from "../../data/athletes";
import type { Recipe } from "../../data/recipes";
import { relativeTime } from "../lib/utils";
import type { Run, ExportLogEntry } from "../lib/store";
import { supabase } from "../lib/supabase";

interface StatsOutputCounts {
  generated: number;
  approved: number;
  revision: number;
  flagged: number;
}

interface CampaignSidebarProps {
  project: Project;
  projAthletes: Athlete[];
  wf: Recipe | undefined;
  brief: string;
  setBrief: (b: string) => void;
  briefSaved: boolean;
  onBriefBlur: () => void;
  directionOpen: boolean;
  setDirectionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  checkedItems: Set<number>;
  setCheckedItems: React.Dispatch<React.SetStateAction<Set<number>>>;
  statsOutputCounts: StatsOutputCounts;
  exportLog: ExportLogEntry[];
  runs: Run[];
  showAllRuns: boolean;
  setShowAllRuns: React.Dispatch<React.SetStateAction<boolean>>;
  activeRunFilter: string | null;
  setActiveRunFilter: (id: string | null) => void;
  batchRunning: boolean;
  runBatch: () => void;
  rerunFromRun: (run: Run) => void;
  onLaunchStudio: (opts: { workspaceId?: string; workflowId?: string; athleteId?: string }) => void;
}

export function CampaignSidebar({
  project, projAthletes, wf, brief, setBrief, briefSaved, onBriefBlur,
  directionOpen, setDirectionOpen, checkedItems, setCheckedItems,
  statsOutputCounts, exportLog, runs, showAllRuns, setShowAllRuns,
  activeRunFilter, setActiveRunFilter, batchRunning, runBatch, rerunFromRun, onLaunchStudio,
}: CampaignSidebarProps) {
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    setReviewLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch("/api/review/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ campaignId: project.id }),
      });
      if (!res.ok) return;
      const { token } = await res.json() as { token: string };
      setReviewUrl(`${window.location.origin}/review/${token}`);
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleCopy() {
    if (!reviewUrl) return;
    await navigator.clipboard.writeText(reviewUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
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
              onChange={e => { setBrief(e.target.value); }}
              onBlur={onBriefBlur}
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
                        checked ? "bg-emerald-500/5 border-emerald-500/30" : "bg-card border-border hover:border-accent/40"
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
                { label: "Generated",  value: statsOutputCounts.generated },
                { label: "Approved",   value: statsOutputCounts.approved },
                { label: "Revision",   value: statsOutputCounts.revision },
                { label: "Flagged",    value: statsOutputCounts.flagged },
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

          {/* Run history */}
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

        {/* Share for review */}
        {!reviewUrl ? (
          <button onClick={handleShare} disabled={reviewLoading}
            className="w-full h-9 rounded-md bg-card border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
            <Share2 className="size-3.5" strokeWidth={1.75} />
            {reviewLoading ? "Creating link…" : "Share for review"}
          </button>
        ) : (
          <div className="rounded-md border border-border bg-card p-2 space-y-1.5">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Share2 className="size-3" strokeWidth={1.75} /> Review link — anyone with this URL can view
            </p>
            <div className="flex gap-1.5">
              <input
                readOnly
                value={reviewUrl}
                className="flex-1 min-w-0 text-[10px] bg-background border border-border rounded px-2 py-1 text-muted-foreground truncate"
              />
              <button onClick={handleCopy}
                className="shrink-0 px-2 py-1 rounded border border-border bg-background hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-[10px]">
                {copied ? <><CheckCheck className="size-3 text-emerald-500" /> Copied</> : <><Copy className="size-3" /> Copy</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
