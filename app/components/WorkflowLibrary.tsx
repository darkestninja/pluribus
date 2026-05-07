import { useState, useEffect } from "react";
import { Plus, Search, X, Sparkles, Copy, Pencil, Trash2, CheckSquare, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import type { Recipe } from "../../data/recipes";
import { getRecipes, addRecipe, updateRecipe, deleteRecipe } from "../lib/store";

interface WorkflowLibraryProps {
  onSelectWorkflow?: (id: string) => void;
}

type CategoryFilter = "all" | "Portrait" | "Action" | "Editorial" | "Social" | "Announcement";

const CATEGORIES: { id: CategoryFilter; label: string }[] = [
  { id: "all",          label: "All" },
  { id: "Portrait",     label: "Portrait" },
  { id: "Action",       label: "Action" },
  { id: "Editorial",    label: "Editorial" },
  { id: "Social",       label: "Social" },
  { id: "Announcement", label: "Announcement" },
];

const ASPECT_RATIOS = ["1:1", "4:5", "3:4", "9:16", "16:9", "2:3", "4:3"];

type ListField = "styleRules" | "lightingRules" | "compositionRules" | "qualityChecklist" | "tags";

function emptyForm() {
  return {
    name: "", description: "", useCase: "", prompt: "", negativePrompt: "",
    aspectRatio: "4:5", aspectRatioLocked: false,
    styleRules: [] as string[], lightingRules: [] as string[],
    compositionRules: [] as string[], qualityChecklist: [] as string[], tags: [] as string[],
  };
}

type FormData = ReturnType<typeof emptyForm>;

export function WorkflowLibrary({ onSelectWorkflow }: WorkflowLibraryProps) {
  const [recipes, setRecipes] = useState<Recipe[]>(() => getRecipes());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [modalTab, setModalTab] = useState<"basic" | "creative" | "checklist">("basic");
  const [newItem, setNewItem] = useState<Record<ListField, string>>({
    styleRules: "", lightingRules: "", compositionRules: "", qualityChecklist: "", tags: "",
  });

  const refresh = () => setRecipes(getRecipes());

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showModal]);

  const filtered = recipes.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
      || r.useCase?.toLowerCase().includes(q) || r.tags?.some(t => t.toLowerCase().includes(q));
    const matchCat = category === "all" || r.tags?.some(t => t.toLowerCase().includes(category.toLowerCase()));
    return matchSearch && matchCat;
  });

  const openCreate = () => { setEditingId(null); setForm(emptyForm()); setModalTab("basic"); setShowModal(true); };

  const openEdit = (r: Recipe) => {
    setEditingId(r.id);
    setForm({ name: r.name, description: r.description, useCase: r.useCase, prompt: r.prompt,
      negativePrompt: r.negativePrompt, aspectRatio: r.aspectRatio, aspectRatioLocked: r.aspectRatioLocked,
      styleRules: [...r.styleRules], lightingRules: [...r.lightingRules],
      compositionRules: [...r.compositionRules], qualityChecklist: [...r.qualityChecklist], tags: [...r.tags] });
    setModalTab("basic"); setShowModal(true);
  };

  const openClone = (r: Recipe) => {
    setEditingId(null);
    setForm({ name: `${r.name} (copy)`, description: r.description, useCase: r.useCase, prompt: r.prompt,
      negativePrompt: r.negativePrompt, aspectRatio: r.aspectRatio, aspectRatioLocked: r.aspectRatioLocked,
      styleRules: [...r.styleRules], lightingRules: [...r.lightingRules],
      compositionRules: [...r.compositionRules], qualityChecklist: [...r.qualityChecklist], tags: [...r.tags] });
    setModalTab("basic"); setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false); setEditingId(null); setForm(emptyForm());
    setNewItem({ styleRules: "", lightingRules: "", compositionRules: "", qualityChecklist: "", tags: "" });
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.prompt.trim()) return;
    if (editingId) {
      updateRecipe(editingId, { ...form });
    } else {
      const now = new Date().toISOString();
      addRecipe({ id: `recipe-${Date.now()}`, ...form, thumbnail: "/workflows/wf-1.jpg",
        isSystemRecipe: false, createdAt: now, updatedAt: now });
    }
    refresh(); closeModal();
  };

  const addItem = (field: ListField) => {
    const val = newItem[field].trim();
    if (!val) return;
    setForm(f => ({ ...f, [field]: [...f[field], val] }));
    setNewItem(prev => ({ ...prev, [field]: "" }));
  };

  const removeItem = (field: ListField, idx: number) =>
    setForm(f => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));

  const ListEditor = ({ field, placeholder }: { field: ListField; placeholder: string }) => (
    <div className="space-y-1.5">
      {form[field].map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-md">
          <p className="text-xs flex-1">{item}</p>
          <button onClick={() => removeItem(field, idx)} className="p-0.5 hover:bg-secondary rounded shrink-0">
            <X className="size-3 text-muted-foreground" />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input type="text" value={newItem[field]} onChange={e => setNewItem(p => ({ ...p, [field]: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(field); } }}
          placeholder={placeholder}
          className="flex-1 h-8 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50" />
        <button onClick={() => addItem(field)}
          className="h-8 px-3 rounded-md bg-secondary border border-border hover:bg-secondary/60 text-xs text-muted-foreground hover:text-foreground transition-colors">
          Add
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setCategory(cat.id)}
                className={`h-8 px-3 rounded-md text-sm transition-colors ${category === cat.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-card"}`}>
                {cat.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" strokeWidth={1.75} />
              <input type="text" placeholder="Search recipes…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-52 h-8 pl-8 pr-3 bg-card border border-border rounded-md text-sm focus-visible:border-accent placeholder:text-muted-foreground" />
            </div>
            <button onClick={openCreate}
              className="h-8 px-3 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-1.5">
              <Plus className="size-3.5" strokeWidth={2.25} /> New recipe
            </button>
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-muted-foreground">No recipes found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(recipe => (
              <div key={recipe.id} className="group rounded-xl overflow-hidden bg-card border border-border hover:border-accent/40 transition-all">
                {/* Thumbnail */}
                <div className="aspect-[16/7] relative overflow-hidden">
                  <img src={recipe.thumbnail} alt={recipe.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{recipe.name}</p>
                      <p className="text-xs text-white/70 mt-0.5">{recipe.useCase}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {recipe.negativePrompt && (
                        <span className="text-[10px] bg-black/50 text-white/80 px-1.5 py-0.5 rounded backdrop-blur-sm">neg</span>
                      )}
                      {recipe.qualityChecklist.length > 0 && (
                        <span className="text-[10px] bg-black/50 text-white/80 px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-0.5">
                          <CheckSquare className="size-2.5" strokeWidth={2} />
                          {recipe.qualityChecklist.length}
                        </span>
                      )}
                      {recipe.isSystemRecipe && (
                        <span className="text-[10px] bg-black/50 text-white/60 px-1.5 py-0.5 rounded backdrop-blur-sm flex items-center gap-0.5">
                          <ShieldCheck className="size-2.5" strokeWidth={2} />
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3.5 space-y-3">
                  {recipe.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{recipe.description}</p>
                  )}
                  {recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {recipe.tags.slice(0, 4).map(tag => (
                        <span key={tag} className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* Checklist preview */}
                  {recipe.qualityChecklist.length > 0 && (
                    <div>
                      <button onClick={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <CheckSquare className="size-3" strokeWidth={1.75} />
                        {recipe.qualityChecklist.length} checklist items
                        {expandedId === recipe.id
                          ? <ChevronUp className="size-3" strokeWidth={1.75} />
                          : <ChevronDown className="size-3" strokeWidth={1.75} />}
                      </button>
                      {expandedId === recipe.id && (
                        <div className="mt-2 space-y-1.5">
                          {recipe.qualityChecklist.map((item, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="size-3.5 rounded border border-border shrink-0 mt-0.5" />
                              <p className="text-xs text-muted-foreground">{item}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                    {onSelectWorkflow && (
                      <button onClick={() => onSelectWorkflow(recipe.id)}
                        className="flex-1 h-7 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-xs font-medium transition-colors flex items-center justify-center gap-1.5">
                        <Sparkles className="size-3" strokeWidth={2} /> Use recipe
                      </button>
                    )}
                    <button onClick={() => openClone(recipe)} title="Clone"
                      className="size-7 rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center">
                      <Copy className="size-3" strokeWidth={1.75} />
                    </button>
                    {!recipe.isSystemRecipe && (
                      <>
                        <button onClick={() => openEdit(recipe)} title="Edit"
                          className="size-7 rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center">
                          <Pencil className="size-3" strokeWidth={1.75} />
                        </button>
                        {deleteConfirmId === recipe.id ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => { deleteRecipe(recipe.id); refresh(); setDeleteConfirmId(null); }}
                              className="h-7 px-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-xs hover:bg-red-500/20 transition-colors">
                              Delete
                            </button>
                            <button onClick={() => setDeleteConfirmId(null)}
                              className="size-7 rounded-md border border-border hover:bg-secondary text-muted-foreground transition-colors flex items-center justify-center">
                              <X className="size-3" strokeWidth={1.75} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmId(recipe.id)} title="Delete"
                            className="size-7 rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-red-400 transition-colors flex items-center justify-center">
                            <Trash2 className="size-3" strokeWidth={1.75} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div onClick={closeModal} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-popover border border-border rounded-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-3.5 flex items-center justify-between border-b border-border shrink-0">
              <h2 className="text-base font-semibold">{editingId ? "Edit recipe" : "New recipe"}</h2>
              <button onClick={closeModal} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary">
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>

            {/* Modal tabs */}
            <div className="px-5 flex gap-5 border-b border-border shrink-0">
              {(["basic", "creative", "checklist"] as const).map(tab => (
                <button key={tab} onClick={() => setModalTab(tab)}
                  className={`py-3 border-b-2 transition-colors text-sm font-medium ${modalTab === tab ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {tab === "basic" ? "Basic" : tab === "creative" ? "Creative Direction" : "Checklist"}
                </button>
              ))}
            </div>

            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* BASIC */}
              {modalTab === "basic" && <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs text-muted-foreground">Recipe name <span className="text-red-400">*</span></label>
                    <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Agency Noir" autoFocus
                      className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Use case</label>
                    <input type="text" value={form.useCase} onChange={e => setForm(f => ({ ...f, useCase: e.target.value }))}
                      placeholder="e.g. Editorial Portrait"
                      className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Aspect ratio</label>
                    <div className="flex gap-2">
                      <select value={form.aspectRatio} onChange={e => setForm(f => ({ ...f, aspectRatio: e.target.value }))}
                        className="flex-1 h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent">
                        {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button onClick={() => setForm(f => ({ ...f, aspectRatioLocked: !f.aspectRatioLocked }))}
                        className={`h-9 px-3 rounded-md border text-xs transition-colors ${form.aspectRatioLocked ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/40"}`}>
                        {form.aspectRatioLocked ? "Locked" : "Lock"}
                      </button>
                    </div>
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs text-muted-foreground">Description</label>
                    <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Brief description of this recipe's style"
                      className="w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Prompt <span className="text-red-400">*</span></label>
                  <textarea value={form.prompt} onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                    placeholder="Describe the visual output — lighting, camera, subject, background, colour grade…"
                    rows={6}
                    className="w-full px-3 py-2 bg-card border border-border rounded-md text-sm resize-none focus:outline-none focus:border-accent placeholder:text-muted-foreground/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Negative prompt</label>
                  <p className="text-xs text-muted-foreground/60">Injected automatically at generation time. Things this recipe should never produce.</p>
                  <textarea value={form.negativePrompt} onChange={e => setForm(f => ({ ...f, negativePrompt: e.target.value }))}
                    placeholder="e.g. colour tones, HDR glow, watermark, bad anatomy, text overlay…"
                    rows={3}
                    className="w-full px-3 py-2 bg-card border border-border rounded-md text-sm resize-none focus:outline-none focus:border-accent placeholder:text-muted-foreground/50" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Tags</label>
                  <ListEditor field="tags" placeholder="e.g. Portrait, B&W, Studio" />
                </div>
              </>}

              {/* CREATIVE DIRECTION */}
              {modalTab === "creative" && <div className="space-y-5">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Style rules</h4>
                  <p className="text-xs text-muted-foreground/60">Overall visual direction and aesthetic.</p>
                  <ListEditor field="styleRules" placeholder="e.g. Black and white only — no colour tones" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Lighting rules</h4>
                  <p className="text-xs text-muted-foreground/60">Specific lighting constraints and preferences.</p>
                  <ListEditor field="lightingRules" placeholder="e.g. Single hard key light at 45° elevated" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Composition rules</h4>
                  <p className="text-xs text-muted-foreground/60">Framing, crop, and subject placement.</p>
                  <ListEditor field="compositionRules" placeholder="e.g. Tight 3/4 head-and-torso crop" />
                </div>
              </div>}

              {/* CHECKLIST */}
              {modalTab === "checklist" && <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium">Quality checklist</h4>
                  <p className="text-xs text-muted-foreground/60 mt-1">Appears in the campaign review sidebar. Reviewers check these before approving each asset.</p>
                </div>
                <ListEditor field="qualityChecklist" placeholder="e.g. Face is sharp — eyes in critical focus" />
              </div>}
            </div>

            <div className="px-5 pb-5 flex gap-2 shrink-0 border-t border-border pt-4">
              <button onClick={handleSave} disabled={!form.name.trim() || !form.prompt.trim()}
                className="flex-1 h-9 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-sm font-medium transition-colors">
                {editingId ? "Save changes" : "Create recipe"}
              </button>
              <button onClick={closeModal}
                className="h-9 px-4 rounded-md bg-card border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
