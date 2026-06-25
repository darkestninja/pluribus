import { Sparkles, ArrowRight, Plus, Users } from "lucide-react";
import { getAthletes, getProjects, getAthleteProfile, getProfileCompleteness, getCampaignOutputs, useStoreSync } from "../lib/store";
import type { Athlete } from "../../data/athletes";

interface DashboardProps {
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
  const pct = getProfileCompleteness(getAthleteProfile(a.id), a);
  if (pct >= 100) return { pct: 100, bg: "#10b981", label: "Ready" };
  if (pct > 0)    return { pct,      bg: "#f59e0b", label: "In progress" };
  return                  { pct: 0,  bg: "#6b7280", label: "Pending" };
}

export function Dashboard({ onOpenCampaigns, onNewCampaign, onQuickGenerate, onAddAthlete, onAthleteClick, onAthleteGenerate }: DashboardProps) {
  useStoreSync(); // re-renders on hydration and subsequent store updates
  const athletes = getAthletes();
  const projects = getProjects();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-10">

        {/* Quick actions */}
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
                <p className="text-xs text-muted-foreground mt-0.5">Start a new campaign</p>
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
                <p className="text-sm font-semibold">Add subject</p>
                <p className="text-xs text-muted-foreground mt-0.5">Add reference photos to your roster</p>
              </div>
            </button>
          </div>
        </section>

        {/* Recent campaigns */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Recent campaigns</h3>
            {projects.length > 0 && (
              <button onClick={onOpenCampaigns} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
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
                const subjects = project.athleteIds
                  ? athletes.filter(a => project.athleteIds!.includes(a.id))
                  : project.athleteName
                  ? athletes.filter(a => a.name === project.athleteName)
                  : [];
                return (
                  <button
                    key={project.id}
                    className="group rounded-xl overflow-hidden bg-card border border-border hover:border-accent/40 transition-all cursor-pointer text-left w-full"
                    onClick={onOpenCampaigns}
                  >
                    <div className="aspect-[16/9] relative overflow-hidden">
                      <img src={project.thumbnail} alt={project.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      {subjects.length > 0 && (
                        <div className="absolute bottom-2 left-2 flex -space-x-1.5">
                          {subjects.slice(0, 3).map(a => (
                            <img key={a.id} src={a.image} alt={a.name} className="size-6 rounded-full object-cover ring-2 ring-background" />
                          ))}
                          {subjects.length > 3 && (
                            <div className="size-6 rounded-full bg-card ring-2 ring-background flex items-center justify-center text-[10px] text-muted-foreground">
                              +{subjects.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="p-3.5">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      {(() => {
                        const outputs = getCampaignOutputs(project.id);
                        const total    = outputs.length;
                        const approved = outputs.filter(o => o.status === "approved").length;
                        const pending  = outputs.filter(o => o.status === "pending").length;
                        const talentEnrolled = subjects.filter(a => {
                          const p = getAthleteProfile(a.id);
                          return p && (p.captureAngles?.length ?? 0) > 0;
                        }).length;
                        const talentTotal = subjects.length;
                        if (total === 0 && talentTotal === 0) return null;
                        return (
                          <div className="mt-2 space-y-1">
                            {talentTotal > 0 && (
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="w-20 shrink-0">Talent</span>
                                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                                  <div className="h-full rounded-full bg-accent/60" style={{ width: `${talentTotal > 0 ? Math.round((talentEnrolled / talentTotal) * 100) : 0}%` }} />
                                </div>
                                <span className="shrink-0">{talentEnrolled}/{talentTotal}</span>
                              </div>
                            )}
                            {total > 0 && (
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="w-20 shrink-0">Approvals</span>
                                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((approved / total) * 100)}%` }} />
                                </div>
                                <span className="shrink-0">{approved}/{total}{pending > 0 ? ` · ${pending} pending` : ""}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Subject roster */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Subjects</h3>
            {athletes.length > 0 && (
              <button onClick={() => onAthleteClick("")} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
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
              <span className="text-sm">Add your first subject</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {athletes.slice(0, 5).map(subject => {
                const r = readiness(subject);
                return (
                  <div
                    key={subject.id}
                    role="button"
                    tabIndex={0}
                    className="group relative rounded-lg overflow-hidden bg-card border border-border hover:border-accent/40 transition-colors cursor-pointer"
                    onClick={() => onAthleteClick(subject.id)}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAthleteClick(subject.id); } }}
                  >
                    <div className="aspect-[3/4] relative overflow-hidden">
                      <img src={subject.image} alt={subject.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                      <button
                        onClick={e => { e.stopPropagation(); onAthleteGenerate(subject.id); }}
                        aria-label={`Generate for ${subject.name}`}
                        title="Generate"
                        className="absolute top-2 right-2 size-8 rounded-md bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all text-white hover:bg-accent hover:text-accent-foreground flex items-center justify-center"
                      >
                        <Sparkles className="size-3.5" strokeWidth={2.25} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
                        <p className="text-sm font-medium text-white leading-tight">{subject.name}</p>
                        <p className="text-xs text-white/60 truncate">{subject.sport}</p>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: r.pct + "%", backgroundColor: r.bg }} />
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

      </div>
    </div>
  );
}
