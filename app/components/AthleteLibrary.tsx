import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Plus, Clock, X, Upload, Download, Sparkles, Camera, ShieldCheck } from "lucide-react";
import type { Athlete, AngleKey, AthleteProfile, CaptureAngle, TattooMark } from "../../data/athletes";
import { getAthletes, addAthlete, getQueue, type QueueItem, getAthleteProfile, saveAthleteProfile, createEmptyProfile } from "../lib/store";
import { compressToDataUrl } from "../lib/imageUtils";
import { toast } from "../lib/notifications";

interface AthleteLibraryProps {
  preSelectedAthleteId?: string | null;
  onAthleteDeselect?: () => void;
  onGenerate?: (id: string) => void;
}

const SPORTS = ["Track", "Swimming", "Weightlifting"] as const;

function athleteReadiness(a: Athlete): { pct: number; color: string; label: string } {
  if (a.status === "complete") return { pct: 100, color: "#10b981", label: "Ready" };
  if (a.status === "review")   return { pct: 60,  color: "#f59e0b", label: "Review" };
  return                              { pct: 20,  color: "#6b7280", label: "Pending" };
}

const FACE_ANGLES: { key: AngleKey; label: string }[] = [
  { key: "face-front", label: "Front" },
  { key: "face-left",  label: "Left" },
  { key: "face-right", label: "Right" },
  { key: "face-back",  label: "Back" },
  { key: "face-close", label: "Close" },
];

const BODY_ANGLES: { key: AngleKey; label: string }[] = [
  { key: "body-front", label: "Front" },
  { key: "body-left",  label: "Left" },
  { key: "body-right", label: "Right" },
  { key: "body-back",  label: "Back" },
];


export function AthleteLibrary({ preSelectedAthleteId, onAthleteDeselect, onGenerate }: AthleteLibraryProps) {
  const [athleteList, setAthleteList] = useState<Athlete[]>(getAthletes);
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(preSelectedAthleteId || null);
  const [activeTab, setActiveTab] = useState<"capture" | "identity" | "brand" | "history">("capture");
  const [searchQuery, setSearchQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [athleteHistory, setAthleteHistory] = useState<QueueItem[]>([]);

  // ── Profile state (persisted) ──────────────────────────────────────────────
  const [profile, setProfile] = useState<AthleteProfile | null>(null);

  // ── UI state for inline forms ──────────────────────────────────────────────
  const [addingMark, setAddingMark] = useState(false);
  const [newMark, setNewMark] = useState({ description: "", location: "" });
  const [newConstraint, setNewConstraint] = useState("");
  const [addingConstraint, setAddingConstraint] = useState(false);

  const angleFileRef = useRef<HTMLInputElement>(null);
  const [pendingAngle, setPendingAngle] = useState<AngleKey | null>(null);
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add-athlete form
  const [form, setForm] = useState({
    name: "", sport: "Track" as typeof SPORTS[number], event: "",
    height: "", weight: "", build: "", skinTone: "", hair: "",
    age: "", country: "",
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Load profile when selected athlete changes ─────────────────────────────
  useEffect(() => {
    if (preSelectedAthleteId) setSelectedAthlete(preSelectedAthleteId);
  }, [preSelectedAthleteId]);

  useEffect(() => {
    if (!selectedAthlete) { setProfile(null); return; }
    const stored = getAthleteProfile(selectedAthlete);
    setProfile(stored ?? createEmptyProfile(selectedAthlete));
  }, [selectedAthlete]);

  useEffect(() => {
    if (selectedAthlete) {
      const ath = athleteList.find(a => a.id === selectedAthlete);
      if (ath) {
        setAthleteHistory(
          getQueue().filter(q => q.athleteName === ath.name && q.status === "done")
        );
      }
    }
  }, [selectedAthlete, athleteList]);

  useEffect(() => {
    if (!showAddModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowAddModal(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAddModal]);

  // ── Persist profile helper ─────────────────────────────────────────────────
  const persistProfile = useCallback((patch: Partial<AthleteProfile>, current: AthleteProfile) => {
    const updated: AthleteProfile = {
      ...current,
      ...patch,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    setProfile(updated);
    try {
      saveAthleteProfile(updated);
    } catch {
      toast({ type: "error", title: "Storage full", body: "Profile could not be saved. Free up space or clear old data." });
    }
    return updated;
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filteredAthletes = athleteList.filter((ath) => {
    const matchesSearch =
      ath.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ath.sport.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ath.event.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSport = sportFilter === "all" || ath.sport === sportFilter;
    const matchesStatus = statusFilter === "all" || ath.status === statusFilter;
    return matchesSearch && matchesSport && matchesStatus;
  });

  const handleCloseAthlete = () => {
    setSelectedAthlete(null);
    onAthleteDeselect?.();
  };

  // ── Add athlete ────────────────────────────────────────────────────────────
  const handleAddAthlete = () => {
    if (!form.name.trim() || !form.event.trim()) return;
    const newAthlete: Athlete = {
      id: `athlete-${Date.now()}`,
      name: form.name.trim(),
      sport: form.sport,
      event: form.event.trim(),
      status: "pending",
      image: photoDataUrl ?? "/athletes/placeholder.jpg",
      captureDate: null,
      height: form.height || undefined,
      weight: form.weight || undefined,
      build: form.build || undefined,
      skinTone: form.skinTone || undefined,
      hair: form.hair || undefined,
      age: form.age ? parseInt(form.age) : undefined,
      country: form.country || undefined,
    };
    const updated = addAthlete(newAthlete);
    setAthleteList(updated);
    setShowAddModal(false);
    setForm({ name: "", sport: "Track", event: "", height: "", weight: "", build: "", skinTone: "", hair: "", age: "", country: "" });
    setPhotoPreview(null);
    setPhotoDataUrl(null);
    setSelectedAthlete(newAthlete.id);
  };

  // ── Capture angle upload ───────────────────────────────────────────────────
  const handleAngleUpload = async (angleKey: AngleKey, file: File) => {
    if (!profile) return;
    const dataUrl = await compressToDataUrl(file);
    const newAngle: CaptureAngle = {
      key: angleKey,
      dataUrl,
      uploadedAt: new Date().toISOString(),
    };
    const existing = profile.captureAngles.filter(a => a.key !== angleKey);
    persistProfile({ captureAngles: [...existing, newAngle] }, profile);
  };

  const openAnglePicker = (angle: AngleKey) => {
    setPendingAngle(angle);
    angleFileRef.current?.click();
  };

  // ── Tattoos ────────────────────────────────────────────────────────────────
  const handleAddMark = () => {
    if (!newMark.description.trim() || !profile) return;
    const mark: TattooMark = {
      id: `mark-${Date.now()}`,
      description: newMark.description.trim(),
      location: newMark.location.trim(),
      visible: true,
    };
    persistProfile({ tattoos: [...profile.tattoos, mark] }, profile);
    setNewMark({ description: "", location: "" });
    setAddingMark(false);
  };

  const handleRemoveMark = (markId: string) => {
    if (!profile) return;
    persistProfile({ tattoos: profile.tattoos.filter(m => m.id !== markId) }, profile);
  };

  const toggleMarkVisible = (markId: string) => {
    if (!profile) return;
    persistProfile({
      tattoos: profile.tattoos.map(m => m.id === markId ? { ...m, visible: !m.visible } : m),
    }, profile);
  };

  // ── Do-not-change constraints ──────────────────────────────────────────────
  const handleAddConstraint = () => {
    if (!newConstraint.trim() || !profile) return;
    persistProfile({ doNotChange: [...profile.doNotChange, newConstraint.trim()] }, profile);
    setNewConstraint("");
    setAddingConstraint(false);
  };

  const handleRemoveConstraint = (idx: number) => {
    if (!profile) return;
    persistProfile({ doNotChange: profile.doNotChange.filter((_, i) => i !== idx) }, profile);
  };

  // ── Identity notes (debounced save — 600ms after last keystroke) ───────────
  const handleNotesChange = (notes: string) => {
    if (!profile) return;
    const updated = { ...profile, notes };
    setProfile(updated);
    if (notesSaveTimer.current) clearTimeout(notesSaveTimer.current);
    notesSaveTimer.current = setTimeout(() => {
      try {
        saveAthleteProfile({ ...updated, version: updated.version + 1, updatedAt: new Date().toISOString() });
      } catch {
        toast({ type: "error", title: "Storage full", body: "Profile could not be saved." });
      }
    }, 600);
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getAngleDataUrl = (angleKey: AngleKey, athlete: Athlete): string | undefined => {
    const stored = profile?.captureAngles.find(a => a.key === angleKey);
    if (stored) return stored.dataUrl;
    // Fall back to athlete.image for front slots only if it's not a stale blob URL
    if ((angleKey === "face-front" || angleKey === "body-front") && athlete.image && !athlete.image.startsWith("blob:")) {
      return athlete.image;
    }
    return undefined;
  };

  const athlete = athleteList.find((a) => a.id === selectedAthlete);

  // ── AngleSlot sub-component ────────────────────────────────────────────────
  const AngleSlot = ({ angleKey, label, aspectRatio }: { angleKey: AngleKey; label: string; aspectRatio: string }) => {
    const img = athlete ? getAngleDataUrl(angleKey, athlete) : undefined;
    return (
      <button
        onClick={() => openAnglePicker(angleKey)}
        className="group relative overflow-hidden rounded-md border border-border hover:border-accent/40 transition-colors"
        style={{ aspectRatio }}
      >
        {img ? (
          <>
            <img src={img} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="size-4 text-white" strokeWidth={1.75} />
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-card flex flex-col items-center justify-center gap-1 text-muted-foreground group-hover:text-foreground transition-colors">
            <Camera className="size-4" strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute bottom-1 left-1.5 text-[10px] text-white/80 leading-none drop-shadow">{label}</span>
      </button>
    );
  };

  const capturedFaceCount = FACE_ANGLES.filter(a => athlete ? getAngleDataUrl(a.key, athlete) : false).length;
  const capturedBodyCount = BODY_ANGLES.filter(a => athlete ? getAngleDataUrl(a.key, athlete) : false).length;

  return (
    <div className="h-full flex bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{athleteList.length} athletes · {athleteList.filter(a => a.status === "complete").length} captured</p>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" strokeWidth={1.75} />
                <input
                  type="text"
                  placeholder="Search athletes…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-56 h-8 pl-8 pr-3 bg-card border border-border rounded-md text-sm focus-visible:border-accent placeholder:text-muted-foreground"
                />
              </div>
              <button
                onClick={() => setShowAddModal(true)}
                className="h-8 px-3 rounded-md bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-medium transition-colors flex items-center gap-1.5"
              >
                <Plus className="size-3.5" strokeWidth={2.25} />
                Add
              </button>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value)}
              className="h-8 px-3 bg-card border border-border rounded-md text-sm focus-visible:border-accent">
              <option value="all">All sports</option>
              {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-3 bg-card border border-border rounded-md text-sm focus-visible:border-accent">
              <option value="all">All statuses</option>
              <option value="complete">Complete</option>
              <option value="pending">Pending</option>
              <option value="review">Needs review</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredAthletes.map((ath) => (
              <div key={ath.id} className="group rounded-lg overflow-hidden bg-card border border-border hover:border-accent/40 transition-colors">
                <button onClick={() => setSelectedAthlete(ath.id)} className="block w-full text-left">
                  <div className="aspect-square overflow-hidden relative">
                    <img src={ath.image.startsWith("blob:") ? "/athletes/placeholder.jpg" : ath.image} alt={ath.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute top-2 right-2">
                      {ath.status === "complete" && <span className="text-xs font-medium bg-card/80 backdrop-blur-sm text-foreground px-1.5 py-0.5 rounded">Captured</span>}
                      {ath.status === "pending"  && <span className="text-xs font-medium bg-card/80 backdrop-blur-sm text-muted-foreground px-1.5 py-0.5 rounded">Pending</span>}
                      {ath.status === "review"   && <span className="text-xs font-medium bg-accent/20 text-accent px-1.5 py-0.5 rounded">Review</span>}
                    </div>
                  </div>
                </button>
                <div className="p-3 border-t border-border space-y-2">
                  <button onClick={() => setSelectedAthlete(ath.id)} className="text-left w-full">
                    <p className="text-sm font-medium truncate">{ath.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{ath.sport} · {ath.event}</p>
                  </button>
                  {(() => {
                    const r = athleteReadiness(ath);
                    return (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: r.pct + "%", backgroundColor: r.color }} />
                        </div>
                        <span className="text-xs shrink-0" style={{ color: r.color }}>{r.label}</span>
                      </div>
                    );
                  })()}
                  <button
                    onClick={() => onGenerate?.(ath.id)}
                    className="w-full h-7 rounded-md bg-secondary hover:bg-secondary/60 text-muted-foreground hover:text-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-border"
                  >
                    <Sparkles className="size-3" strokeWidth={2.25} />
                    Generate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {athlete && (
        <div className="w-[480px] border-l border-border bg-background overflow-y-auto flex-shrink-0">
          <div className="sticky top-0 bg-background border-b border-border z-10">
            <div className="px-5 pt-5 pb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground tracking-tight">{athlete.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{athlete.sport} · {athlete.event}</p>
              </div>
              <button onClick={handleCloseAthlete} className="p-1.5 hover:bg-secondary rounded transition-colors">
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </div>
            <div className="px-5 flex gap-5">
              {(["capture", "identity", "brand", "history"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 border-b-2 transition-colors text-sm font-medium capitalize ${activeTab === tab ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">

            {/* ── CAPTURE TAB ── */}
            {activeTab === "capture" && (
              <div className="space-y-6">
                {/* Face captures */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Face captures</h3>
                    <span className="text-xs text-muted-foreground">{capturedFaceCount} / {FACE_ANGLES.length}</span>
                  </div>
                  {(() => {
                    const r = athleteReadiness(athlete);
                    return (
                      <div className="flex items-center justify-between bg-card border border-border rounded-md px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">Likeness quality</p>
                          <p className="text-xs text-muted-foreground">Upload more angles to improve</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold" style={{ color: r.color }}>{r.pct}%</p>
                          <p className="text-xs text-muted-foreground">{r.label}</p>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="grid grid-cols-5 gap-1.5">
                    {FACE_ANGLES.map(a => <AngleSlot key={a.key} angleKey={a.key} label={a.label} aspectRatio="3/4" />)}
                  </div>
                </div>

                {/* Body captures */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full body</h3>
                    <span className="text-xs text-muted-foreground">{capturedBodyCount} / {BODY_ANGLES.length}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {BODY_ANGLES.map(a => <AngleSlot key={a.key} angleKey={a.key} label={a.label} aspectRatio="2/5" />)}
                  </div>
                </div>

                {/* Tattoos & marks */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tattoos & marks</h3>
                    <button onClick={() => setAddingMark(true)}
                      className="h-6 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1">
                      <Plus className="size-3" strokeWidth={2} /> Add
                    </button>
                  </div>

                  {addingMark && (
                    <div className="bg-card border border-border rounded-md p-3 space-y-2">
                      <input type="text" placeholder="Description (e.g. Eagle tattoo)" value={newMark.description}
                        onChange={e => setNewMark(m => ({ ...m, description: e.target.value }))}
                        className="w-full h-8 px-3 bg-secondary border border-border rounded text-sm placeholder:text-muted-foreground focus-visible:border-accent" autoFocus />
                      <input type="text" placeholder="Location (e.g. Left forearm)" value={newMark.location}
                        onChange={e => setNewMark(m => ({ ...m, location: e.target.value }))}
                        className="w-full h-8 px-3 bg-secondary border border-border rounded text-sm placeholder:text-muted-foreground focus-visible:border-accent" />
                      <div className="flex gap-2">
                        <button onClick={handleAddMark}
                          className="flex-1 h-7 rounded bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors">Save</button>
                        <button onClick={() => { setAddingMark(false); setNewMark({ description: "", location: "" }); }}
                          className="h-7 px-3 rounded bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}

                  {(profile?.tattoos ?? []).length === 0 && !addingMark ? (
                    <p className="text-xs text-muted-foreground py-2">No marks recorded</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(profile?.tattoos ?? []).map(mark => (
                        <div key={mark.id} className="flex items-start justify-between gap-2 py-2 px-3 bg-card border border-border rounded-md">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{mark.description}</p>
                            {mark.location && <p className="text-xs text-muted-foreground">{mark.location}</p>}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => toggleMarkVisible(mark.id)}
                              title={mark.visible ? "Visible in prompts" : "Hidden from prompts"}
                              className={`text-xs px-1.5 py-0.5 rounded transition-colors ${mark.visible ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground/50 bg-secondary"}`}>
                              {mark.visible ? "visible" : "hidden"}
                            </button>
                            <button onClick={() => handleRemoveMark(mark.id)}
                              className="p-0.5 hover:bg-secondary rounded transition-colors">
                              <X className="size-3 text-muted-foreground" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Do-not-change constraints */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Do-not-change rules</h3>
                    </div>
                    <button onClick={() => setAddingConstraint(true)}
                      className="h-6 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1">
                      <Plus className="size-3" strokeWidth={2} /> Add
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground/70">These constraints are automatically injected into every generation prompt for this athlete.</p>

                  {addingConstraint && (
                    <div className="bg-card border border-border rounded-md p-3 space-y-2">
                      <input type="text" placeholder="e.g. never remove chest tattoo"
                        value={newConstraint} onChange={e => setNewConstraint(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleAddConstraint(); if (e.key === "Escape") { setAddingConstraint(false); setNewConstraint(""); } }}
                        className="w-full h-8 px-3 bg-secondary border border-border rounded text-sm placeholder:text-muted-foreground focus-visible:border-accent" autoFocus />
                      <div className="flex gap-2">
                        <button onClick={handleAddConstraint}
                          className="flex-1 h-7 rounded bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors">Save</button>
                        <button onClick={() => { setAddingConstraint(false); setNewConstraint(""); }}
                          className="h-7 px-3 rounded bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}

                  {(profile?.doNotChange ?? []).length === 0 && !addingConstraint ? (
                    <p className="text-xs text-muted-foreground py-1">No constraints set</p>
                  ) : (
                    <div className="space-y-1">
                      {(profile?.doNotChange ?? []).map((rule, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 bg-card border border-border rounded-md">
                          <p className="text-xs text-foreground flex-1">{rule}</p>
                          <button onClick={() => handleRemoveConstraint(idx)}
                            className="p-0.5 hover:bg-secondary rounded transition-colors shrink-0">
                            <X className="size-3 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Metadata */}
                {athlete.status !== "pending" && (
                  <div className="bg-card border border-border rounded-md overflow-hidden">
                    {[
                      { label: "Capture date", value: athlete.captureDate ?? "—" },
                      { label: "Profile version", value: `v${profile?.version ?? 0}` },
                    ].map((row, i, arr) => (
                      <div key={row.label} className={`flex justify-between px-3 py-2 text-sm ${i < arr.length - 1 ? "border-b border-border" : ""}`}>
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {athlete.status === "pending" && (
                  <div className="bg-secondary border border-border rounded-md p-6 text-center space-y-3">
                    <Clock className="size-8 mx-auto text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">No captures yet</p>
                    <p className="text-xs text-muted-foreground">Click any angle slot above to upload</p>
                  </div>
                )}
              </div>
            )}

            {/* ── IDENTITY TAB ── */}
            {activeTab === "identity" && (
              <div className="space-y-5">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3">Physical features</h4>
                  <div className="bg-card border border-border rounded-md overflow-hidden text-sm">
                    {[
                      { label: "Height", value: athlete.height },
                      { label: "Weight", value: athlete.weight },
                      { label: "Build", value: athlete.build },
                      { label: "Skin tone", value: athlete.skinTone },
                      { label: "Hair", value: athlete.hair },
                      { label: "Age", value: athlete.age?.toString() },
                      { label: "Country", value: athlete.country },
                    ].filter(r => r.value).map((row, i, arr) => (
                      <div key={row.label} className={`flex justify-between px-3 py-2 ${i < arr.length - 1 ? "border-b border-border" : ""}`}>
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Identity notes */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Identity notes</h4>
                  <p className="text-xs text-muted-foreground/70">Scars, distinguishing marks, expression preferences, wardrobe constraints.</p>
                  <textarea
                    value={profile?.notes ?? ""}
                    onChange={e => handleNotesChange(e.target.value)}
                    rows={4}
                    placeholder="e.g. Prominent scar on left chin — keep visible. Prefers slightly squinted expression. Chest tattoo must always be visible."
                    className="w-full px-3 py-2 bg-card border border-border rounded-md text-sm resize-none focus:outline-none focus:border-accent placeholder:text-muted-foreground/50"
                  />
                </div>

                {/* Approved likeness */}
                {(profile?.approvedLikeness ?? []).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground">Approved likeness</h4>
                    <p className="text-xs text-muted-foreground/70">Mark outputs as likeness references from the campaign workspace.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(profile?.approvedLikeness ?? []).map((item, idx) => (
                        <div key={idx} className="rounded-md overflow-hidden border border-border bg-card group relative">
                          <div className="aspect-[3/4] overflow-hidden">
                            <img src={item.imageUrl} alt="Approved likeness" className="w-full h-full object-cover" />
                          </div>
                          <p className="text-[10px] text-muted-foreground p-2 truncate">{item.context || "Approved reference"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── BRAND TAB ── */}
            {activeTab === "brand" && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground">Uniform variants</h4>
                <div className="grid grid-cols-2 gap-2">
                  {["Team Official", "Competition Gear", "Podium Ceremony", "Training Gear"].map((kit) => (
                    <div key={kit} className="bg-card border border-border rounded-md overflow-hidden text-center">
                      <div className="aspect-square overflow-hidden">
                        <img src={athlete.image.startsWith("blob:") ? "/athletes/placeholder.jpg" : athlete.image} alt={kit} className="w-full h-full object-cover opacity-40 grayscale" />
                      </div>
                      <p className="text-xs text-muted-foreground p-2">{kit}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === "history" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-foreground">Generated assets</h4>
                  <span className="text-xs text-muted-foreground">{athleteHistory.length} total</span>
                </div>
                {athleteHistory.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="text-sm">No renders yet</p>
                    <p className="text-xs mt-1">Generate from Studio to see results here</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {athleteHistory.map((item) => (
                      <div key={item.id} className="aspect-square bg-black rounded-md overflow-hidden relative group cursor-pointer">
                        {item.resultUrl && (
                          item.type === "video"
                            ? <video src={item.resultUrl} className="w-full h-full object-cover" muted />
                            : <img src={item.resultUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                          <p className="text-white text-xs truncate">{item.name}</p>
                          {item.resultUrl && (
                            <a href={item.resultUrl} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-1 bg-white/20 hover:bg-white/40 rounded transition-colors">
                              <Download className="size-3 text-white" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden angle file input */}
      <input
        ref={angleFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && pendingAngle) handleAngleUpload(pendingAngle, file);
          e.target.value = "";
          setPendingAngle(null);
        }}
      />

      {/* ── Add Athlete Modal ── */}
      {showAddModal && (
        <div onClick={() => setShowAddModal(false)} className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div onClick={e => e.stopPropagation()} className="bg-card border border-border rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-border sticky top-0 bg-card z-10">
              <h2 className="text-sm font-semibold text-foreground">Add athlete</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-secondary rounded transition-colors">
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Reference photo</p>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="aspect-[3/2] bg-secondary border border-dashed border-border hover:border-border/60 flex items-center justify-center cursor-pointer transition-colors overflow-hidden rounded-md"
                >
                  {photoPreview
                    ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    : <div className="text-center space-y-2">
                        <Upload className="size-5 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">Click to upload</p>
                        <p className="text-xs text-muted-foreground">JPG, PNG, WEBP</p>
                      </div>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const dataUrl = await compressToDataUrl(file);
                  setPhotoPreview(dataUrl);
                  setPhotoDataUrl(dataUrl);
                }} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Full name *", key: "name", placeholder: "Alicia Monroe", col: "col-span-2" },
                  { label: "Sport *", key: "sport", type: "select" },
                  { label: "Event *", key: "event", placeholder: "100m Freestyle" },
                  { label: "Height", key: "height", placeholder: "5'8\" (173cm)" },
                  { label: "Weight", key: "weight", placeholder: "145 lbs (66kg)" },
                  { label: "Build", key: "build", placeholder: "Athletic swimmer" },
                  { label: "Skin tone", key: "skinTone", placeholder: "Medium brown" },
                  { label: "Hair", key: "hair", placeholder: "Long braids" },
                  { label: "Age", key: "age", placeholder: "24", type: "number" },
                  { label: "Country", key: "country", placeholder: "USA" },
                ].map(({ label, key, placeholder, type, col }) => (
                  <div key={key} className={col ?? ""}>
                    <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
                    {type === "select" ? (
                      <select value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full h-9 px-3 bg-secondary border border-border rounded-md text-sm focus-visible:border-accent">
                        {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input type={type ?? "text"} placeholder={placeholder} value={(form as any)[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full h-9 px-3 bg-secondary border border-border rounded-md text-sm focus-visible:border-accent placeholder:text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 pb-5 flex gap-2">
              <button onClick={handleAddAthlete} disabled={!form.name.trim() || !form.event.trim()}
                className="flex-1 h-9 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-accent-foreground text-sm font-medium transition-colors">
                Add athlete
              </button>
              <button onClick={() => setShowAddModal(false)}
                className="h-9 px-4 rounded-md bg-secondary border border-border hover:bg-secondary/60 text-muted-foreground hover:text-foreground text-sm transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
