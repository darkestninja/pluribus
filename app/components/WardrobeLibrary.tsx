import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, X, Pencil, Trash2, Upload, Sparkles, Loader2, Check, ChevronLeft,
} from "lucide-react";
import {
  getWardrobeKits, addWardrobeKit, updateWardrobeKit, deleteWardrobeKit,
  subscribeToStore, type WardrobeKit,
} from "../lib/store";
import {
  CLOTHING_META, SPORT_PRESETS, SPORT_LABELS, PALETTE,
  type SportCategory, type ClothingItemType, type ClothingItem, type LogoPlacement,
} from "../../data/wardrobe";
import { buildWardrobePrompt, analyzeGarmentImage } from "../lib/wardrobePrompt";
import { compressToDataUrl } from "../lib/imageUtils";
import { supabase } from "../lib/supabase";
import { toast } from "../lib/notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

const LOGO_PLACEMENTS: { id: LogoPlacement; label: string }[] = [
  { id: "chest_left",   label: "Left chest" },
  { id: "chest_center", label: "Centre chest" },
  { id: "back",         label: "Back" },
  { id: "sleeve_left",  label: "Left sleeve" },
];

const SPORT_ORDER: SportCategory[] = ["athletics", "swimming", "team", "combat", "gym", "generic"];

function colorHex(id: string): string {
  return PALETTE.find(c => c.id === id)?.hex ?? "#888";
}

function kitColorDots(kit: WardrobeKit): string[] {
  if (kit.mode === "upload") return [];
  return [...new Set(kit.items.map(i => i.primaryColor))].slice(0, 6);
}

// ── Color swatch picker ───────────────────────────────────────────────────────

function ColorPicker({
  value, onChange, label,
}: { value: string; onChange: (id: string) => void; label?: string }) {
  return (
    <div className="space-y-1.5">
      {label && <p className="text-[11px] text-muted-foreground">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {PALETTE.map(c => (
          <button
            key={c.id}
            type="button"
            title={c.label}
            onClick={() => onChange(c.id)}
            className={`size-6 rounded-full border-2 transition-all ${
              value === c.id ? "border-white scale-110" : "border-transparent hover:scale-105"
            }`}
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Kit card ─────────────────────────────────────────────────────────────────

function KitCard({
  kit, onEdit, onDelete, onSelect, selected,
}: {
  kit: WardrobeKit;
  onEdit: () => void;
  onDelete: () => void;
  onSelect?: () => void;
  selected?: boolean;
}) {
  const dots = kitColorDots(kit);

  return (
    <div
      className={`group bg-card border rounded-xl overflow-hidden transition-all ${
        selected ? "border-accent" : "border-border hover:border-accent/40"
      }`}
    >
      {/* Kit visual header */}
      <div className="h-24 bg-secondary relative flex items-end p-3">
        {kit.mode === "upload" && kit.uploadDataUrl ? (
          <img src={kit.uploadDataUrl} alt={kit.name} className="absolute inset-0 w-full h-full object-cover opacity-70" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            {dots.map((colorId, i) => (
              <div
                key={i}
                className="size-8 rounded-md border border-white/10"
                style={{ backgroundColor: colorHex(colorId) }}
              />
            ))}
            {dots.length === 0 && (
              <div className="text-muted-foreground/30 text-xs">No items</div>
            )}
          </div>
        )}
        <div className="relative flex items-center justify-between w-full">
          <span className="text-[10px] font-semibold uppercase tracking-wide bg-black/50 backdrop-blur-sm text-white/80 px-2 py-0.5 rounded-full">
            {SPORT_LABELS[kit.sport]}
          </span>
          {kit.mode === "upload" && (
            <span className="text-[10px] text-white/60 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">Custom upload</span>
          )}
        </div>
      </div>

      <div className="p-3">
        <p className="text-sm font-medium truncate">{kit.name}</p>
        {kit.mode === "builder" && kit.items.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {kit.items.map(i => CLOTHING_META[i.type]?.label ?? i.type).join(" · ")}
          </p>
        )}
        {kit.mode === "upload" && kit.uploadDescription && (
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{kit.uploadDescription}</p>
        )}

        <div className="flex items-center gap-1.5 mt-3">
          {onSelect && (
            <button
              onClick={onSelect}
              className={`flex-1 h-7 rounded-md text-xs font-medium transition-colors ${
                selected
                  ? "bg-accent text-white"
                  : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-accent/10"
              }`}
            >
              {selected ? <><Check className="size-3 inline mr-1" strokeWidth={2.5} />Selected</> : "Select"}
            </button>
          )}
          <button
            onClick={onEdit}
            className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="size-3.5" strokeWidth={1.75} />
          </button>
          <button
            onClick={onDelete}
            className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Builder modal ─────────────────────────────────────────────────────────────

type BuilderTab = "builder" | "upload";

function BuilderModal({
  initial, onSave, onClose,
}: {
  initial?: WardrobeKit;
  onSave: (kit: Omit<WardrobeKit, "id" | "createdAt" | "updatedAt">) => void;
  onClose: () => void;
}) {
  const [tab,    setTab]    = useState<BuilderTab>(initial?.mode === "upload" ? "upload" : "builder");
  const [name,   setName]   = useState(initial?.name ?? "");
  const [sport,  setSport]  = useState<SportCategory>(initial?.sport ?? "generic");

  // Builder state
  const [items, setItems] = useState<ClothingItem[]>(initial?.items ?? []);
  const [logoDataUrl,  setLogoDataUrl]  = useState(initial?.logo?.imageDataUrl ?? "");
  const [logoBrand,    setLogoBrand]    = useState(initial?.logo?.brand ?? "");
  const [logoPlace,    setLogoPlace]    = useState<LogoPlacement>(initial?.logo?.placement ?? "chest_left");
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  // Upload state
  const [uploadDataUrl,     setUploadDataUrl]     = useState(initial?.uploadDataUrl ?? "");
  const [uploadDescription, setUploadDescription] = useState(initial?.uploadDescription ?? "");
  const [analyzing,         setAnalyzing]          = useState(false);

  const garmentRef = useRef<HTMLInputElement>(null);
  const logoRef    = useRef<HTMLInputElement>(null);

  // ── Item helpers ──────────────────────────────────────────────────────────

  const sportItems = SPORT_PRESETS[sport];
  const hasItem    = (type: ClothingItemType) => items.some(i => i.type === type);

  const toggleItem = (type: ClothingItemType) => {
    if (hasItem(type)) {
      setItems(prev => prev.filter(i => i.type !== type));
      setExpandedItem(null);
    } else {
      const newItems = [...items, { type, primaryColor: "black", fit: "standard" as const }];
      setItems(newItems);
      setExpandedItem(newItems.length - 1);
    }
  };

  const updateItem = (idx: number, patch: Partial<ClothingItem>) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  };

  // ── Upload handler ────────────────────────────────────────────────────────

  const handleGarmentUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressToDataUrl(file, 1024);
    setUploadDataUrl(dataUrl);
    setUploadDescription("");
    setAnalyzing(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      const desc = await analyzeGarmentImage(dataUrl, session.access_token);
      if (desc) setUploadDescription(desc);
    }
    setAnalyzing(false);
  }, []);

  const handleLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressToDataUrl(file, 400);
    setLogoDataUrl(dataUrl);
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (!name.trim()) return;

    const mode = tab;
    const logo = logoDataUrl
      ? { imageDataUrl: logoDataUrl, brand: logoBrand.trim() || undefined, placement: logoPlace }
      : undefined;

    onSave({
      name: name.trim(),
      mode,
      sport,
      items: mode === "builder" ? items : [],
      logo:  mode === "builder" ? logo : undefined,
      uploadDataUrl:     mode === "upload" ? uploadDataUrl : undefined,
      uploadDescription: mode === "upload" ? uploadDescription : undefined,
    });
  };

  // ── All clothing types grouped ────────────────────────────────────────────

  const allTypes = Object.keys(CLOTHING_META) as ClothingItemType[];
  const primaryTypes   = sportItems;
  const secondaryTypes = allTypes.filter(t => !sportItems.includes(t));

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div onClick={e => e.stopPropagation()} className="bg-popover border border-border rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="px-5 h-12 flex items-center justify-between border-b border-border shrink-0">
          <h2 className="text-sm font-semibold">{initial ? "Edit kit" : "New wardrobe kit"}</h2>
          <button onClick={onClose} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary">
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-border shrink-0">
          {(["builder", "upload"] as BuilderTab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 h-10 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "builder" ? "Kit Builder" : "Upload Garment"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── BUILDER TAB ─────────────────────────────────────────── */}
          {tab === "builder" && (
            <div className="p-5 space-y-5">

              {/* Sport selector */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Sport</p>
                <div className="flex flex-wrap gap-1.5">
                  {SPORT_ORDER.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => { setSport(s); setItems([]); setExpandedItem(null); }}
                      className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${
                        sport === s
                          ? "bg-accent text-white"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {SPORT_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clothing item grid */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Clothing</p>

                {/* Sport-relevant items first */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {primaryTypes.map(type => {
                    const meta    = CLOTHING_META[type];
                    const active  = hasItem(type);
                    const itemIdx = items.findIndex(i => i.type === type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleItem(type)}
                        className={`group flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all text-center ${
                          active
                            ? "border-accent bg-accent/10 text-foreground"
                            : "border-border hover:border-accent/40 bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {active && items[itemIdx] ? (
                          <div className="size-6 rounded-full border border-white/20" style={{ backgroundColor: colorHex(items[itemIdx].primaryColor) }} />
                        ) : (
                          <div className="size-6 rounded-full bg-secondary" />
                        )}
                        <span className="text-[10px] leading-tight font-medium">{meta.label}</span>
                        {active && <Check className="size-3 text-accent" strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>

                {/* All other items — collapsed by default */}
                <details className="group">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors py-1 list-none flex items-center gap-1">
                    <ChevronLeft className="size-3 -rotate-90 group-open:rotate-0 transition-transform" strokeWidth={1.75} />
                    More items ({secondaryTypes.length})
                  </summary>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {secondaryTypes.map(type => {
                      const meta   = CLOTHING_META[type];
                      const active = hasItem(type);
                      const itemIdx = items.findIndex(i => i.type === type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleItem(type)}
                          className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border-2 transition-all text-center ${
                            active
                              ? "border-accent bg-accent/10 text-foreground"
                              : "border-border hover:border-accent/40 bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {active && items[itemIdx] ? (
                            <div className="size-6 rounded-full border border-white/20" style={{ backgroundColor: colorHex(items[itemIdx].primaryColor) }} />
                          ) : (
                            <div className="size-6 rounded-full bg-secondary" />
                          )}
                          <span className="text-[10px] leading-tight font-medium">{meta.label}</span>
                          {active && <Check className="size-3 text-accent" strokeWidth={2.5} />}
                        </button>
                      );
                    })}
                  </div>
                </details>
              </div>

              {/* Selected items — color customization */}
              {items.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Customise colours</p>
                  <div className="space-y-2">
                    {items.map((item, idx) => {
                      const meta     = CLOTHING_META[item.type];
                      const expanded = expandedItem === idx;
                      return (
                        <div key={`${item.type}-${idx}`} className="bg-card border border-border rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setExpandedItem(expanded ? null : idx)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <div className="size-5 rounded-full shrink-0 border border-white/10" style={{ backgroundColor: colorHex(item.primaryColor) }} />
                            {item.secondaryColor && (
                              <div className="size-4 rounded-full shrink-0 border border-white/10 -ml-3" style={{ backgroundColor: colorHex(item.secondaryColor) }} />
                            )}
                            <span className="text-sm flex-1">{meta.label}</span>
                            <span className="text-xs text-muted-foreground capitalize">{item.fit}</span>
                            <button
                              type="button"
                              onClick={e => { e.stopPropagation(); toggleItem(item.type); }}
                              className="size-5 rounded flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                            >
                              <X className="size-3" strokeWidth={2} />
                            </button>
                          </button>

                          {expanded && (
                            <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                              <ColorPicker
                                label="Primary colour"
                                value={item.primaryColor}
                                onChange={v => updateItem(idx, { primaryColor: v })}
                              />
                              <ColorPicker
                                label="Accent colour (optional)"
                                value={item.secondaryColor ?? ""}
                                onChange={v => updateItem(idx, { secondaryColor: v || undefined })}
                              />
                              <div>
                                <p className="text-[11px] text-muted-foreground mb-1.5">Fit</p>
                                <div className="flex gap-1.5">
                                  {(["fitted", "standard", "loose"] as const).map(f => (
                                    <button
                                      key={f}
                                      type="button"
                                      onClick={() => updateItem(idx, { fit: f })}
                                      className={`h-7 px-2.5 rounded-md text-xs capitalize border transition-colors ${
                                        item.fit === f
                                          ? "border-accent bg-accent/10 text-foreground"
                                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                                      }`}
                                    >
                                      {f}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Logo / sponsor */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Logo / Sponsor (optional)</p>
                <div className="flex gap-3 items-start">
                  <button
                    type="button"
                    onClick={() => logoRef.current?.click()}
                    className="size-16 rounded-lg border-2 border-dashed border-border hover:border-accent/60 flex items-center justify-center shrink-0 overflow-hidden transition-colors bg-card"
                  >
                    {logoDataUrl
                      ? <img src={logoDataUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                      : <Upload className="size-5 text-muted-foreground/40" strokeWidth={1.5} />
                    }
                  </button>
                  <input ref={logoRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />

                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={logoBrand}
                      onChange={e => setLogoBrand(e.target.value)}
                      placeholder="Brand name, e.g. Nike, Adidas…"
                      className="w-full h-8 px-2.5 bg-card border border-border rounded-md text-xs focus:outline-none focus:border-accent placeholder:text-muted-foreground/40"
                    />
                    <div className="flex flex-wrap gap-1">
                      {LOGO_PLACEMENTS.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setLogoPlace(p.id)}
                          className={`h-6 px-2 rounded text-[10px] border transition-colors ${
                            logoPlace === p.id
                              ? "border-accent bg-accent/10 text-foreground"
                              : "border-border bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoDataUrl("")}
                    className="mt-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Remove logo
                  </button>
                )}
              </div>

              {/* Prompt preview */}
              {items.length > 0 && (
                <div className="bg-card border border-border rounded-lg px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Prompt preview</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    {buildWardrobePrompt({
                      id: "preview", name, mode: "builder", sport, items, createdAt: "", updatedAt: "",
                      logo: logoDataUrl ? { imageDataUrl: logoDataUrl, brand: logoBrand || undefined, placement: logoPlace } : undefined,
                    })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── UPLOAD TAB ──────────────────────────────────────────── */}
          {tab === "upload" && (
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Upload a garment image — flat lay, product photo, or outfit mockup. Claude will analyse it and write a prompt description.
              </p>

              {/* Sport selector */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Sport category</p>
                <div className="flex flex-wrap gap-1.5">
                  {SPORT_ORDER.map(s => (
                    <button key={s} type="button" onClick={() => setSport(s)}
                      className={`h-7 px-3 rounded-full text-xs font-medium transition-colors ${sport === s ? "bg-accent text-white" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                    >
                      {SPORT_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Garment upload */}
              <div>
                <button
                  type="button"
                  onClick={() => garmentRef.current?.click()}
                  className="w-full h-48 rounded-xl border-2 border-dashed border-border hover:border-accent/60 flex flex-col items-center justify-center gap-2 transition-colors overflow-hidden relative group bg-card"
                >
                  {uploadDataUrl ? (
                    <>
                      <img src={uploadDataUrl} alt="Garment" className="w-full h-full object-contain p-2" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity">
                        <Upload className="size-5 text-white" strokeWidth={1.75} />
                        <span className="text-xs text-white/80">Change image</span>
                      </div>
                      {analyzing && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                          <Loader2 className="size-6 text-accent animate-spin" />
                          <span className="text-xs text-white/80">Analysing garment…</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <Upload className="size-7 text-muted-foreground/40" strokeWidth={1.5} />
                      <span className="text-sm text-muted-foreground/60">Click to upload garment</span>
                      <span className="text-xs text-muted-foreground/40">Flat lay · Product photo · Mockup</span>
                    </>
                  )}
                </button>
                <input ref={garmentRef} type="file" accept="image/*" onChange={handleGarmentUpload} className="hidden" />
              </div>

              {/* AI description — editable */}
              {uploadDataUrl && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs text-muted-foreground">Description</p>
                    {!analyzing && uploadDescription && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-accent/80 uppercase tracking-wide">
                        <Sparkles className="size-2.5" strokeWidth={2} /> AI analysed
                      </span>
                    )}
                  </div>
                  <textarea
                    value={uploadDescription}
                    onChange={e => setUploadDescription(e.target.value)}
                    rows={3}
                    placeholder={analyzing ? "Analysing…" : "AI will describe the garment, or type your own…"}
                    disabled={analyzing}
                    className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm leading-relaxed resize-none focus:outline-none focus:border-accent placeholder:text-muted-foreground/40 disabled:opacity-50"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 flex items-center gap-3 shrink-0">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Kit name…"
            className="flex-1 h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/40"
          />
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3 rounded-md border border-border bg-card hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || (tab === "builder" && items.length === 0) || (tab === "upload" && !uploadDataUrl)}
            className="h-9 px-4 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            {initial ? "Save changes" : "Save kit"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main library page ─────────────────────────────────────────────────────────

interface Props {
  onSelectKit?: (kit: WardrobeKit) => void;
  selectedKitId?: string;
}

export function WardrobeLibrary({ onSelectKit, selectedKitId }: Props) {
  const [kits,        setKits]        = useState<WardrobeKit[]>(() => getWardrobeKits());
  const [showBuilder, setShowBuilder] = useState(false);
  const [editing,     setEditing]     = useState<WardrobeKit | undefined>();

  const refresh = () => setKits(getWardrobeKits());

  useEffect(() => subscribeToStore(refresh), []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = (data: Omit<WardrobeKit, "id" | "createdAt" | "updatedAt">) => {
    const now = new Date().toISOString();
    if (editing) {
      updateWardrobeKit(editing.id, { ...data, updatedAt: now });
      toast({ type: "success", title: "Kit updated" });
    } else {
      const kit: WardrobeKit = {
        ...data,
        id:        `wk-${crypto.randomUUID().slice(0, 8)}`,
        createdAt: now,
        updatedAt: now,
      };
      addWardrobeKit(kit);
      toast({ type: "success", title: "Kit saved" });
    }
    refresh();
    setShowBuilder(false);
    setEditing(undefined);
  };

  const handleDelete = (id: string) => {
    deleteWardrobeKit(id);
    refresh();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs text-muted-foreground">Build kits and apply them to any render</p>
          <button
            onClick={() => { setEditing(undefined); setShowBuilder(true); }}
            className="h-8 px-3 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus className="size-3.5" strokeWidth={2.25} /> New kit
          </button>
        </div>

        {kits.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <div className="size-16 rounded-xl bg-card border border-border flex items-center justify-center text-2xl">
              👕
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No wardrobe kits yet</p>
              <p className="text-xs text-muted-foreground">Build a kit from scratch or upload a garment photo</p>
            </div>
            <button
              onClick={() => setShowBuilder(true)}
              className="h-8 px-3 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Plus className="size-3.5" strokeWidth={2.25} /> Create first kit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {kits.map(kit => (
              <KitCard
                key={kit.id}
                kit={kit}
                selected={selectedKitId === kit.id}
                onSelect={onSelectKit ? () => onSelectKit(kit) : undefined}
                onEdit={() => { setEditing(kit); setShowBuilder(true); }}
                onDelete={() => handleDelete(kit.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showBuilder && (
        <BuilderModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowBuilder(false); setEditing(undefined); }}
        />
      )}
    </div>
  );
}
