import { useState, useRef } from "react";
import { X, Check, ChevronRight, ChevronLeft, Upload, Image, Trash2, Search, Link, FileText, Loader2 } from "lucide-react";
import type { Project } from "../../data/projects";
import { getAthletes } from "../lib/store";
import { compressToDataUrl } from "../lib/imageUtils";
import { supabase } from "../lib/supabase";

interface MoodboardItem {
  id: string;
  type: "image" | "pdf" | "link";
  thumbnail: string;   // data URL for image/pdf, empty string for link-only
  url?: string;        // original URL for link items
  label: string;
}

interface NewCampaignModalProps {
  onClose: () => void;
  onCreate: (project: Project) => void;
}

const STEPS = ["Details", "Subjects", "Moodboard"];

export function NewCampaignModal({ onClose, onCreate }: NewCampaignModalProps) {
  const [step, setStep] = useState(1);

  // Step 1 — name + brief
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");

  // Step 2 — subjects
  const [athleteIds, setAthleteIds] = useState<string[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");

  // Step 3 — moodboard
  const [moodItems, setMoodItems] = useState<MoodboardItem[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [linkFetching, setLinkFetching] = useState(false);
  const [linkError, setLinkError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const athletes = getAthletes();

  const filteredAthletes = athletes.filter(a =>
    a.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
    a.sport.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  const canAdvance = () => {
    if (step === 1) return name.trim().length > 0;
    return true;
  };

  const addMoodItem = (item: MoodboardItem) => {
    setMoodItems(prev => [...prev, item].slice(0, 8));
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files).slice(0, 8 - moodItems.length)) {
      const isPdf = file.type === "application/pdf";
      if (isPdf) {
        // Store PDF as a data URL — thumbnail will be a PDF icon
        const reader = new FileReader();
        reader.onload = () => {
          addMoodItem({
            id: crypto.randomUUID(),
            type: "pdf",
            thumbnail: "",
            label: file.name,
            url: reader.result as string,
          });
        };
        reader.readAsDataURL(file);
      } else {
        const dataUrl = await compressToDataUrl(file, 800);
        addMoodItem({ id: crypto.randomUUID(), type: "image", thumbnail: dataUrl, label: file.name });
      }
    }
  };

  const handleLinkAdd = async () => {
    const url = linkInput.trim();
    if (!url) return;
    setLinkError("");
    setLinkFetching(true);
    try {
      // Try to fetch a preview via our proxy
      const sess = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/fetch/preview?url=${encodeURIComponent(url)}`, {
        headers: { "Authorization": `Bearer ${sess?.access_token ?? ""}` },
      });
      if (res.ok) {
        const data = await res.json() as { thumbnail?: string; title?: string };
        addMoodItem({
          id: crypto.randomUUID(),
          type: "link",
          thumbnail: data.thumbnail ?? "",
          label: data.title ?? new URL(url).hostname,
          url,
        });
      } else {
        // Fallback: add as link without preview
        addMoodItem({ id: crypto.randomUUID(), type: "link", thumbnail: "", label: new URL(url).hostname, url });
      }
    } catch {
      // If URL is invalid or fetch fails, still add it
      try {
        addMoodItem({ id: crypto.randomUUID(), type: "link", thumbnail: "", label: new URL(url).hostname, url });
      } catch {
        setLinkError("Invalid URL — include https://");
        setLinkFetching(false);
        return;
      }
    }
    setLinkInput("");
    setLinkFetching(false);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    const thumbAthlete = athleteIds.length ? athletes.find(a => a.id === athleteIds[0]) : null;
    const proj: Project = {
      id: `project-${crypto.randomUUID().slice(0, 8)}`,
      name: name.trim(),
      description: brief.trim() || undefined,
      thumbnail: thumbAthlete?.image ?? "/projects/james-magnussen.jpg",
      lastEdited: "just now",
      type: "active",
      athleteIds: athleteIds.length ? athleteIds : undefined,
      status: "draft",
      assetCount: 0,
      brief: brief.trim() || undefined,
      moodboardImages: moodItems.filter(i => i.thumbnail).map(i => i.thumbnail),
    };
    onCreate(proj);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-popover border border-border rounded-2xl w-full max-w-lg overflow-hidden flex flex-col"
        style={{ maxHeight: "min(92vh, 680px)" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold">New campaign</h2>
            <div className="flex items-center gap-1.5 mt-1">
              {STEPS.map((label, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className={`flex items-center gap-1 ${i + 1 === step ? "text-foreground" : i + 1 < step ? "text-accent" : "text-muted-foreground/40"}`}>
                    <div className={`size-4 rounded-full flex items-center justify-center text-[9px] font-bold border ${i + 1 === step ? "border-accent bg-accent text-accent-foreground" : i + 1 < step ? "border-accent bg-accent/10 text-accent" : "border-border"}`}>
                      {i + 1 < step ? <Check className="size-2.5" strokeWidth={3} /> : i + 1}
                    </div>
                    <span className="text-[10px] font-medium">{label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`w-4 h-px ${i + 1 < step ? "bg-accent" : "bg-border"}`} />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary transition-colors">
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── Step 1: Details ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Campaign name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && canAdvance() && setStep(2)}
                  placeholder="e.g. Olympic announcement portraits"
                  autoFocus
                  className="w-full h-9 px-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Creative brief <span className="text-muted-foreground/50">(optional)</span></label>
                <textarea
                  value={brief}
                  onChange={e => setBrief(e.target.value)}
                  placeholder="Describe the campaign goal, tone, and any key requirements…"
                  rows={4}
                  maxLength={400}
                  className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
                />
                <p className="text-[10px] text-muted-foreground text-right">{brief.length} / 400</p>
              </div>
            </div>
          )}

          {/* ── Step 2: Subjects ────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {athleteIds.length > 0
                  ? <><span className="text-accent font-medium">{athleteIds.length} selected</span> — you can add more later</>
                  : "Select which subjects are in this campaign. You can add more later."}
              </p>

              {athletes.length === 0 ? (
                <div className="bg-card border border-border rounded-xl px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">No subjects yet.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Add subjects from the Subjects page first.</p>
                </div>
              ) : (
                <>
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" strokeWidth={1.75} />
                    <input
                      type="text"
                      value={subjectSearch}
                      onChange={e => setSubjectSearch(e.target.value)}
                      placeholder="Search by name or sport…"
                      className="w-full h-8 pl-8 pr-3 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
                    />
                    {subjectSearch && (
                      <button onClick={() => setSubjectSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="size-3" />
                      </button>
                    )}
                  </div>

                  {/* Selected chips */}
                  {athleteIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {athleteIds.map(id => {
                        const a = athletes.find(x => x.id === id);
                        if (!a) return null;
                        return (
                          <div key={id} className="flex items-center gap-1 pl-1.5 pr-1 py-0.5 bg-accent/10 border border-accent/30 rounded-full">
                            <img src={a.image} alt={a.name} className="size-4 rounded-full object-cover" />
                            <span className="text-xs text-accent font-medium">{a.name.split(" ")[0]}</span>
                            <button onClick={() => setAthleteIds(prev => prev.filter(x => x !== id))} className="ml-0.5 text-accent/60 hover:text-accent">
                              <X className="size-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Subject list */}
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-0.5">
                    {filteredAthletes.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-6">No subjects match "{subjectSearch}"</p>
                    ) : filteredAthletes.map(a => {
                      const sel = athleteIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() => setAthleteIds(prev => sel ? prev.filter(id => id !== a.id) : [...prev, a.id])}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${sel ? "border-accent bg-accent/8" : "border-transparent hover:border-border bg-card hover:bg-secondary"}`}
                        >
                          <div className="relative shrink-0">
                            <img src={a.image} alt={a.name} className="size-9 rounded-full object-cover" />
                            {sel && (
                              <div className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-accent border-2 border-popover flex items-center justify-center">
                                <Check className="size-2 text-white" strokeWidth={3.5} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{a.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{a.sport}{a.event ? ` · ${a.event}` : ""}</p>
                          </div>
                          <div className={`size-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${sel ? "bg-accent border-accent" : "border-border"}`}>
                            {sel && <Check className="size-2.5 text-white" strokeWidth={3.5} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: Moodboard ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Upload images, PDFs, or paste links to guide the visual direction. Optional — up to 8 references.</p>

              {/* Upload + link inputs */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={moodItems.length >= 8}
                  className="flex items-center justify-center gap-2 h-10 rounded-lg border border-dashed border-border hover:border-accent/50 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Upload className="size-3.5" strokeWidth={1.75} />
                  Images / PDF
                </button>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                    <input
                      type="text"
                      value={linkInput}
                      onChange={e => { setLinkInput(e.target.value); setLinkError(""); }}
                      onKeyDown={e => e.key === "Enter" && handleLinkAdd()}
                      placeholder="Paste URL…"
                      className="w-full h-10 pl-7 pr-2 bg-card border border-border rounded-lg text-xs focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <button
                    onClick={handleLinkAdd}
                    disabled={!linkInput.trim() || linkFetching || moodItems.length >= 8}
                    className="h-10 w-10 shrink-0 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 flex items-center justify-center transition-colors"
                  >
                    {linkFetching ? <Loader2 className="size-3.5 text-white animate-spin" /> : <Check className="size-3.5 text-white" strokeWidth={2.5} />}
                  </button>
                </div>
              </div>
              {linkError && <p className="text-xs text-red-400">{linkError}</p>}

              {/* Moodboard grid */}
              {moodItems.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {moodItems.map(item => (
                    <div key={item.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-card">
                      {item.type === "image" && item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.label} className="w-full h-full object-cover" />
                      ) : item.type === "pdf" ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                          <FileText className="size-6 text-muted-foreground" strokeWidth={1.5} />
                          <p className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-2">{item.label}</p>
                        </div>
                      ) : item.thumbnail ? (
                        <img src={item.thumbnail} alt={item.label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
                          <Link className="size-5 text-muted-foreground" strokeWidth={1.5} />
                          <p className="text-[9px] text-muted-foreground text-center leading-tight line-clamp-2">{item.label}</p>
                        </div>
                      )}
                      <button
                        onClick={() => setMoodItems(prev => prev.filter(x => x.id !== item.id))}
                        className="absolute top-1 right-1 size-5 rounded-full bg-black/70 hover:bg-red-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="size-2.5 text-white" strokeWidth={2.5} />
                      </button>
                    </div>
                  ))}
                  {moodItems.length < 8 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Upload className="size-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-card border border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 text-muted-foreground">
                  <Image className="size-6" strokeWidth={1.5} />
                  <p className="text-xs">No references added — campaign uses house style defaults</p>
                </div>
              )}

              {/* Summary */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Summary</p>
                <div className="space-y-1.5 text-sm">
                  {[
                    ["Campaign", name],
                    brief ? ["Brief", brief] : null,
                    ["Subjects", athleteIds.length ? `${athleteIds.length} selected` : "None"],
                    ["Recipe", recipeId ? recipes.find(r => r.id === recipeId)?.name ?? recipeId : customStyle ? "Custom style" : "None"],
                    ["Moodboard", moodItems.length ? `${moodItems.length} reference${moodItems.length !== 1 ? "s" : ""}` : "None"],
                  ].filter(Boolean).map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                      <span className="text-muted-foreground w-20 shrink-0 text-xs">{k}</span>
                      <span className="text-xs truncate font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={e => handleFileUpload(e.target.files)}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="h-9 px-4 rounded-lg bg-card border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <ChevronLeft className="size-3.5" strokeWidth={2} />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < STEPS.length ? (
            <button
              onClick={() => canAdvance() && setStep(s => s + 1)}
              disabled={!canAdvance()}
              className="h-9 px-5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              Continue
              <ChevronRight className="size-3.5" strokeWidth={2} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              className="h-9 px-5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Check className="size-3.5" strokeWidth={2.5} />
              Create campaign
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
