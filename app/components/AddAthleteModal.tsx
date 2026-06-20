import { useState, useRef } from "react";
import { X, Upload, Sparkles, Loader2, CheckCircle, Plus, Trash2, FileText, ChevronDown } from "lucide-react";
import { addAthlete, createEmptyProfile, saveAthleteProfile } from "../lib/store";
import type { Athlete } from "../../data/athletes";
import { toast } from "../lib/notifications";
import { compressToDataUrl } from "../lib/imageUtils";
import { supabase } from "../lib/supabase";

interface AddAthleteModalProps {
  onClose: () => void;
  onAdded?: (athlete: Athlete) => void;
}

interface AnalysisResult {
  build?: string;
  skinTone?: string;
  hair?: string;
  age?: number | null;
  sport?: string | null;
}

interface TattooEntry {
  id: string;
  description: string;
  location: string;
}

// ── Picker options ────────────────────────────────────────────────────────────

export const HEIGHT_OPTIONS = Array.from({ length: 84 - 56 + 1 }, (_, i) => {
  const totalInches = 56 + i;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  const cm = Math.round(totalInches * 2.54);
  return { value: `${feet}'${inches}" (${cm}cm)`, label: `${feet}'${inches}"  —  ${cm} cm` };
});

export const WEIGHT_OPTIONS = Array.from({ length: (350 - 100) / 5 + 1 }, (_, i) => {
  const lbs = 100 + i * 5;
  const kg = Math.round(lbs * 0.453592);
  return { value: `${lbs} lbs (${kg}kg)`, label: `${lbs} lbs  —  ${kg} kg` };
});

const TATTOO_LOCATIONS = [
  "Left forearm", "Right forearm", "Left upper arm", "Right upper arm",
  "Left shoulder", "Right shoulder", "Chest", "Back", "Neck",
  "Left hand", "Right hand", "Left leg", "Right leg", "Ankle", "Other",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function analyzePhoto(dataUrl: string): Promise<AnalysisResult | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  const [header, imageBase64] = dataUrl.split(",");
  if (!imageBase64) return null;
  const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
  try {
    const res = await fetch("/analyze/subject", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ imageBase64, mimeType }),
    });
    if (!res.ok) return null;
    const data = await res.json() as AnalysisResult & { ok: boolean };
    return data.ok ? data : null;
  } catch { return null; }
}

function parseCSV(text: string): Partial<Athlete>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map(line => {
    const cells = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return {
      id:          `athlete-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name:        row.name ?? "",
      sport:       row.sport ?? "",
      event:       row.event ?? "",
      country:     row.country ?? "",
      age:         row.age ? parseInt(row.age) : undefined,
      height:      row.height ?? "",
      weight:      row.weight ?? "",
      status:      "pending" as const,
      image:       "/athletes/placeholder.jpg",
      captureDate: null,
    };
  }).filter(r => r.name);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, optional, children }: {
  label: string; optional?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">
        {label}
        {optional && <span className="text-muted-foreground/40 ml-1">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT = "w-full h-9 px-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground/50 transition-colors";

function Picker({ value, onChange, placeholder, options }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-9 pl-3 pr-8 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent transition-colors appearance-none text-foreground"
      >
        <option value="" disabled>{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" strokeWidth={1.75} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AddAthleteModal({ onClose, onAdded }: AddAthleteModalProps) {
  const [mode, setMode] = useState<"single" | "bulk">("single");

  const [name,    setName]    = useState("");
  const [sport,   setSport]   = useState("");
  const [events,  setEvents]  = useState<string[]>([]);
  const [country, setCountry] = useState("");
  const [age,     setAge]     = useState("");
  const [height,  setHeight]  = useState("");
  const [weight,  setWeight]  = useState("");

  // AI-inferred only — not shown in form
  const [build,    setBuild]    = useState("");
  const [skinTone, setSkinTone] = useState("");
  const [hair,     setHair]     = useState("");

  const [tattoos,    setTattoos]    = useState<TattooEntry[]>([]);
  const [addingTatt, setAddingTatt] = useState(false);
  const [newTatt,    setNewTatt]    = useState({ description: "", location: "" });

  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [analyzing,   setAnalyzing]   = useState(false);
  const [aiInferred,  setAiInferred]  = useState(false);
  const [saved,       setSaved]       = useState(false);

  const [csvRows,   setCsvRows]   = useState<Partial<Athlete>[]>([]);
  const [csvParsed, setCsvParsed] = useState(false);
  const [bulkSaved, setBulkSaved] = useState(false);

  const [eventDraft, setEventDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef  = useRef<HTMLInputElement>(null);

  const [inferError, setInferError] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressToDataUrl(file);
    setPreviewUrl(dataUrl);
    setAnalyzing(true);
    setAiInferred(false);
    setInferError(false);
    const result = await analyzePhoto(dataUrl);
    setAnalyzing(false);
    if (!result) {
      console.error("[AddAthleteModal] analyzePhoto returned null — check /analyze/subject");
      setInferError(true);
      return;
    }
    console.log("[AddAthleteModal] AI inference result:", result);
    if (result.build)               setBuild(result.build);
    if (result.skinTone)            setSkinTone(result.skinTone);
    if (result.hair)                setHair(result.hair);
    if (result.age && !age)         setAge(String(result.age));
    if (result.sport && !sport)     setSport(result.sport);
    setAiInferred(true);
  };

  const addEvent = () => {
    const v = eventDraft.trim();
    if (v && !events.includes(v)) setEvents(ev => [...ev, v]);
    setEventDraft("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const newAthlete: Athlete = {
      id:          `athlete-${Date.now()}`,
      name:        name.trim(),
      sport:       sport.trim(),
      event:       events.join(", "),
      status:      "pending",
      image:       previewUrl ?? "/athletes/placeholder.jpg",
      captureDate: null,
      country:     country.trim() || undefined,
      age:         age ? parseInt(age) : undefined,
      height:      height || undefined,
      weight:      weight || undefined,
      build:       build || undefined,
      skinTone:    skinTone || undefined,
      hair:        hair || undefined,
    };
    addAthlete(newAthlete);

    if (tattoos.length > 0) {
      const profile = createEmptyProfile(newAthlete.id);
      profile.tattoos = tattoos.map(t => ({ id: t.id, description: t.description, location: t.location, visible: true }));
      saveAthleteProfile(profile);
    }

    setSaved(true);
    toast({ type: "success", title: "Subject added", body: `${newAthlete.name} added — upload captures to complete their profile.` });
    onAdded?.(newAthlete);
    setTimeout(onClose, 900);
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setCsvRows(parseCSV(ev.target!.result as string)); setCsvParsed(true); };
    reader.readAsText(file);
  };

  const handleBulkImport = () => {
    csvRows.forEach(r => addAthlete(r as Athlete));
    setBulkSaved(true);
    toast({ type: "success", title: `${csvRows.length} subjects imported` });
    setTimeout(onClose, 900);
  };

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div onClick={e => e.stopPropagation()} className="bg-popover border border-border rounded-xl w-full max-w-md overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">Add subject</h2>
            <div className="flex gap-0.5 p-0.5 bg-secondary rounded-md">
              {(["single", "bulk"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors capitalize ${mode === m ? "bg-popover shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {m === "single" ? "Single" : "Bulk CSV"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="size-7 rounded-md flex items-center justify-center hover:bg-secondary">
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>

        {/* ── Single mode ── */}
        {mode === "single" && (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">

            {/* Photo */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Reference photo <span className="text-muted-foreground/40">(optional)</span>
              </label>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-accent/60 flex flex-col items-center justify-center gap-2 transition-colors overflow-hidden relative group bg-card">
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                      <Upload className="size-4 text-white" strokeWidth={1.75} />
                      <span className="text-xs text-white/80">Change</span>
                    </div>
                    {analyzing && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="size-5 text-accent animate-spin" strokeWidth={1.75} />
                        <span className="text-xs text-white/80">Analysing photo…</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Upload className="size-5 text-muted-foreground/40" strokeWidth={1.5} />
                    <span className="text-xs text-muted-foreground/60">Click to upload · JPG, PNG, WEBP</span>
                  </>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
              {aiInferred && (
                <p className="mt-1.5 text-[11px] text-accent/70 flex items-center gap-1">
                  <Sparkles className="size-3" strokeWidth={2} />
                  Build, skin tone &amp; hair inferred — override in subject profile if needed.
                </p>
              )}
              {inferError && (
                <p className="mt-1.5 text-[11px] text-amber-400/80 flex items-center gap-1">
                  <span>⚠</span> AI inference unavailable — attributes can be set in subject profile.
                </p>
              )}
            </div>

            {/* Name */}
            <Field label="Full name">
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Subject's full name" required autoFocus className={INPUT} />
            </Field>

            {/* Sport */}
            <Field label="Sport" optional>
              <input type="text" value={sport} onChange={e => setSport(e.target.value)}
                placeholder="e.g. Swimming" className={INPUT} />
            </Field>

            {/* Events */}
            <Field label="Events" optional>
              <div className="space-y-2">
                {events.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {events.map(ev => (
                      <span key={ev} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 border border-accent/20 rounded-full text-xs text-accent">
                        {ev}
                        <button type="button" onClick={() => setEvents(es => es.filter(e => e !== ev))}
                          className="hover:text-red-400 transition-colors">
                          <X className="size-2.5" strokeWidth={2} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5">
                  <input type="text" value={eventDraft} onChange={e => setEventDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEvent(); } }}
                    placeholder="e.g. 100m Freestyle — press Enter"
                    className={`${INPUT} flex-1`} />
                  <button type="button" onClick={addEvent}
                    className="h-9 px-3 rounded-md bg-card border border-border hover:bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors">
                    Add
                  </button>
                </div>
              </div>
            </Field>

            {/* Height + Weight */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Height" optional>
                <Picker value={height} onChange={setHeight} placeholder="Select height" options={HEIGHT_OPTIONS} />
              </Field>
              <Field label="Weight" optional>
                <Picker value={weight} onChange={setWeight} placeholder="Select weight" options={WEIGHT_OPTIONS} />
              </Field>
            </div>

            {/* Age + Country */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age" optional>
                <input type="number" value={age} onChange={e => setAge(e.target.value)}
                  placeholder="e.g. 28" min={16} max={60} className={INPUT} />
              </Field>
              <Field label="Country" optional>
                <input type="text" value={country} onChange={e => setCountry(e.target.value)}
                  placeholder="e.g. Australia" className={INPUT} />
              </Field>
            </div>

            {/* Tattoos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">
                  Tattoos & marks <span className="text-muted-foreground/40">(optional)</span>
                </label>
                <button type="button" onClick={() => setAddingTatt(true)}
                  className="h-6 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1">
                  <Plus className="size-3" strokeWidth={2} /> Add
                </button>
              </div>
              {tattoos.map(t => (
                <div key={t.id} className="flex items-start gap-2 p-2.5 bg-card border border-border rounded-md">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{t.description}</p>
                    <p className="text-[11px] text-muted-foreground">{t.location}</p>
                  </div>
                  <button type="button" onClick={() => setTattoos(ts => ts.filter(x => x.id !== t.id))}
                    className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              ))}
              {addingTatt && (
                <div className="bg-card border border-border rounded-md p-3 space-y-2">
                  <input type="text" placeholder="e.g. Wave tattoo on collarbone" value={newTatt.description}
                    onChange={e => setNewTatt(t => ({ ...t, description: e.target.value }))}
                    className={`${INPUT} text-xs`} autoFocus />
                  <div className="relative">
                    <select value={newTatt.location} onChange={e => setNewTatt(t => ({ ...t, location: e.target.value }))}
                      className="w-full h-9 pl-3 pr-8 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:border-accent transition-colors appearance-none">
                      <option value="">Select location</option>
                      {TATTOO_LOCATIONS.map(l => <option key={l}>{l}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" strokeWidth={1.75} />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={!newTatt.description || !newTatt.location}
                      onClick={() => {
                        if (!newTatt.description || !newTatt.location) return;
                        setTattoos(ts => [...ts, { id: crypto.randomUUID(), ...newTatt }]);
                        setNewTatt({ description: "", location: "" });
                        setAddingTatt(false);
                      }}
                      className="flex-1 h-7 rounded bg-foreground text-background text-xs font-medium hover:bg-foreground/90 disabled:opacity-40 transition-colors">
                      Save
                    </button>
                    <button type="button" onClick={() => { setAddingTatt(false); setNewTatt({ description: "", location: "" }); }}
                      className="h-7 px-3 rounded bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={!name.trim() || analyzing || saved}
                className="flex-1 h-9 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {saved
                  ? <><CheckCircle className="size-4" strokeWidth={2} /> Saved</>
                  : analyzing
                    ? <><Loader2 className="size-3.5 animate-spin" strokeWidth={2} /> Analysing…</>
                    : "Save subject"
                }
              </button>
              <button type="button" onClick={onClose}
                className="h-9 px-4 rounded-md bg-card border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ── Bulk CSV mode ── */}
        {mode === "bulk" && (
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <div className="p-3 bg-card border border-border rounded-lg space-y-1 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Expected CSV columns</p>
              <p className="font-mono text-[11px] text-muted-foreground/70">name, sport, event, height, weight, age, country</p>
              <p className="text-[11px]">First row must be headers. Export from Excel/Numbers as CSV.</p>
            </div>
            {!csvParsed ? (
              <button type="button" onClick={() => csvRef.current?.click()}
                className="w-full h-32 rounded-xl border-2 border-dashed border-border hover:border-accent/60 flex flex-col items-center justify-center gap-2 transition-colors bg-card">
                <FileText className="size-6 text-muted-foreground/40" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground/60">Click to upload CSV file</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{csvRows.length} subjects found</p>
                  <button onClick={() => { setCsvParsed(false); setCsvRows([]); }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors">Change file</button>
                </div>
                <div className="border border-border rounded-lg overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-card border-b border-border sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Name</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Sport</th>
                        <th className="text-left px-3 py-2 text-muted-foreground font-medium">Country</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i} className="border-t border-border hover:bg-card/50">
                          <td className="px-3 py-1.5 font-medium">{r.name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.sport || "—"}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.country || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <input ref={csvRef} type="file" accept=".csv,.txt" onChange={handleCsvFile} className="hidden" />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={handleBulkImport}
                disabled={!csvParsed || csvRows.length === 0 || bulkSaved}
                className="flex-1 h-9 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 text-accent-foreground text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {bulkSaved
                  ? <><CheckCircle className="size-4" strokeWidth={2} /> Imported</>
                  : `Import ${csvRows.length > 0 ? csvRows.length : ""} subjects`
                }
              </button>
              <button type="button" onClick={onClose}
                className="h-9 px-4 rounded-md bg-card border border-border hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
