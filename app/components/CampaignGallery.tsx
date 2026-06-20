import { Sparkles, Check, X, PenLine, Flag, RefreshCw, Bookmark, Columns2, AlertCircle } from "lucide-react";
import { getAthletes, updateCampaignOutput, getIdentityMatchTier, type CampaignOutput, type OutputStatus } from "../lib/store";
import { useRefreshableUrl } from "../lib/useRefreshableUrl";

export type OutputTab = "all" | "approved" | "pending" | "needs_revision" | "flagged" | "rejected";

export const TAB_LABELS: Record<OutputTab, string> = {
  all:            "All",
  approved:       "Approved",
  pending:        "Pending",
  needs_revision: "Revision",
  flagged:        "Flagged",
  rejected:       "Rejected",
};

interface OutputCardProps {
  output: CampaignOutput;
  compareMode: boolean;
  compareIds: string[];
  batchRunning: boolean;
  onSelect: () => void;
  onCompareToggle: () => void;
  onStatusChange: (status: OutputStatus) => void;
  onRegenerate: () => void;
  onMarkLikeness: () => void;
}

function OutputCard({
  output, compareMode, compareIds, batchRunning,
  onSelect, onCompareToggle, onStatusChange, onRegenerate, onMarkLikeness,
}: OutputCardProps) {
  const athlete = getAthletes().find(a => a.id === output.athleteId);
  const { src, onError } = useRefreshableUrl(
    output.url,
    output.storagePath,
    (newUrl) => updateCampaignOutput(output.id, { url: newUrl }),
  );
  const selected = compareIds.includes(output.id);

  return (
    <div className={`group relative rounded-lg overflow-hidden border transition-all ${
      compareMode && selected
        ? "ring-2 ring-accent border-accent/60"
        : cardBorderClass(output.status)
    }`}>
      <div className="aspect-[3/4] relative overflow-hidden">
        <button
          onClick={() => compareMode ? onCompareToggle() : onSelect()}
          className="absolute inset-0 w-full h-full"
          title={compareMode ? "Select for comparison" : "View details"}
        >
          <img src={src} onError={onError} alt="" className="w-full h-full object-cover" />
        </button>

        {compareMode && (
          <div className={`absolute top-2 left-2 size-5 rounded-full border-2 flex items-center justify-center pointer-events-none transition-colors ${
            selected ? "bg-accent border-accent" : "bg-black/40 border-white/40"
          }`}>
            {selected && <Check className="size-3 text-white" strokeWidth={3} />}
          </div>
        )}

        {!compareMode && output.status === "approved" && (
          <div className="absolute top-2 right-2 size-5 rounded-full bg-emerald-500 flex items-center justify-center pointer-events-none">
            <Check className="size-3 text-white" strokeWidth={2.5} />
          </div>
        )}
        {!compareMode && output.status === "rejected" && (
          <div className="absolute top-2 right-2 size-5 rounded-full bg-red-500 flex items-center justify-center pointer-events-none">
            <X className="size-3 text-white" strokeWidth={2.5} />
          </div>
        )}
        {!compareMode && output.status === "needs_revision" && (
          <div className="absolute top-2 right-2 size-5 rounded-full bg-blue-500 flex items-center justify-center pointer-events-none">
            <PenLine className="size-2.5 text-white" strokeWidth={2.5} />
          </div>
        )}
        {!compareMode && output.status === "flagged" && (
          <div className="absolute top-2 right-2 size-5 rounded-full bg-amber-500 flex items-center justify-center pointer-events-none">
            <Flag className="size-2.5 text-white" strokeWidth={2.5} />
          </div>
        )}
        {(output.comments?.length ?? 0) > 0 && (
          <div className="absolute top-2 left-2 h-4 px-1.5 rounded bg-black/60 backdrop-blur-sm flex items-center gap-1 pointer-events-none">
            <span className="text-[9px] text-white/80">{output.comments!.length}</span>
          </div>
        )}

        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between pointer-events-none">
          {athlete && (
            <div className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] text-white/90 leading-tight">
              {athlete.name.split(" ")[0]}
            </div>
          )}
          {(() => {
            const score = output.resemblanceScore;
            const scoringStatus = output.identityScoringStatus
              ?? (score !== undefined ? "complete" : undefined);
            if (scoringStatus === "pending" || scoringStatus === "scoring") {
              return (
                <div className="px-1 py-0.5 rounded bg-black/60 backdrop-blur-sm flex items-center">
                  <RefreshCw className="size-2.5 text-white/60 animate-spin" strokeWidth={2} />
                </div>
              );
            }
            if (scoringStatus === "complete" && score !== undefined) {
              const tier = getIdentityMatchTier(score);
              return (
                <div
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium leading-tight ${tier.overlayClass}`}
                  title={`${tier.label} — ${tier.recommendedUse}`}
                >
                  {score}%
                </div>
              );
            }
            if (scoringStatus === "failed") {
              return (
                <div className="px-1 py-0.5 rounded bg-red-500/60 backdrop-blur-sm flex items-center" title="Identity score failed — open to retry">
                  <AlertCircle className="size-2.5 text-white" strokeWidth={2} />
                </div>
              );
            }
            return null;
          })()}
        </div>

        <div className={`absolute inset-0 bg-black/40 opacity-0 transition-opacity flex items-end justify-center pb-3 gap-1.5 ${compareMode ? "hidden" : "group-hover:opacity-100"}`}>
          <button onClick={e => { e.stopPropagation(); onStatusChange("approved"); }} title="Approve"
            className="size-8 rounded-full bg-emerald-500/90 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors">
            <Check className="size-3.5" strokeWidth={2.5} />
          </button>
          <button onClick={e => { e.stopPropagation(); onStatusChange("needs_revision"); }} title="Needs revision"
            className="size-8 rounded-full bg-blue-500/90 hover:bg-blue-500 text-white flex items-center justify-center transition-colors">
            <PenLine className="size-3.5" strokeWidth={2} />
          </button>
          <button onClick={e => { e.stopPropagation(); onStatusChange("flagged"); }} title="Flag"
            className="size-8 rounded-full bg-amber-500/90 hover:bg-amber-500 text-white flex items-center justify-center transition-colors">
            <Flag className="size-3.5" strokeWidth={2} />
          </button>
          <button onClick={e => { e.stopPropagation(); onStatusChange("rejected"); }} title="Reject"
            className="size-8 rounded-full bg-red-500/90 hover:bg-red-500 text-white flex items-center justify-center transition-colors">
            <X className="size-3.5" strokeWidth={2.5} />
          </button>
          <button onClick={e => { e.stopPropagation(); onRegenerate(); }} title="Regenerate"
            disabled={batchRunning}
            className="size-8 rounded-full bg-black/60 hover:bg-black/80 disabled:opacity-40 text-white flex items-center justify-center transition-colors">
            <RefreshCw className="size-3.5" strokeWidth={1.75} />
          </button>
          {output.athleteId && (
            <button onClick={e => { e.stopPropagation(); onMarkLikeness(); }} title="Save as likeness reference"
              className="size-8 rounded-full bg-black/60 hover:bg-accent text-white flex items-center justify-center transition-colors">
              <Bookmark className="size-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
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

interface CampaignGalleryProps {
  visibleOutputs: CampaignOutput[];
  activeTab: OutputTab;
  setActiveTab: (tab: OutputTab) => void;
  tabCounts: Record<OutputTab, number>;
  activeRunFilter: string | null;
  setActiveRunFilter: (id: string | null) => void;
  batchRunning: boolean;
  batchProgress: number;
  runBatch: () => void;
  onStatusChange: (id: string, status: OutputStatus) => void;
  onRegenerate: (output: CampaignOutput) => void;
  onSelectOutput: (output: CampaignOutput) => void;
  onMarkLikeness: (output: CampaignOutput) => void;
  compareIds: string[];
  onCompareToggle: (id: string) => void;
  onCompareOpen: () => void;
  compareMode: boolean;
  setCompareMode: (v: boolean) => void;
}

export function CampaignGallery({
  visibleOutputs, activeTab, setActiveTab, tabCounts, activeRunFilter, setActiveRunFilter,
  batchRunning, batchProgress, runBatch, onStatusChange, onRegenerate, onSelectOutput, onMarkLikeness,
  compareIds, onCompareToggle, onCompareOpen, compareMode, setCompareMode,
}: CampaignGalleryProps) {
  return (
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
        <div className="flex items-center gap-1.5 shrink-0">
          {compareMode && compareIds.length >= 2 && (
            <button
              onClick={onCompareOpen}
              className="h-7 px-3 rounded-md text-xs font-medium bg-accent hover:bg-accent/90 text-accent-foreground transition-colors flex items-center gap-1.5">
              <Columns2 className="size-3" strokeWidth={2} />
              Compare {compareIds.length}
            </button>
          )}
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`h-7 px-2.5 rounded-md text-xs transition-colors flex items-center gap-1.5 ${
              compareMode ? "bg-accent/15 text-accent border border-accent/30" : "text-muted-foreground hover:text-foreground hover:bg-card"
            }`}>
            <Columns2 className="size-3" strokeWidth={1.75} />
            {compareMode ? "Exit compare" : "Compare"}
          </button>
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
            {visibleOutputs.map(output => (
              <OutputCard
                key={output.id}
                output={output}
                compareMode={compareMode}
                compareIds={compareIds}
                batchRunning={batchRunning}
                onSelect={() => onSelectOutput(output)}
                onCompareToggle={() => onCompareToggle(output.id)}
                onStatusChange={status => onStatusChange(output.id, status)}
                onRegenerate={() => onRegenerate(output)}
                onMarkLikeness={() => onMarkLikeness(output)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
