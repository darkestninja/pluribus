import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, X, Loader2, Sparkles, Link, Upload, Trash2, Pencil, Image as ImageIcon,
  Globe,
} from "lucide-react";
import {
  getMoodboards, addMoodboard, updateMoodboard, deleteMoodboard,
  subscribeToStore, type Moodboard,
} from "../lib/store";
import type { MoodboardSource, CreativeDirection } from "../../data/moodboard";
import {
  analyzeMoodboardImages, fetchUrlImages, resizeDataUrl,
} from "../lib/moodboardPrompt";

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return `mb-${crypto.randomUUID().slice(0, 8)}`; }

function DirectionField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className="w-full px-3 py-2 bg-background border border-border rounded-md text-xs leading-relaxed resize-none focus:border-accent placeholder:text-muted-foreground/40"
      />
    </div>
  );
}

// ── Builder Modal ─────────────────────────────────────────────────────────────

interface BuilderModalProps {
  initial?: Moodboard;
  onSave: (mb: Moodboard) => void;
  onClose: () => void;
}

function BuilderModal({ initial, onSave, onClose }: BuilderModalProps) {
  const [name,       setName]       = useState(initial?.name ?? "");
  const [sources,    setSources]    = useState<MoodboardSource[]>(initial?.sources ?? []);
  const [direction,  setDirection]  = useState<CreativeDirection | null>(initial?.direction ?? null);
  const [notes,      setNotes]      = useState(initial?.notes ?? "");
  const [analysing,  setAnalysing]  = useState(false);
  const [analysisErr, setAnalysisErr] = useState<string | null>(null);
  const [urlInput,   setUrlInput]   = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlErr,     setUrlErr]     = useState<string | null>(null);
  const [showUrlBar, setShowUrlBar] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const added: MoodboardSource[] = [];
    for (const file of Array.from(files)) {
      if (sources.length + added.length >= 8) break;
      const isImage = file.type.startsWith("image/");
      const isPdf   = file.type === "application/pdf";
      if (!isImage && !isPdf) continue;

      const reader = new FileReader();
      const dataUrl: string = await new Promise(res => {
        reader.onload = e => res(e.target!.result as string);
        reader.readAsDataURL(file);
      });
      const thumbnail = isImage ? await resizeDataUrl(dataUrl) : dataUrl;
      added.push({ id: uid(), thumbnail, filename: file.name });
    }
    if (added.length > 0) setSources(s => [...s, ...added]);
  }, [sources.length]);

  const handleImportUrl = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setUrlLoading(true);
    setUrlErr(null);
    try {
      const imported = await fetchUrlImages(trimmed);
      if (imported.length === 0) {
        setUrlErr("No images found at that URL. Try pasting a direct image URL or Pinterest/Behance link.");
      } else {
        const remaining = 8 - sources.length;
        const toAdd = imported.slice(0, remaining).map(i => ({ id: uid(), ...i }));
        setSources(s => [...s, ...toAdd]);
        setUrlInput("");
        setShowUrlBar(false);
      }
    } catch {
      setUrlErr("Failed to fetch images from URL.");
    }
    setUrlLoading(false);
  };

  const removeSource = (id: string) => setSources(s => s.filter(x => x.id !== id));

  const handleAnalyse = async () => {
    if (sources.length === 0) return;
    setAnalysing(true);
    setAnalysisErr(null);
    const thumbnails = sources
      .filter(s => s.thumbnail.startsWith("data:image/"))
      .map(s => s.thumbnail);
    const result = await analyzeMoodboardImages(thumbnails);
    if (result) {
      setDirection(result);
    } else {
      setAnalysisErr("Analysis failed — check your connection and try again.");
    }
    setAnalysing(false);
  };

  const updateDirection = (field: keyof CreativeDirection, value: string) => {
    setDirection(d => d ? { ...d, [field]: value } : null);
  };

  const handleSave = () => {
    const trimmed = name.trim() || "Untitled moodboard";
    const now = new Date().toISOString();
    const mb: Moodboard = {
      id:        initial?.id ?? uid(),
      name:      trimmed,
      sources,
      direction,
      notes,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(mb);
  };

  const canSave = name.trim().length > 0 || sources.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">{initial ? "Edit Moodboard" : "New Moodboard"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Name */}
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Moodboard name…"
            autoFocus
            className="w-full h-10 px-3 bg-card border border-border rounded-lg text-sm font-medium focus:border-accent placeholder:text-muted-foreground/40"
          />

          {/* Source images */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">REFERENCES · {sources.length}/8</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setShowUrlBar(v => !v); setUrlErr(null); }}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs transition-colors ${
                    showUrlBar ? "border-accent text-accent bg-accent/5" : "border-border text-muted-foreground hover:text-foreground bg-card"
                  }`}
                >
                  <Globe className="size-3" strokeWidth={1.75} />
                  URL
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-card text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Upload className="size-3" strokeWidth={1.75} />
                  Upload
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={e => handleFiles(e.target.files)}
                />
              </div>
            </div>

            {/* URL bar */}
            {showUrlBar && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={e => { setUrlInput(e.target.value); setUrlErr(null); }}
                    onKeyDown={e => e.key === "Enter" && handleImportUrl()}
                    placeholder="pinterest.com/board, behance.net/gallery, or image URL…"
                    className="flex-1 h-9 px-3 bg-card border border-border rounded-lg text-sm focus:border-accent placeholder:text-muted-foreground/40"
                  />
                  <button
                    onClick={handleImportUrl}
                    disabled={urlLoading || !urlInput.trim()}
                    className="h-9 px-4 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    {urlLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Link className="size-3.5" strokeWidth={1.75} />}
                    Import
                  </button>
                </div>
                {urlErr && <p className="text-xs text-red-400">{urlErr}</p>}
              </div>
            )}

            {/* Images grid */}
            {sources.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {sources.map(src => (
                  <div key={src.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-card">
                    {src.thumbnail.startsWith("data:image/") ? (
                      <img src={src.thumbnail} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                        <ImageIcon className="size-6 text-muted-foreground/40" strokeWidth={1.5} />
                        <p className="text-[10px] text-muted-foreground/50 px-1 truncate w-full text-center">PDF</p>
                      </div>
                    )}
                    <button
                      onClick={() => removeSource(src.id)}
                      className="absolute top-1 right-1 size-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="size-3" strokeWidth={2} />
                    </button>
                    {src.filename && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[9px] text-white/80 truncate">{src.filename}</p>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add more slot */}
                {sources.length < 8 && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-accent/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="size-5" strokeWidth={1.5} />
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-28 rounded-xl border-2 border-dashed border-border hover:border-accent/40 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ImageIcon className="size-6" strokeWidth={1.5} />
                <div className="text-center">
                  <p className="text-sm font-medium">Add reference images</p>
                  <p className="text-xs opacity-60">Upload images or PDFs, or import from URL</p>
                </div>
              </button>
            )}
          </div>

          {/* Analyse button */}
          {sources.length > 0 && !direction && (
            <button
              onClick={handleAnalyse}
              disabled={analysing}
              className="w-full h-10 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {analysing
                ? <><Loader2 className="size-4 animate-spin" /> Analysing visual direction…</>
                : <><Sparkles className="size-4" strokeWidth={1.75} /> Analyse Creative Direction</>
              }
            </button>
          )}

          {analysisErr && (
            <p className="text-xs text-red-400 text-center">{analysisErr}</p>
          )}

          {/* Direction panel */}
          {direction && (
            <div className="space-y-4 border border-accent/20 rounded-xl p-4 bg-accent/[0.03]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-accent" strokeWidth={1.75} />
                  <p className="text-xs font-semibold text-accent uppercase tracking-wide">Creative Direction</p>
                </div>
                <button
                  onClick={handleAnalyse}
                  disabled={analysing}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                >
                  {analysing ? "Analysing…" : "Re-analyse →"}
                </button>
              </div>

              {direction.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-accent/30 pl-3">
                  {direction.summary}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <DirectionField label="Mood"         value={direction.mood}         onChange={v => updateDirection("mood", v)} />
                <DirectionField label="Colour Palette" value={direction.colorPalette} onChange={v => updateDirection("colorPalette", v)} />
                <DirectionField label="Lighting"     value={direction.lighting}     onChange={v => updateDirection("lighting", v)} />
                <DirectionField label="Composition"  value={direction.composition}  onChange={v => updateDirection("composition", v)} />
                <DirectionField label="Style"        value={direction.style}        onChange={v => updateDirection("style", v)} />
                <DirectionField label="Environment"  value={direction.environment}  onChange={v => updateDirection("environment", v)} />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Additional notes (optional)</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Extra direction appended when generating…"
              className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm leading-relaxed resize-none focus:border-accent placeholder:text-muted-foreground/40"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="h-9 px-5 rounded-lg bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
          >
            Save Moodboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Moodboard Card ────────────────────────────────────────────────────────────

function MoodboardCard({
  mb, onEdit, onDelete,
}: { mb: Moodboard; onEdit: () => void; onDelete: () => void }) {
  const images = mb.sources.filter(s => s.thumbnail.startsWith("data:image/")).slice(0, 4);

  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden hover:border-accent/40 transition-colors">

      {/* Image collage */}
      <div
        className="aspect-video bg-secondary cursor-pointer"
        onClick={onEdit}
      >
        {images.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground/20" strokeWidth={1.5} />
          </div>
        ) : images.length === 1 ? (
          <img src={images[0].thumbnail} alt="" className="w-full h-full object-cover" />
        ) : images.length === 2 ? (
          <div className="w-full h-full grid grid-cols-2">
            {images.map(s => <img key={s.id} src={s.thumbnail} alt="" className="w-full h-full object-cover" />)}
          </div>
        ) : (
          <div className="w-full h-full grid grid-cols-2 grid-rows-2">
            {images.map(s => <img key={s.id} src={s.thumbnail} alt="" className="w-full h-full object-cover" />)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate cursor-pointer" onClick={onEdit}>{mb.name}</p>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={onEdit}
              className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="size-3.5" strokeWidth={1.75} />
            </button>
            <button
              onClick={onDelete}
              className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {mb.direction && (
          <div className="flex flex-wrap gap-1">
            {mb.direction.mood.split(",").slice(0, 3).map(t => (
              <span key={t.trim()} className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground capitalize">
                {t.trim()}
              </span>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground/50">
          {mb.sources.length} image{mb.sources.length !== 1 ? "s" : ""}
          {mb.direction ? " · analysed" : ""}
        </p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function MoodboardLibrary() {
  const [moodboards, setMoodboards] = useState(() => getMoodboards());
  const [building,   setBuilding]   = useState(false);
  const [editing,    setEditing]    = useState<Moodboard | null>(null);

  const refresh = () => setMoodboards(getMoodboards());

  useEffect(() => subscribeToStore(refresh), []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = (mb: Moodboard) => {
    if (editing) {
      updateMoodboard(mb.id, mb);
    } else {
      addMoodboard(mb);
    }
    setBuilding(false);
    setEditing(null);
    refresh();
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this moodboard?")) return;
    deleteMoodboard(id);
    refresh();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Import references from images, PDFs, Pinterest, or Behance — Claude extracts the creative direction.</p>
          <button
            onClick={() => setBuilding(true)}
            className="h-8 px-3 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
            New Moodboard
          </button>
        </div>

        {/* Grid */}
        {moodboards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="size-14 rounded-2xl bg-card border border-border flex items-center justify-center">
              <ImageIcon className="size-6 text-muted-foreground/40" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-sm">No moodboards yet</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Create a moodboard by uploading reference images or importing from Pinterest and Behance — AI extracts the visual direction automatically.
              </p>
            </div>
            <button
              onClick={() => setBuilding(true)}
              className="flex items-center gap-2 h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors"
            >
              <Plus className="size-4" strokeWidth={1.75} />
              Create first moodboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {moodboards.map(mb => (
              <MoodboardCard
                key={mb.id}
                mb={mb}
                onEdit={() => setEditing(mb)}
                onDelete={() => handleDelete(mb.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {(building || editing) && (
        <BuilderModal
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setBuilding(false); setEditing(null); }}
        />
      )}
    </div>
  );
}
