import { useState } from "react";
import { useRefreshableUrl } from "../lib/useRefreshableUrl";
import { updateCampaignOutput } from "../lib/store";
import { X, RefreshCw, Bookmark, Info, PenLine, Flag, MessageSquare, Tag, Plus, Download, ThumbsDown, History, ChevronDown } from "lucide-react";
import type { Athlete } from "../../data/athletes";
import type { Run } from "../lib/store";
import { type CampaignOutput, type OutputStatus, type OutputComment, type ReviewHistoryEntry, type RejectionReason, REJECTION_REASON_LABELS, getIdentityMatchTier, canExportOutput } from "../lib/store";
import { relativeTime, downloadUrl } from "../lib/utils";

interface AssetDetailPanelProps {
  output: CampaignOutput;
  run?: Run;
  athlete?: Athlete;
  reviewerEmail: string;
  onClose: () => void;
  onStatusChange: (id: string, status: OutputStatus, rejectionReason?: RejectionReason) => void;
  onRegenerate: (output: CampaignOutput) => void;
  onMarkLikeness: (output: CampaignOutput) => void;
  onMarkRejectedLikeness?: (output: CampaignOutput) => void;
  onCommentAdded: (outputId: string, comment: OutputComment) => void;
  onTagAdded?: (outputId: string, tag: string) => void;
  onTagRemoved?: (outputId: string, tag: string) => void;
  onRetryScoring?: (output: CampaignOutput) => void;
}


const STATUS_OPTIONS: { status: OutputStatus; label: string; active: string; inactive: string }[] = [
  {
    status: "pending",
    label: "Pending",
    active: "bg-secondary text-foreground border-border",
    inactive: "border-border text-muted-foreground hover:text-foreground hover:bg-secondary",
  },
  {
    status: "approved",
    label: "Approve",
    active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    inactive: "border-border text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/40",
  },
  {
    status: "needs_revision",
    label: "Revision",
    active: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    inactive: "border-border text-muted-foreground hover:text-blue-400 hover:border-blue-500/40",
  },
  {
    status: "flagged",
    label: "Flag",
    active: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    inactive: "border-border text-muted-foreground hover:text-amber-400 hover:border-amber-500/40",
  },
  {
    status: "rejected",
    label: "Reject",
    active: "bg-red-500/20 text-red-400 border-red-500/40",
    inactive: "border-border text-muted-foreground hover:text-red-400 hover:border-red-500/40",
  },
];

const STATUS_BADGE: Record<OutputStatus, string> = {
  pending:        "bg-secondary text-muted-foreground",
  approved:       "bg-emerald-500/20 text-emerald-400",
  needs_revision: "bg-blue-500/20 text-blue-400",
  flagged:        "bg-amber-500/20 text-amber-400",
  rejected:       "bg-red-500/20 text-red-400",
};

const STATUS_LABEL: Record<OutputStatus, string> = {
  pending:        "Pending",
  approved:       "Approved",
  needs_revision: "Needs revision",
  flagged:        "Flagged",
  rejected:       "Rejected",
};

export function AssetDetailPanel({
  output, run, athlete, reviewerEmail,
  onClose, onStatusChange, onRegenerate, onMarkLikeness, onMarkRejectedLikeness, onCommentAdded,
  onTagAdded, onTagRemoved, onRetryScoring,
}: AssetDetailPanelProps) {
  const [commentText, setCommentText] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const handlePost = () => {
    const text = commentText.trim();
    if (!text) return;
    onCommentAdded(output.id, {
      id: `cmt-${Date.now()}`,
      text,
      author: reviewerEmail || "unknown",
      createdAt: new Date().toISOString(),
    });
    setCommentText("");
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag) return;
    onTagAdded?.(output.id, tag);
    setTagInput("");
  };

  const { src: imgSrc, onError: imgOnError } = useRefreshableUrl(
    output.url,
    output.storagePath,
    (newUrl) => updateCampaignOutput(output.id, { url: newUrl }),
  );

  const comments = output.comments ?? [];
  const tags = output.tags ?? [];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-popover border border-border rounded-xl overflow-hidden flex max-w-3xl w-full max-h-[90vh]"
      >
        {/* Image */}
        <div className="w-64 shrink-0 bg-black">
          <img src={imgSrc} onError={imgOnError} alt="" className="w-full h-full object-contain" />
        </div>

        {/* Panel */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Header */}
          <div className="px-5 py-3.5 flex items-center justify-between border-b border-border shrink-0 gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className={`h-5 px-2 rounded-full text-xs font-medium flex items-center shrink-0 ${STATUS_BADGE[output.status]}`}>
                {STATUS_LABEL[output.status]}
              </span>
              {(() => {
                const score = output.resemblanceScore;
                const effectiveStatus = output.identityScoringStatus
                  ?? (score !== undefined ? "complete" : undefined);

                if (effectiveStatus === "pending" || effectiveStatus === "scoring") {
                  return (
                    <span className="h-5 px-2 rounded-full text-xs font-medium flex items-center gap-1 shrink-0 bg-secondary text-muted-foreground">
                      <RefreshCw className="size-2.5 animate-spin" strokeWidth={2} />
                      Scoring…
                    </span>
                  );
                }
                if (effectiveStatus === "complete" && score !== undefined) {
                  const tier = getIdentityMatchTier(score);
                  return (
                    <span
                      className={`h-5 px-2 rounded-full text-xs font-medium flex items-center gap-1 shrink-0 border ${tier.bgClass} ${tier.textClass} ${tier.borderClass}`}
                      title={tier.recommendedUse}
                    >
                      {score}% · {tier.label}
                    </span>
                  );
                }
                if (effectiveStatus === "failed") {
                  return (
                    <span className="h-5 px-2 rounded-full text-xs font-medium flex items-center gap-1 shrink-0 bg-red-500/20 text-red-400">
                      Score failed
                      {onRetryScoring && (
                        <button
                          onClick={() => onRetryScoring(output)}
                          title="Retry identity score"
                          className="ml-0.5 hover:text-red-300 transition-colors"
                        >
                          <RefreshCw className="size-2.5" strokeWidth={2} />
                        </button>
                      )}
                    </span>
                  );
                }
                return null;
              })()}
              {output.reviewedBy && output.reviewedAt && (
                <span className="text-[10px] text-muted-foreground truncate">
                  by {output.reviewedBy.split("@")[0]} · {relativeTime(output.reviewedAt)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground/40 mr-1 hidden sm:block">
                ← → navigate · J approve · K reject · Esc close
              </span>
              <button
                onClick={() => downloadUrl(output.url, `asset-${output.id}.jpg`)}
                title="Download image"
                className="size-7 rounded-md flex items-center justify-center hover:bg-secondary"
              >
                <Download className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
              </button>
              <button
                onClick={onClose}
                className="size-7 rounded-md flex items-center justify-center hover:bg-secondary"
              >
                <X className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Scroll area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">

            {/* Talent */}
            {athlete && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Talent</p>
                <div className="flex items-center gap-2.5">
                  <img
                    src={athlete.image.startsWith("blob:") ? "/athletes/placeholder.jpg" : athlete.image}
                    alt={athlete.name}
                    className="size-8 rounded-md object-cover"
                  />
                  <div>
                    <p className="text-sm font-medium">{athlete.name}</p>
                    <p className="text-xs text-muted-foreground">{athlete.sport}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Subject approval notice */}
            {output.subjectApprovalStatus === "rejected" && (
              <div className="rounded-md px-3 py-2.5 border text-xs space-y-0.5 bg-red-500/10 border-red-500/25">
                <p className="font-medium text-red-400">Talent rejected — export blocked</p>
                {output.subjectRejectionNote && (
                  <p className="text-muted-foreground">"{output.subjectRejectionNote}"</p>
                )}
              </div>
            )}
            {output.subjectApprovalStatus === "pending" && (
              <div className="rounded-md px-3 py-2.5 border text-xs space-y-0.5 bg-amber-500/10 border-amber-500/25">
                <p className="font-medium text-amber-400">Awaiting talent approval</p>
                <p className="text-muted-foreground">Export is blocked until the talent approves this likeness.</p>
              </div>
            )}
            {output.subjectApprovalStatus === "approved" && (
              <div className="rounded-md px-3 py-2.5 border text-xs space-y-0.5 bg-emerald-500/10 border-emerald-500/25">
                <p className="font-medium text-emerald-400">Talent approved</p>
                {output.subjectApprovalBy && (
                  <p className="text-muted-foreground">Approved by {output.subjectApprovalBy}</p>
                )}
              </div>
            )}

            {/* Export restriction notice (score gate) */}
            {output.resemblanceScore !== undefined && !canExportOutput(output) && output.subjectApprovalStatus !== "rejected" && output.subjectApprovalStatus !== "pending" && (() => {
              const tier = getIdentityMatchTier(output.resemblanceScore);
              return (
                <div className={`rounded-md px-3 py-2.5 border text-xs space-y-0.5 ${tier.bgClass} ${tier.borderClass}`}>
                  <p className={`font-medium ${tier.textClass}`}>{tier.label} — export restricted</p>
                  <p className="text-muted-foreground">{tier.restrictionReason}</p>
                </div>
              );
            })()}

            {/* Tags */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="size-3" strokeWidth={1.75} />
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 h-6 px-2 rounded-full bg-secondary border border-border text-xs text-muted-foreground group"
                  >
                    {tag}
                    {onTagRemoved && (
                      <button
                        onClick={() => onTagRemoved(output.id, tag)}
                        className="size-3 flex items-center justify-center rounded-full hover:bg-card hover:text-foreground transition-colors opacity-60 group-hover:opacity-100"
                      >
                        <X className="size-2.5" strokeWidth={2} />
                      </button>
                    )}
                  </span>
                ))}
                {onTagAdded && (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                      placeholder="Add tag…"
                      className="h-6 w-24 px-2 bg-card border border-border rounded-full text-xs focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
                    />
                    <button
                      onClick={handleAddTag}
                      disabled={!tagInput.trim()}
                      className="size-6 rounded-full bg-card border border-border hover:bg-secondary disabled:opacity-40 flex items-center justify-center transition-colors"
                    >
                      <Plus className="size-3" strokeWidth={2} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Generation lineage */}
            {run ? (
              <>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Generation lineage</p>
                  <div className="bg-card border border-border rounded-md overflow-hidden text-xs">
                    {[
                      { label: "Recipe",       value: run.recipeName ?? "—" },
                      { label: "Model",        value: run.model },
                      { label: "Aspect ratio", value: run.aspectRatio },
                      { label: "Seed",         value: run.seed !== undefined ? String(run.seed) : "random" },
                      { label: "Generated",    value: relativeTime(run.startedAt) },
                    ].map((row, i, arr) => (
                      <div
                        key={row.label}
                        className={`flex justify-between px-3 py-2 ${i < arr.length - 1 ? "border-b border-border" : ""}`}
                      >
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium truncate ml-4 text-right">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Prompt used</p>
                  <p className="text-xs text-muted-foreground leading-relaxed bg-card border border-border rounded-md p-3">
                    {run.prompt}
                  </p>
                </div>

                {run.negativePrompt && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Negative prompt</p>
                    <p className="text-xs text-muted-foreground leading-relaxed bg-card border border-border rounded-md p-3">
                      {run.negativePrompt}
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

            {/* Comments */}
            <div className="space-y-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="size-3" strokeWidth={1.75} />
                Comments
                {comments.length > 0 && (
                  <span className="ml-auto text-muted-foreground/60">{comments.length}</span>
                )}
              </p>

              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No comments yet.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="size-6 rounded-full bg-secondary flex items-center justify-center shrink-0 text-[10px] font-semibold text-muted-foreground">
                        {c.author.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-medium truncate">{c.author.split("@")[0]}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{relativeTime(c.createdAt)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-0.5">
                <input
                  type="text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handlePost(); }}
                  placeholder="Leave a comment…"
                  className="flex-1 h-8 px-2 bg-card border border-border rounded-md text-xs focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
                />
                <button
                  onClick={handlePost}
                  disabled={!commentText.trim()}
                  className="h-8 px-2 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-xs font-medium transition-colors"
                >
                  Post
                </button>
              </div>
            </div>
            {/* Review history */}
            {(output.reviewHistory?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setHistoryOpen(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full"
                >
                  <History className="size-3" strokeWidth={1.75} />
                  Review history
                  <span className="ml-auto text-muted-foreground/60">{output.reviewHistory?.length ?? 0}</span>
                  <ChevronDown className={`size-3 transition-transform duration-150 ${historyOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
                </button>
                {historyOpen && (
                  <div className="space-y-1.5">
                    {output.reviewHistory?.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={`h-4 px-1.5 rounded text-[10px] font-medium shrink-0 ${STATUS_BADGE[entry.status]}`}>
                          {entry.status.replace("_", " ")}
                        </span>
                        <span className="truncate">{entry.by.split("@")[0]}</span>
                        <span className="shrink-0 text-muted-foreground/50">{relativeTime(entry.at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-border space-y-2 shrink-0">
            {/* Status selector */}
            <div className="flex gap-1">
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.status}
                  onClick={() => onStatusChange(output.id, opt.status)}
                  className={`flex-1 h-7 rounded-md text-xs font-medium border transition-colors ${
                    output.status === opt.status ? opt.active : opt.inactive
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Rejection reason — only shown when status is rejected */}
            {output.status === "rejected" && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Reason:</span>
                <select
                  value={output.rejectionReason ?? ""}
                  onChange={e => onStatusChange(output.id, "rejected", (e.target.value as RejectionReason) || undefined)}
                  className="flex-1 h-7 px-2 bg-card border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-red-500/50 appearance-none"
                >
                  <option value="">— select reason —</option>
                  {(Object.keys(REJECTION_REASON_LABELS) as RejectionReason[]).map(r => (
                    <option key={r} value={r}>{REJECTION_REASON_LABELS[r]}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Secondary actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { onRegenerate(output); onClose(); }}
                className="flex-1 h-8 rounded-md bg-card border border-border hover:bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="size-3" strokeWidth={1.75} /> Regenerate
              </button>
              {output.athleteId && (
                <button
                  onClick={() => onMarkLikeness(output)}
                  title="Save as approved likeness reference"
                  className="h-8 px-2 rounded-md bg-card border border-border hover:bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Bookmark className="size-3" strokeWidth={1.75} /> Likeness ✓
                </button>
              )}
              {output.athleteId && onMarkRejectedLikeness && (
                <button
                  onClick={() => onMarkRejectedLikeness(output)}
                  title="Mark as rejected likeness — what to avoid"
                  className="h-8 px-2 rounded-md bg-card border border-border hover:bg-red-500/10 hover:border-red-500/40 text-muted-foreground hover:text-red-400 text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <ThumbsDown className="size-3" strokeWidth={1.75} /> Reject
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
