import { Sparkles, ArrowRight, Plus, Users } from "lucide-react";
import { getAthletes, getProjects, getCampaignOutputs } from "../lib/store";
import { relativeTime } from "../lib/utils";
import type { Athlete } from "../../data/athletes";

interface DashboardProps {
  userName: string;
  onOpenCampaigns: () => void;
  onNewCampaign: () => void;
  onQuickGenerate: () => void;
  onAddAthlete: () => void;
  onAthleteClick: (id: string) => void;
  onAthleteGenerate: (id: string) => void;
  onViewAllWorkflows?: () => void;
  onWorkflowClick?: (id: string) => void;
}

function readiness(a: Athlete) {
  if (a.status === "complete") return { pct: 100, color: "text-emerald-500", bg: "#10b981", label: "Ready" };
  if (a.status === "review")   return { pct: 60,  color: "text-amber-400",  bg: "#f59e0b", label: "Review" };
  return                              { pct: 20,  color: "text-muted-foreground", bg: "#6b7280", label: "Pending" };
}

export function Dashboard({ userName, onOpenCampaigns, onNewCampaign, onQuickGenerate, onAddAthlete, onAthleteClick, onAthleteGenerate, onViewAllWorkflows, onWorkflowClick }: DashboardProps) {
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  const athletes = getAthletes();
  const projects = getProjects();

  const activeCampaigns = projects.filter(p => p.type === "active").length;
  const athletesReady = athletes.filter(a => a.status === "complete").length;
  const pendingCapture = athletes.filter(a => a.status === "pending").length;

  const recentOutputs = getCampaignOutputs()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  const pendingAthletes = athletes.filter(a => a.status === "pending").slice(0, 2);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-10">

        {/* Section 1 — Greeting + stats */}
        <section className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight">{greeting}{userName ? `, ${userName.split(" ")[0]}` : ""}.</h2>
          <p className="text-sm text-muted-foreground">
            {activeCampaigns} campaign{activeCampaigns !== 1 ? "s" : ""} active
            &nbsp;·&nbsp; {athletesReady} athlete{athletesReady !== 1 ? "s" : ""} ready
            &nbsp;·&nbsp; {pendingCapture} pending capture
          </p>
        </section>

        {/* Section 2 — Quick actions */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Quick actions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={onNewCampaign}
              className="bg-card border border-border rounded-xl p-5 hover:border-accent/40 transition-colors cursor-pointer flex flex-col gap-3 text-left"
            >
              <div className="size-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Plus className="size-4 text-accent" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold">New campaign</p>
                <p className="text-xs text-muted-foreground mt-0.5">Start a campaign from a template</p>
              </div>
            </button>

            <button
              onClick={onQuickGenerate}
              className="bg-card border border-border rounded-xl p-5 hover:border-accent/40 transition-colors cursor-pointer flex flex-col gap-3 text-left"
            >
              <div className="size-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Sparkles className="size-4 text-accent" strokeWidth={2} />
              </div>
              <div>
                <p className="text-sm font-semibold">Quick generate</p>
                <p className="text-xs text-muted-foreground mt-0.5">Jump straight into the studio</p>
              </div>
            </button>

            <button
              onClick={onAddAthlete}
              className="bg-card border border-border rounded-xl p-5 hover:border-accent/40 transition-colors cursor-pointer flex flex-col gap-3 text-left"
            >
              <div className="size-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="size-4 text-accent" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-semibold">Add athlete</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add reference photos to your roster</p>
              </div>
            </button>
          </div>
        </section>

        {/* Section 3 — Recent campaigns */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Recent campaigns</h3>
            {projects.length > 0 && (
              <button
                onClick={onOpenCampaigns}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                View all <ArrowRight className="size-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
          {projects.length === 0 ? (
            <button
              onClick={onNewCampaign}
              className="w-full rounded-xl border border-dashed border-border hover:border-accent/40 transition-colors flex items-center justify-center py-10 text-muted-foreground hover:text-foreground gap-2"
            >
              <Plus className="size-4" strokeWidth={1.75} />
              <span className="text-sm">Create your first campaign</span>
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {projects.slice(0, 3).map(project => {
                const projAthletes = project.athleteIds
                  ? athletes.filter(a => project.athleteIds!.includes(a.id))
                  : project.athleteName
                  ? athletes.filter(a => a.name === project.athleteName)
                  : [];
                return (
                  <div
                    key={project.id}
                    className="group rounded-xl overflow-hidden bg-card border border-border hover:border-accent/40 transition-all cursor-pointer"
                    onClick={onOpenCampaigns}
                  >
                    <div className="aspect-[16/9] relative overflow-hidden">
                      <img src={project.thumbnail} alt={project.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      {projAthletes.length > 0 && (
                        <div className="absolute bottom-2 left-2 flex -space-x-1.5">
                          {projAthletes.slice(0, 3).map(a => (
                            <img key={a.id} src={a.image} alt={a.name} className="size-6 rounded-full object-cover ring-2 ring-background" />
                          ))}
                          {projAthletes.length > 3 && (
                            <div className="size-6 rounded-full bg-card ring-2 ring-background flex items-center justify-center text-[10px] text-muted-foreground">
                              +{projAthletes.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="p-3.5">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">{project.status}</span>
                        <span className="text-xs text-muted-foreground">{project.assetCount ?? 0} assets</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 4 — Athlete roster with readiness */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Roster</h3>
            {athletes.length > 0 && (
              <button
                onClick={() => onAthleteClick("")}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                View all <ArrowRight className="size-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
          {athletes.length === 0 ? (
            <button
              onClick={onAddAthlete}
              className="w-full rounded-xl border border-dashed border-border hover:border-accent/40 transition-colors flex items-center justify-center py-10 text-muted-foreground hover:text-foreground gap-2"
            >
              <Users className="size-4" strokeWidth={1.75} />
              <span className="text-sm">Add your first athlete</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {athletes.slice(0, 5).map(athlete => {
                const r = readiness(athlete);
                return (
                  <div
                    key={athlete.id}
                    className="group relative rounded-lg overflow-hidden bg-card border border-border hover:border-accent/40 transition-colors cursor-pointer"
                    onClick={() => onAthleteClick(athlete.id)}
                  >
                    <div className="aspect-[3/4] relative overflow-hidden">
                      <img
                        src={athlete.image}
                        alt={athlete.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                      <button
                        onClick={e => { e.stopPropagation(); onAthleteGenerate(athlete.id); }}
                        title="Generate"
                        className="absolute top-2 right-2 size-8 rounded-md bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all text-white hover:bg-accent hover:text-accent-foreground flex items-center justify-center"
                      >
                        <Sparkles className="size-3.5" strokeWidth={2.25} />
                      </button>

                      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
                        <p className="text-sm font-medium text-white leading-tight">{athlete.name}</p>
                        <p className="text-xs text-white/60 truncate">{athlete.sport}</p>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: r.pct + "%", backgroundColor: r.bg }} />
                          </div>
                          <span className="text-[10px] shrink-0" style={{ color: r.bg }}>{r.label}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 5 — Activity feed */}
        <section className="space-y-4">
          <h3 className="text-base font-semibold">Activity</h3>
          <div className="space-y-1">
            {recentOutputs.map(item => {
              const ath = athletes.find(a => a.id === item.athleteId);
              const dotColor =
                item.status === "approved" ? "bg-emerald-500"
                : item.status === "rejected" ? "bg-red-500"
                : item.status === "flagged" ? "bg-amber-400"
                : item.status === "needs_revision" ? "bg-blue-400"
                : "bg-muted-foreground/40";
              return (
                <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-card transition-colors">
                  <span className={`size-2 rounded-full shrink-0 ${dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      {ath && <span className="font-medium">{ath.name}</span>}
                      <span className="text-muted-foreground"> · {item.status.replace("_", " ")}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(item.createdAt)}</p>
                  </div>
                  {ath && (
                    <button
                      onClick={() => onAthleteGenerate(ath.id)}
                      className="text-xs text-accent hover:underline shrink-0"
                    >
                      View →
                    </button>
                  )}
                </div>
              );
            })}
            {pendingAthletes.map(athlete => (
              <div key={athlete.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-card transition-colors">
                <span className="size-2 rounded-full bg-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">
                    Capture needed for <span className="font-medium text-foreground">{athlete.name}</span>
                  </p>
                </div>
                <button
                  onClick={() => onAthleteClick(athlete.id)}
                  className="text-xs text-accent hover:underline shrink-0"
                >
                  Capture →
                </button>
              </div>
            ))}
            {recentOutputs.length === 0 && pendingAthletes.length === 0 && (
              <p className="text-sm text-muted-foreground px-3 py-4">No recent activity.</p>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
