import { useState, useEffect } from "react";
import { Plus, Search, X, Sparkles } from "lucide-react";
import { workflowTemplates, Workflow } from "../../data/workflows";

const countByCategory = (list: Workflow[], cat: string) =>
  cat === "all" ? list.length : list.filter(wf => wf.tags?.some(t => t.toLowerCase().includes(cat.toLowerCase()))).length;

interface WorkflowLibraryProps {
  onSelectWorkflow?: (id: string) => void;
}

type CategoryFilter = "all" | "Portrait" | "Action" | "Video" | "Editorial" | "Team";

const CATEGORIES: { id: CategoryFilter; label: string }[] = [
  { id: "all",       label: "All" },
  { id: "Portrait",  label: "Portrait" },
  { id: "Action",    label: "Action" },
  { id: "Video",     label: "Video" },
  { id: "Editorial", label: "Editorial" },
  { id: "Team",      label: "Team" },
];

export function WorkflowLibrary({ onSelectWorkflow }: WorkflowLibraryProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>(workflowTemplates);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ name: "", description: "", aspectRatio: "16:9" });

  const filtered = workflows.filter(wf => {
    const matchSearch =
      wf.name.toLowerCase().includes(search.toLowerCase()) ||
      wf.description?.toLowerCase().includes(search.toLowerCase()) ||
      wf.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchCat = category === "all" || wf.tags?.some(t => t.toLowerCase().includes(category.toLowerCase()));
    return matchSearch && matchCat;
  });

  const handleCreate = () => {
    if (!newWorkflow.name.trim()) return;
    const wf: Workflow = {
      id: `wf-${Date.now()}`,
      name: newWorkflow.name,
      description: newWorkflow.description,
      aspectRatio: newWorkflow.aspectRatio,
      tags: [],
      thumbnail: "/workflows/wf-1.jpg",
    };
    setWorkflows([...workflows, wf]);
    setShowCreateModal(false);
    setNewWorkflow({ name: "", description: "", aspectRatio: "16:9" });
  };

  useEffect(() => {
    if (!showCreateModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowCreateModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCreateModal]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{workflows.length} styles · click any to pre-fill the studio</p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" strokeWidth={1.75} />
              <input
                type="text"
                placeholder="Search templates…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-56 h-8 pl-8 pr-3 bg-card border border-border rounded-md text-sm focus-visible:border-accent placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-8 px-3 rounded-md bg-card border border-border hover:border-accent/40 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Plus className="size-3.5" strokeWidth={1.75} />
              New
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`h-8 px-3 rounded-md text-sm transition-colors flex items-center gap-1.5 ${
                category === cat.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              {cat.label}
              <span className="text-xs text-muted-foreground/70">{countByCategory(workflows, cat.id)}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(wf => (
            <button
              key={wf.id}
              onClick={() => onSelectWorkflow?.(wf.id)}
              className="group rounded-lg overflow-hidden bg-card border border-border hover:border-accent/40 transition-all text-left relative"
            >
              <div className="aspect-[4/3] overflow-hidden relative">
                <img src={wf.thumbnail} alt={wf.name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                {wf.aspectRatio && (
                  <span className="absolute top-2 left-2 text-xs font-medium bg-black/60 backdrop-blur-sm text-foreground px-1.5 py-0.5 rounded">{wf.aspectRatio}</span>
                )}
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="h-8 px-3 rounded-md bg-accent text-accent-foreground text-sm font-medium flex items-center gap-1.5">
                    <Sparkles className="size-3.5" strokeWidth={2} />
                    Use template
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-1.5 border-t border-border">
                <h3 className="text-sm font-medium truncate">{wf.name}</h3>
                {wf.description && <p className="text-xs text-muted-foreground truncate">{wf.description}</p>}
                {wf.tags && wf.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {wf.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded bg-secondary text-muted-foreground text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {showCreateModal && (
        <div onClick={() => setShowCreateModal(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <div onClick={e => e.stopPropagation()} className="bg-popover border border-border rounded-lg w-full max-w-sm overflow-hidden">
            <div className="px-5 h-12 flex items-center justify-between border-b border-border">
              <h2 className="text-base font-semibold tracking-tight">New workflow</h2>
              <button onClick={() => setShowCreateModal(false)} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary">
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={newWorkflow.name}
                  onChange={e => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                  placeholder="e.g. Victory podium portrait"
                  className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus-visible:border-accent placeholder:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Description</label>
                <textarea
                  value={newWorkflow.description}
                  onChange={e => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                  placeholder="Brief description…"
                  rows={2}
                  className="w-full px-3 py-2 bg-card border border-border rounded-md text-sm focus-visible:border-accent placeholder:text-muted-foreground resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Aspect ratio</label>
                <select
                  value={newWorkflow.aspectRatio}
                  onChange={e => setNewWorkflow({ ...newWorkflow, aspectRatio: e.target.value })}
                  className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus-visible:border-accent"
                >
                  <option value="1:1">1:1 Square</option>
                  <option value="4:5">4:5 Portrait</option>
                  <option value="9:16">9:16 Story</option>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="21:9">21:9 Ultrawide</option>
                </select>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={handleCreate}
                className="flex-1 h-9 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="h-9 px-4 rounded-md bg-card border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
