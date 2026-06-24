import { useState, useEffect, useRef } from "react";
import {
  Search, Plus, ChevronDown,
  Image as ImageIcon, Users,
} from "lucide-react";
import { Project } from "../../data/projects";
import { getAthletes, getProjects, getArchivedProjects, subscribeToStore } from "../lib/store";
import { CampaignWorkspace } from "./CampaignWorkspace";
import { NewCampaignModal } from "./NewCampaignModal";


interface ProjectsProps {
  onLaunchStudio: (opts: { workspaceId?: string; athleteId?: string }) => void;
  extraProjects?: Project[];
}

type FilterTab = "all" | "active" | "review" | "complete";

const STATUS_COLOR: Record<string, string> = {
  "In Progress": "bg-muted-foreground/40",
  Review: "bg-accent",
  Complete: "bg-emerald-500",
};

function getProjectAthletes(p: Project) {
  const athletes = getAthletes();
  if (p.athleteIds?.length) return athletes.filter(a => p.athleteIds!.includes(a.id));
  if (p.athleteName) {
    const found = athletes.find(a => a.name === p.athleteName);
    return found ? [found] : [];
  }
  return [];
}

export function Projects({ onLaunchStudio, extraProjects = [] }: ProjectsProps) {
  const [allProjects, setAllProjects] = useState<Project[]>(() => getProjects());

  useEffect(() => subscribeToStore(() => setAllProjects(getProjects())), []);

  useEffect(() => {
    if (extraProjects.length > 0) {
      setAllProjects(getProjects());
    }
  }, [extraProjects]);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [workspaceProjectId, setWorkspaceProjectId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showNewModal) setShowNewModal(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showNewModal]);

  useEffect(() => {
    if (!showSort) return;
    const fn = (e: MouseEvent) => { if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false); };
    window.addEventListener("mousedown", fn);
    return () => window.removeEventListener("mousedown", fn);
  }, [showSort]);

  const handleCreate = (proj: Project) => {
    setAllProjects(prev => [proj, ...prev]);
    setWorkspaceProjectId(proj.id);
    setShowNewModal(false);
  };

  const filtered = allProjects.filter(p => {
    const athleteNames = getProjectAthletes(p).map(a => a.name).join(" ");
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      athleteNames.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === "active")   return p.status === "In Progress";
    if (filter === "review")   return p.status === "Review";
    if (filter === "complete") return p.status === "Complete";
    return true;
  });

  const sorted = [...filtered].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name) : 0
  );

  const counts = {
    all: allProjects.length,
    active: allProjects.filter(p => p.status === "In Progress").length,
    review: allProjects.filter(p => p.status === "Review").length,
    complete: allProjects.filter(p => p.status === "Complete").length,
  };

  const workspaceProject = allProjects.find(p => p.id === workspaceProjectId);
  if (workspaceProject) {
    return (
      <CampaignWorkspace
        project={workspaceProject}
        onBack={() => setWorkspaceProjectId(null)}
        onLaunchStudio={onLaunchStudio}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 border-b border-border -mb-6 pb-0 shrink-0">
            {(["all", "active", "review", "complete"] as FilterTab[]).map(tab => (
              <button key={tab} onClick={() => setFilter(tab)}
                className={`h-9 px-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                  filter === tab ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="capitalize">{tab}</span>
                <span className="text-[11px] tabular-nums opacity-50">{counts[tab]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="relative flex-1 min-w-[160px] max-w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" strokeWidth={1.75} />
              <input type="text" placeholder="Search campaigns…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground"
              />
            </div>
            <div className="relative" ref={sortRef}>
              <button onClick={() => setShowSort(s => !s)}
                className="h-8 px-2 rounded-md bg-card border border-border hover:border-accent/40 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              >
                {sort === "name" ? "Name A–Z" : "Recent"}
                <ChevronDown className="size-3" strokeWidth={1.75} />
              </button>
              {showSort && (
                <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md z-20 w-32 py-1 shadow-md">
                  {(["recent", "name"] as const).map(s => (
                    <button key={s} onClick={() => { setSort(s); setShowSort(false); }}
                      className={`w-full text-left px-3 h-8 text-sm ${sort === s ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground hover:bg-card"}`}
                    >
                      {s === "name" ? "Name A–Z" : "Recent"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setShowNewModal(true)}
              className="h-8 px-2 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Plus className="size-3.5" strokeWidth={2.25} /> New campaign
            </button>
          </div>
        </div>

        {/* Campaign grid */}
        {sorted.length === 0 ? (
          allProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <div className="size-14 rounded-2xl bg-card border border-border flex items-center justify-center">
                <ImageIcon className="size-6 text-muted-foreground/40" strokeWidth={1.5} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No campaigns yet</p>
                <p className="text-xs text-muted-foreground">Create a campaign to start generating</p>
              </div>
              <button onClick={() => setShowNewModal(true)}
                className="h-8 px-2 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-1.5">
                <Plus className="size-3.5" strokeWidth={2.25} /> New campaign
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">No campaigns match your filters</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sorted.map(project => {
              const projAthletes = getProjectAthletes(project);
              return (
                <button
                  key={project.id}
                  onClick={() => setWorkspaceProjectId(project.id)}
                  className="group relative rounded-xl overflow-hidden bg-card border border-border hover:border-accent/40 transition-all text-left"
                >
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <img src={project.thumbnail} alt={project.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    {/* Athlete stack bottom-left */}
                    {projAthletes.length > 0 && (
                      <div className="absolute bottom-2 left-2 flex -space-x-2">
                        {projAthletes.slice(0, 4).map(a => (
                          <img key={a.id} src={a.image} alt={a.name} className="size-7 rounded-full object-cover ring-2 ring-background" />
                        ))}
                        {projAthletes.length > 4 && (
                          <div className="size-7 rounded-full bg-card ring-2 ring-background flex items-center justify-center text-xs text-muted-foreground font-medium">
                            +{projAthletes.length - 4}
                          </div>
                        )}
                      </div>
                    )}
                    {/* Status badge */}
                    {project.status && (
                      <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
                        <span className={`size-1.5 rounded-full ${STATUS_COLOR[project.status] ?? "bg-muted-foreground/40"}`} />
                        <span className="text-xs text-white/80">{project.status}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3.5 space-y-2">
                    <div>
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{project.description}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="size-2.5" strokeWidth={1.75} />
                          {projAthletes.length || 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ImageIcon className="size-2.5" strokeWidth={1.75} />
                        {project.assetCount ?? 0}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground/60">{project.lastEdited}</p>
                  </div>
                </button>
              );
            })}

            {/* New campaign card */}
            <button onClick={() => setShowNewModal(true)}
              className="group rounded-xl border border-dashed border-border hover:border-accent/40 transition-colors flex items-center justify-center min-h-[220px] text-muted-foreground hover:text-foreground"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="size-10 rounded-full border border-dashed border-current flex items-center justify-center">
                  <Plus className="size-4" strokeWidth={1.5} />
                </div>
                <span className="text-sm">New campaign</span>
              </div>
            </button>
          </div>
        )}

        {/* Archive */}
        {(() => {
          const archived = getArchivedProjects();
          if (archived.length === 0) return null;
          return (
            <div className="pt-6 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm text-muted-foreground">Archive</h3>
                <span className="text-xs text-muted-foreground">{archived.length} campaigns</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {archived.slice(0, 5).map(p => (
                  <div key={p.id} className="rounded-lg overflow-hidden bg-card border border-border opacity-50 hover:opacity-80 transition-opacity">
                    <div className="aspect-[4/3] overflow-hidden">
                      <img src={p.thumbnail} alt={p.name} className="w-full h-full object-cover grayscale" />
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.lastEdited}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {showNewModal && (
        <NewCampaignModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
