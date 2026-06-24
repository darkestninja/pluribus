import { useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import { getArchivedProjects } from "../lib/store";

export function ArchivePage() {
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const archivedProjects = getArchivedProjects();
  const filtered = archivedProjects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.athleteName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{archivedProjects.length} archived projects · read-only</p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="Search archive…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-56 h-8 pl-8 pr-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">No archived projects found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map(project => (
              <div
                key={project.id}
                className="group rounded-lg overflow-hidden bg-card border border-border hover:border-accent/40 transition-colors relative"
                onMouseEnter={() => setHoveredId(project.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={project.thumbnail}
                    alt={project.name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                {hoveredId === project.id && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                    <button className="h-8 px-2 rounded-md bg-foreground text-background text-sm font-medium flex items-center gap-1.5">
                      <RotateCcw className="size-3.5" strokeWidth={2} />
                      Restore
                    </button>
                  </div>
                )}
                <div className="p-3 border-t border-border">
                  <p className="text-sm font-medium truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{project.athleteName} · {project.lastEdited}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
