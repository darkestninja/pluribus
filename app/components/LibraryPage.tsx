import { useState, useEffect } from "react";
import { Search, Filter } from "lucide-react";
import {
  getCampaignOutputs, getAthletes, getRuns, getProjects, getArchivedProjects,
  setOutputStatus, addOutputComment, addOutputTag, removeOutputTag,
  getAthleteProfile, saveAthleteProfile, createEmptyProfile, addRejectedLikeness,
  type CampaignOutput, type OutputStatus, type OutputComment, type Run,
} from "../lib/store";
import type { Athlete, ApprovedLikeness } from "../../data/athletes";
import { AssetDetailPanel } from "./AssetDetailPanel";
import { toast } from "../lib/notifications";
import { relativeTime } from "../lib/utils";

interface LibraryPageProps {
  reviewerEmail: string;
}

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
  needs_revision: "Revision",
  flagged:        "Flagged",
  rejected:       "Rejected",
};

type StatusFilter = OutputStatus | "all";

export function LibraryPage({ reviewerEmail }: LibraryPageProps) {
  const [outputs, setOutputs] = useState<CampaignOutput[]>(() => getCampaignOutputs());
  const [detailOutput, setDetailOutput] = useState<CampaignOutput | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [athleteFilter, setAthleteFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setOutputs(getCampaignOutputs());
  }, []);

  const [athletes] = useState(getAthletes);
  const [allProjects] = useState(() => [...getProjects(), ...getArchivedProjects()]);

  const athleteMap = new Map<string, Athlete>(athletes.map(a => [a.id, a]));
  const projectMap = new Map(allProjects.map(p => [p.id, p]));

  const filtered = outputs.filter(o => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (athleteFilter !== "all" && o.athleteId !== athleteFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const athleteName = o.athleteId ? (athleteMap.get(o.athleteId)?.name ?? "").toLowerCase() : "";
      const campaignName = (projectMap.get(o.campaignId)?.name ?? "").toLowerCase();
      const tagMatch = (o.tags ?? []).some(t => t.toLowerCase().includes(q));
      if (!athleteName.includes(q) && !campaignName.includes(q) && !tagMatch) return false;
    }
    return true;
  });

  const getDetailRun = (): Run | undefined => {
    if (!detailOutput?.runId) return undefined;
    return getRuns(detailOutput.campaignId).find(r => r.id === detailOutput.runId);
  };

  const handleStatusChange = (id: string, status: OutputStatus) => {
    setOutputStatus(id, status, reviewerEmail);
    const now = new Date().toISOString();
    const patch = { status, reviewedBy: reviewerEmail, reviewedAt: now };
    setOutputs(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
    if (detailOutput?.id === id) setDetailOutput(prev => prev ? { ...prev, ...patch } : null);
  };

  const handleCommentAdded = (outputId: string, comment: OutputComment) => {
    addOutputComment(outputId, comment);
    const patch = (o: CampaignOutput) =>
      o.id === outputId ? { ...o, comments: [...(o.comments ?? []), comment] } : o;
    setOutputs(prev => prev.map(patch));
    if (detailOutput?.id === outputId) setDetailOutput(prev => prev ? patch(prev) : null);
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

  const handleMarkLikeness = (output: CampaignOutput) => {
    const athlete = athleteMap.get(output.athleteId ?? "");
    if (!athlete) return;
    const existing = getAthleteProfile(athlete.id);
    const entry: ApprovedLikeness = {
      imageUrl: output.url,
      context: `Library · ${new Date().toLocaleDateString()}`,
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

  const handleMarkRejectedLikeness = (output: CampaignOutput) => {
    const athlete = athleteMap.get(output.athleteId ?? "");
    if (!athlete) return;
    addRejectedLikeness(athlete.id, {
      imageUrl: output.url,
      context: `Library · ${new Date().toLocaleDateString()}`,
      rejectedAt: new Date().toISOString(),
    });
    toast({ type: "success", title: "Rejected likeness saved", body: `Added to ${athlete.name}'s profile as what to avoid` });
  };

  const detailAthlete = detailOutput?.athleteId ? athleteMap.get(detailOutput.athleteId) : undefined;

  const STATUS_TABS: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "approved", label: "Approved" },
    { value: "pending", label: "Pending" },
    { value: "needs_revision", label: "Revision" },
    { value: "flagged", label: "Flagged" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-3 shrink-0">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by subject, campaign, tag…"
            className="w-full h-8 pl-8 pr-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Athlete filter */}
        <div className="flex items-center gap-1.5 text-sm">
          <Filter className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
          <select
            value={athleteFilter}
            onChange={e => setAthleteFilter(e.target.value)}
            className="h-8 px-2 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent"
          >
            <option value="all">All subjects</option>
            {athletes.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground ml-auto">{filtered.length} asset{filtered.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Status tabs */}
      <div className="px-6 flex gap-1 border-b border-border overflow-x-auto shrink-0">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 h-9 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              statusFilter === tab.value
                ? "border-accent text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-muted-foreground">No assets match the current filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map(output => {
              const athlete = output.athleteId ? athleteMap.get(output.athleteId) : undefined;
              const campaign = projectMap.get(output.campaignId);
              return (
                <button
                  key={output.id}
                  onClick={() => setDetailOutput(output)}
                  className="group relative rounded-lg overflow-hidden bg-card border border-border hover:border-accent/40 transition-colors text-left"
                >
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={output.url}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="absolute top-1.5 left-1.5">
                    <span className={`h-4 px-1.5 rounded-full text-[10px] font-medium flex items-center ${STATUS_BADGE[output.status]}`}>
                      {STATUS_LABEL[output.status]}
                    </span>
                  </div>
                  <div className="p-2 space-y-0.5">
                    {athlete && <p className="text-xs font-medium truncate">{athlete.name}</p>}
                    {campaign && <p className="text-[10px] text-muted-foreground truncate">{campaign.name}</p>}
                    {output.tags && output.tags.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/70 truncate">
                        {output.tags.slice(0, 3).join(", ")}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/50">{relativeTime(output.createdAt)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {detailOutput && (
        <AssetDetailPanel
          output={detailOutput}
          run={getDetailRun()}
          athlete={detailAthlete}
          reviewerEmail={reviewerEmail}
          onClose={() => setDetailOutput(null)}
          onStatusChange={handleStatusChange}
          onRegenerate={() => {
            setDetailOutput(null);
            toast({ type: "info", title: "Open the campaign to regenerate", body: "Regeneration is available in the campaign workspace." });
          }}
          onMarkLikeness={handleMarkLikeness}
          onMarkRejectedLikeness={handleMarkRejectedLikeness}
          onCommentAdded={handleCommentAdded}
          onTagAdded={handleTagAdded}
          onTagRemoved={handleTagRemoved}
        />
      )}
    </div>
  );
}
