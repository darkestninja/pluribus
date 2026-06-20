import { X, Check, PenLine, Flag, Bookmark } from "lucide-react";
import { getAthletes, getIdentityMatchTier, type CampaignOutput, type OutputStatus } from "../lib/store";

const STATUS_BADGE: Record<OutputStatus, string> = {
  pending:        "bg-muted text-muted-foreground",
  approved:       "bg-emerald-500/20 text-emerald-400",
  needs_revision: "bg-blue-500/20 text-blue-400",
  rejected:       "bg-red-500/20 text-red-400",
  flagged:        "bg-amber-500/20 text-amber-400",
};

const STATUS_LABEL: Record<OutputStatus, string> = {
  pending:        "Pending",
  approved:       "Approved",
  needs_revision: "Revision",
  rejected:       "Rejected",
  flagged:        "Flagged",
};

interface ComparePanelProps {
  outputs: CampaignOutput[];
  onClose: () => void;
  onStatusChange: (id: string, status: OutputStatus) => void;
  onMarkLikeness: (output: CampaignOutput) => void;
  onSelectOutput: (output: CampaignOutput) => void;
}

export function ComparePanel({
  outputs, onClose, onStatusChange, onMarkLikeness, onSelectOutput,
}: ComparePanelProps) {
  const athletes = getAthletes();

  return (
    <div className="fixed inset-0 z-40 bg-black/90 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="h-12 border-b border-white/10 px-4 flex items-center justify-between shrink-0">
        <p className="text-sm font-medium text-white/80">
          Comparing {outputs.length} asset{outputs.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={onClose}
          className="size-7 rounded-md flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Image grid */}
      <div className="flex-1 overflow-auto p-4">
        <div
          className="h-full grid gap-3"
          style={{ gridTemplateColumns: `repeat(${outputs.length}, minmax(0, 1fr))` }}
        >
          {outputs.map(output => {
            const athlete = athletes.find(a => a.id === output.athleteId);
            return (
              <div key={output.id} className="flex flex-col gap-2 min-h-0">
                {/* Image */}
                <div className="flex-1 relative rounded-lg overflow-hidden border border-white/10 min-h-0">
                  <button
                    onClick={() => { onClose(); onSelectOutput(output); }}
                    className="absolute inset-0 w-full h-full"
                    title="Open details"
                  >
                    <img
                      src={output.url}
                      alt=""
                      className="w-full h-full object-contain bg-black"
                    />
                  </button>

                  {/* Identity tier badge */}
                  {output.resemblanceScore !== undefined && (() => {
                    const tier = getIdentityMatchTier(output.resemblanceScore);
                    return (
                      <div
                        className={`absolute top-2 right-2 h-5 px-2 rounded text-[10px] font-medium flex items-center pointer-events-none ${tier.overlayClass}`}
                        title={`${tier.label} — ${tier.recommendedUse}`}
                      >
                        {output.resemblanceScore}%
                      </div>
                    );
                  })()}
                </div>

                {/* Info + actions */}
                <div className="shrink-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    {athlete && (
                      <p className="text-xs font-medium text-white/80 truncate">{athlete.name}</p>
                    )}
                    <span className={`h-5 px-2 rounded-full text-[10px] font-medium flex items-center shrink-0 ${STATUS_BADGE[output.status]}`}>
                      {STATUS_LABEL[output.status]}
                    </span>
                  </div>

                  {/* Quick actions */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => onStatusChange(output.id, "approved")}
                      title="Approve"
                      className={`flex-1 h-7 rounded-md flex items-center justify-center transition-colors text-white ${
                        output.status === "approved" ? "bg-emerald-500" : "bg-white/10 hover:bg-emerald-500/70"
                      }`}
                    >
                      <Check className="size-3.5" strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => onStatusChange(output.id, "needs_revision")}
                      title="Needs revision"
                      className={`flex-1 h-7 rounded-md flex items-center justify-center transition-colors text-white ${
                        output.status === "needs_revision" ? "bg-blue-500" : "bg-white/10 hover:bg-blue-500/70"
                      }`}
                    >
                      <PenLine className="size-3.5" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => onStatusChange(output.id, "flagged")}
                      title="Flag"
                      className={`flex-1 h-7 rounded-md flex items-center justify-center transition-colors text-white ${
                        output.status === "flagged" ? "bg-amber-500" : "bg-white/10 hover:bg-amber-500/70"
                      }`}
                    >
                      <Flag className="size-3.5" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => onStatusChange(output.id, "rejected")}
                      title="Reject"
                      className={`flex-1 h-7 rounded-md flex items-center justify-center transition-colors text-white ${
                        output.status === "rejected" ? "bg-red-500" : "bg-white/10 hover:bg-red-500/70"
                      }`}
                    >
                      <X className="size-3.5" strokeWidth={2.5} />
                    </button>
                    {output.athleteId && (
                      <button
                        onClick={() => onMarkLikeness(output)}
                        title="Save as likeness reference"
                        className="flex-1 h-7 rounded-md bg-white/10 hover:bg-accent/70 flex items-center justify-center transition-colors text-white"
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
      </div>
    </div>
  );
}
