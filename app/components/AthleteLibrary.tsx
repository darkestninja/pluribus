import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Plus, X, Upload, Download, Sparkles, Camera, ShieldCheck, Pencil, Trash2, Check, ChevronDown, FlaskConical, LayoutGrid, List, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { HEIGHT_OPTIONS, WEIGHT_OPTIONS, AddAthleteModal } from "./AddAthleteModal";
import type { Athlete, AngleKey, AthleteProfile, CaptureAngle, TattooMark } from "../../data/athletes";
import { getAthletes, saveAthletes, addAthlete, getCampaignOutputs, getAthleteProfile, saveAthleteProfile, createEmptyProfile, removeRejectedLikeness, getProfileCompleteness, saveCanonicalSet, getCollabTasks, getUsageConsent, savePortalInvite, revokePortalToken, subscribeToStore, USAGE_SCOPE_LABELS, type CampaignOutput, type RejectedLikeness, type CollabTask, type UsageScope } from "../lib/store";
import { calculateIdentityReadiness, READINESS_CONFIG } from "../lib/identityReadiness";
import { ReadinessBadge } from "./ReadinessBadge";
import { compressToDataUrl } from "../lib/imageUtils";
import { toast } from "../lib/notifications";
import { uploadFile, referenceImagePath } from "../lib/storage";
import { uploadToFalCdn } from "../lib/generate";
import { supabase } from "../lib/supabase";

interface AthleteLibraryProps {
  preSelectedAthleteId?: string | null;
  onAthleteDeselect?: () => void;
  onGenerate?: (id: string) => void;
}

const CAPTURE_FRAMES: { key: AngleKey; label: string; hint: string; aspect: string }[] = [
  { key: "face-close",     label: "Face close-up",   hint: "Tight crop, eye-level, neutral expression", aspect: "3/4" },
  { key: "front-passport", label: "Front — Portrait", hint: "Head & shoulders, facing camera",          aspect: "3/4" },
  { key: "front-body",     label: "Front — Body",    hint: "Full body, neutral stance",                  aspect: "3/4" },
  { key: "left-passport",  label: "Left — Portrait", hint: "Head & shoulders, 90° left",                aspect: "3/4" },
  { key: "left-body",      label: "Left — Body",     hint: "Full body, 90° left profile",                aspect: "3/4" },
  { key: "right-passport", label: "Right — Portrait", hint: "Head & shoulders, 90° right",              aspect: "3/4" },
  { key: "right-body",     label: "Right — Body",    hint: "Full body, 90° right profile",               aspect: "3/4" },
  { key: "back-passport",  label: "Back — Portrait", hint: "Head & shoulders, facing away",              aspect: "3/4" },
  { key: "back-body",      label: "Back — Body",     hint: "Full body, facing away",                     aspect: "3/4" },
];

function captureReadiness(count: number): { pct: number; color: string; label: string } {
  const pct = Math.round((count / CAPTURE_FRAMES.length) * 100);
  if (pct >= 100) return { pct: 100, color: "#10b981", label: "Complete" };
  if (pct >= 67)  return { pct,      color: "#f59e0b", label: "Good" };
  if (pct >= 33)  return { pct,      color: "#6b7280", label: "Needs more" };
  return { pct: Math.max(pct, 0),    color: "#6b7280", label: "Pending" };
}

// ── Progress ring ─────────────────────────────────────────────────────────────
function ProgressRing({ pct, color, size = 30 }: { pct: number; color: string; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="2.5"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} strokeLinecap="round" />
    </svg>
  );
}

// ── Capture silhouette placeholders ───────────────────────────────────────────
const SILHOUETTE_SRCS: Record<string, string> = {
  "face-close":     "/placeholders/face-close.svg",
  "front-passport": "/placeholders/head-front.svg",
  "front-body":     "/placeholders/body-front.svg",
  "left-passport":  "/placeholders/head-left.svg",
  "left-body":      "/placeholders/body-left.svg",
  "right-passport": "/placeholders/head-right.svg",
  "right-body":     "/placeholders/body-right.svg",
  "back-passport":  "/placeholders/head-back.svg",
  "back-body":      "/placeholders/body-back.svg",
};

function getAngleSilhouette(key: string): React.ReactNode {
  const src = SILHOUETTE_SRCS[key] ?? "/placeholders/body-front.svg";
  const isBody = key.endsWith("-body");
  return (
    <img
      src={src}
      alt=""
      className={`object-contain opacity-[0.12] dark:opacity-[0.18] dark:invert ${isBody ? "h-28" : "h-20"}`}
    />
  );
}

// Legacy angle keys — kept for backward-compat with stored profiles
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



// ── Body map for tattoo placement ─────────────────────────────────────────────
function TattooBodyMap({ x, y, view, onPlace, interactive = true }: {
  x?: number; y?: number; view: "front" | "back";
  onPlace: (x: number, y: number) => void;
  interactive?: boolean;
}) {
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const py = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onPlace(px, py);
  };
  const hasPinX = x !== undefined && x >= 0;
  const hasPinY = y !== undefined && y >= 0;
  return (
    <svg
      viewBox="0 0 60 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-full text-muted-foreground ${interactive ? "cursor-crosshair hover:text-foreground transition-colors" : ""}`}
      onClick={handleClick}
      style={{ userSelect: "none" }}
    >
      <ellipse cx="30" cy="9" rx="9" ry="9" />
      <path d="M25 17 L24 22 M35 17 L36 22" />
      <path d="M24 22 L8 27 M36 22 L52 27" />
      <path d="M8 27 L4 52 M17 26 L13 52" />
      <path d="M52 27 L56 52 M43 26 L47 52" />
      <line x1="17" y1="26" x2="15" y2="78" />
      <line x1="43" y1="26" x2="45" y2="78" />
      <path d="M15 68 C19 70 41 70 45 68" />
      <path d="M15 78 L13 84 L47 84 L45 78" />
      <line x1="13" y1="84" x2="11" y2="108" />
      <line x1="27" y1="84" x2="25" y2="108" />
      <line x1="33" y1="84" x2="35" y2="108" />
      <line x1="47" y1="84" x2="49" y2="108" />
      <path d="M11 108 L7 112 M25 108 L29 112" />
      <path d="M35 108 L31 112 M49 108 L53 112" />
      {view === "front" ? (
        <>
          <line x1="23" y1="8" x2="27" y2="8" />
          <line x1="33" y1="8" x2="37" y2="8" />
        </>
      ) : (
        <line x1="30" y1="23" x2="30" y2="76" strokeDasharray="2,3" />
      )}
      {hasPinX && hasPinY && (
        <>
          <circle cx={(x! / 100) * 60} cy={(y! / 100) * 120} r="4" fill="#ef4444" stroke="white" strokeWidth="1.5" />
          <line x1={(x! / 100) * 60} y1={(y! / 100) * 120 - 7} x2={(x! / 100) * 60} y2={(y! / 100) * 120 - 4} stroke="#ef4444" strokeWidth="1.2" />
        </>
      )}
    </svg>
  );
}

function bodyPosToLocation(x: number, y: number, view: "front" | "back"): string {
  const side = x > 50 ? "left" : "right";
  if (y < 9) return "head";
  if (y < 18) return "neck";
  if (y < 26) {
    if (x < 18 || x > 82) return `${side} shoulder`;
    return view === "front" ? "upper chest" : "upper back";
  }
  if (y < 46) {
    if (x < 14 || x > 86) return `${side} upper arm`;
    if (x < 22 || x > 78) return `${side} forearm`;
    return view === "front" ? "chest" : "back";
  }
  if (y < 60) {
    if (x < 14 || x > 86) return `${side} forearm`;
    return view === "front" ? "abdomen" : "lower back";
  }
  if (y < 68) return view === "front" ? `${side} hip` : `${side} glute`;
  if (y < 82) return `${side} thigh`;
  if (y < 90) return `${side} knee`;
  if (y < 98) return `${side} calf`;
  return `${side} foot`;
}

export function AthleteLibrary({ preSelectedAthleteId, onAthleteDeselect, onGenerate }: AthleteLibraryProps) {
  const [athleteList, setAthleteList] = useState<Athlete[]>(getAthletes);

  useEffect(() => subscribeToStore(() => setAthleteList(getAthletes())), []);
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(preSelectedAthleteId || null);
  const [activeTab, setActiveTab] = useState<"capture" | "identity" | "brand" | "history" | "collab">("capture");
  const [searchQuery, setSearchQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [athleteHistory, setAthleteHistory] = useState<CampaignOutput[]>([]);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [thumbnailTargetId, setThumbnailTargetId] = useState<string | null>(null);

  // ── Profile state (persisted) ──────────────────────────────────────────────
  const [profile, setProfile] = useState<AthleteProfile | null>(null);

  // ── UI state for inline forms ──────────────────────────────────────────────
  const [addingMark, setAddingMark] = useState(false);
  const [newMark, setNewMark] = useState({ description: "", location: "", imageDataUrl: "", bodyX: -1, bodyY: -1, bodyView: "front" as "front" | "back" });
  const tattooFileRef = useRef<HTMLInputElement>(null);
  const [newConstraint, setNewConstraint] = useState("");
  const [addingConstraint, setAddingConstraint] = useState(false);

  // ── Edit attributes / delete ──────────────────────────────────────────────
  const [editingAttrs, setEditingAttrs] = useState(false);
  const [attrForm, setAttrForm] = useState({ name: "", sport: "", event: "", height: "", weight: "", build: "", skinTone: "", hair: "", age: "", country: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [userId, setUserId] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "sport" | "date-added">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeSportFilter, setActiveSportFilter] = useState("");
  const [analyzingSubjectId, setAnalyzingSubjectId] = useState<string | null>(null);
  const angleFileRef = useRef<HTMLInputElement>(null);
  const [pendingAngle, setPendingAngle] = useState<AngleKey | null>(null);
  const [uploadingAngles, setUploadingAngles] = useState<Set<AngleKey>>(new Set());
  const notesSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loraTraining, setLoraTraining] = useState(false);
  const loraPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [canonicalValidating, setCanonicalValidating] = useState(false);
  const canonicalPollerRef = useRef<ReturnType<typeof setInterval> | null>(null);


  // ── Resolve logged-in user ID ──────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) setUserId(session.user.id);
    });
  }, []);

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
      setAthleteHistory(
        getCampaignOutputs().filter(o => o.athleteId === selectedAthlete)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    }
  }, [selectedAthlete]);

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

  // Derive subject status from actual capture progress (ignores stale stored status)
  const derivedStatus = (ath: Athlete): "complete" | "pending" | "review" => {
    const pct = getProfileCompleteness(getAthleteProfile(ath.id), ath);
    if (pct >= 100) return "complete";
    if (pct > 0) return "review";
    return "pending";
  };

  // ── Derived sport list for filter chips ───────────────────────────────────
  const uniqueSports = Array.from(new Set(athleteList.map(a => a.sport).filter(Boolean))).sort();

  // ── Filtering + sorting ────────────────────────────────────────────────────
  const filteredAthletes = athleteList
    .filter((ath) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        ath.name.toLowerCase().includes(q) ||
        ath.sport.toLowerCase().includes(q) ||
        ath.event.toLowerCase().includes(q);
      const matchesSport = !activeSportFilter || ath.sport === activeSportFilter;
      const matchesStatus = statusFilter === "all" || derivedStatus(ath) === statusFilter;
      return matchesSearch && matchesSport && matchesStatus;
    })
    .sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortBy === "name") return dir * a.name.localeCompare(b.name);
      if (sortBy === "sport") return dir * a.sport.localeCompare(b.sport);
      // date-added: preserve original array order (insertion order)
      return dir * (athleteList.indexOf(a) - athleteList.indexOf(b));
    });

  const handleCloseAthlete = () => {
    setSelectedAthlete(null);
    onAthleteDeselect?.();
  };

  // ── Thumbnail edit ────────────────────────────────────────────────────────
  const handleThumbnailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !thumbnailTargetId) return;
    const dataUrl = await compressToDataUrl(file);
    const updated = athleteList.map(a =>
      a.id === thumbnailTargetId ? { ...a, image: dataUrl } : a
    );
    setAthleteList(updated);
    saveAthletes(updated);
    setThumbnailTargetId(null);
    e.target.value = "";
  };

  // ── Auto-analyze subject from face capture ────────────────────────────────
  const autoAnalyzeSubject = useCallback(async (ath: Athlete, dataUrl: string) => {
    if (ath.build && ath.skinTone && ath.hair) return; // already filled
    if (analyzingSubjectId === ath.id) return;
    setAnalyzingSubjectId(ath.id);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const [, b64] = dataUrl.split(",");
      const mimeType = dataUrl.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
      const res = await fetch("/analyze/subject", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64: b64, mimeType }),
      });
      const data = await res.json() as { ok: boolean; build?: string; skinTone?: string; hair?: string; age?: number };
      if (!data.ok) return;
      const updated: Athlete = {
        ...ath,
        build:    ath.build    || data.build    || undefined,
        skinTone: ath.skinTone || data.skinTone || undefined,
        hair:     ath.hair     || data.hair     || undefined,
        age:      ath.age      || data.age      || undefined,
      };
      const next = athleteList.map(a => a.id === updated.id ? updated : a);
      saveAthletes(next);
      setAthleteList(next);
    } catch { /* non-blocking */ } finally {
      setAnalyzingSubjectId(null);
    }
  }, [athleteList, analyzingSubjectId]);

  // ── Capture angle upload ───────────────────────────────────────────────────
  const handleAngleUpload = async (angleKey: AngleKey, file: File) => {
    if (!profile || !selectedAthlete || !userId) return;

    setUploadingAngles(prev => new Set(prev).add(angleKey));
    const dataUrl = await compressToDataUrl(file);

    // Auto-analyze subject attributes from face captures (non-blocking)
    if ((angleKey === "face-close" || angleKey === "front-passport") && athlete) {
      autoAnalyzeSubject(athlete, dataUrl);
    }

    try {
      const storagePath = referenceImagePath(userId, selectedAthlete, angleKey);
      const stored = await uploadFile(storagePath, file, file.type || "image/jpeg");
      if (!stored?.signedUrl) throw new Error("Upload failed — no signed URL returned");

      const existing = profile.captureAngles.filter(a => a.key !== angleKey);
      const newAngle: CaptureAngle = {
        key:        angleKey,
        storageUrl: stored.signedUrl,
        storagePath: stored.path,
        uploadedAt: new Date().toISOString(),
      };
      persistProfile({ captureAngles: [...existing, newAngle] }, profile);

      // Cache on fal CDN for fast generation (non-blocking)
      uploadToFalCdn(dataUrl).then(falCdnUrl => {
        const p = getAthleteProfile(selectedAthlete);
        if (p) {
          const angles = p.captureAngles.map(a => a.key === angleKey ? { ...a, falCdnUrl } : a);
          saveAthleteProfile({ ...p, captureAngles: angles, version: p.version + 1, updatedAt: new Date().toISOString() });
        }
      }).catch(() => {});
    } catch (err) {
      toast({ type: "error", title: "Upload failed", body: err instanceof Error ? err.message : "Could not save reference image" });
    } finally {
      setUploadingAngles(prev => { const s = new Set(prev); s.delete(angleKey); return s; });
    }
  };

  const openAnglePicker = (angle: AngleKey) => {
    setPendingAngle(angle);
    angleFileRef.current?.click();
  };

  // ── Tattoos ────────────────────────────────────────────────────────────────
  const handleTattooImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await compressToDataUrl(file);
    setNewMark(m => ({ ...m, imageDataUrl: dataUrl }));
    e.target.value = "";
  };

  const resetNewMark = () => ({ description: "", location: "", imageDataUrl: "", bodyX: -1, bodyY: -1, bodyView: "front" as "front" | "back" });

  const handleAddMark = () => {
    if (!newMark.description.trim() || !profile) return;
    const mark: TattooMark = {
      id: `mark-${Date.now()}`,
      description: newMark.description.trim(),
      location: newMark.location.trim(),
      visible: true,
      imageUrl: newMark.imageDataUrl || undefined,
      bodyX: newMark.bodyX >= 0 ? newMark.bodyX : undefined,
      bodyY: newMark.bodyY >= 0 ? newMark.bodyY : undefined,
      bodyView: (newMark.bodyX >= 0 ? newMark.bodyView : undefined),
    };
    persistProfile({ tattoos: [...profile.tattoos, mark] }, profile);
    setNewMark(resetNewMark());
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

  // ── Edit physical attributes ───────────────────────────────────────────────
  const openEditAttrs = (ath: Athlete) => {
    setAttrForm({
      name: ath.name,
      sport: ath.sport,
      event: ath.event,
      height: ath.height ?? "",
      weight: ath.weight ?? "",
      build: ath.build ?? "",
      skinTone: ath.skinTone ?? "",
      hair: ath.hair ?? "",
      age: ath.age?.toString() ?? "",
      country: ath.country ?? "",
    });
    setEditingAttrs(true);
    setActiveTab("identity");
  };

  const saveAttrs = () => {
    if (!athlete) return;
    const updated: Athlete = {
      ...athlete,
      name: attrForm.name.trim() || athlete.name,
      sport: attrForm.sport,
      event: attrForm.event,
      height: attrForm.height || undefined,
      weight: attrForm.weight || undefined,
      build: attrForm.build || undefined,
      skinTone: attrForm.skinTone || undefined,
      hair: attrForm.hair || undefined,
      age: attrForm.age ? parseInt(attrForm.age) : undefined,
      country: attrForm.country || undefined,
    };
    const next = athleteList.map(a => a.id === updated.id ? updated : a);
    saveAthletes(next);
    setAthleteList(next);
    setEditingAttrs(false);
  };

  // ── Delete subject ─────────────────────────────────────────────────────────
  const handleDeleteAthlete = () => {
    if (!athlete) return;
    const next = athleteList.filter(a => a.id !== athlete.id);
    saveAthletes(next);
    setAthleteList(next);
    setSelectedAthlete(null);
    setConfirmDelete(false);
    onAthleteDeselect?.();
  };

  // ── Remove approved likeness ───────────────────────────────────────────────
  const handleRemoveLikeness = (idx: number) => {
    if (!profile) return;
    persistProfile({ approvedLikeness: profile.approvedLikeness.filter((_, i) => i !== idx) }, profile);
  };

  // ── Remove rejected likeness ───────────────────────────────────────────────
  const handleRemoveRejectedLikeness = (idx: number) => {
    if (!selectedAthlete || !profile) return;
    removeRejectedLikeness(selectedAthlete, idx);
    setProfile(prev => prev ? {
      ...prev,
      rejectedLikeness: (prev.rejectedLikeness ?? []).filter((_, i) => i !== idx),
    } : prev);
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

  // ── LoRA polling (shared between start and auto-resume) ───────────────────
  const startLoraPoller = useCallback((requestId: string, baseProfile: AthleteProfile, athleteName: string) => {
    if (loraPollerRef.current) clearInterval(loraPollerRef.current);
    loraPollerRef.current = setInterval(async () => {
      try {
        const sess = (await supabase.auth.getSession()).data.session;
        const sr = await fetch(`/api/fal/train/status?requestId=${requestId}`, {
          headers: { "Authorization": `Bearer ${sess?.access_token ?? ""}` },
        });
        const s = await sr.json() as { ok: boolean; status: string; loraUrl?: string };
        if (s.status === "ready" && s.loraUrl) {
          clearInterval(loraPollerRef.current!);
          setLoraTraining(false);
          const current = getAthleteProfile(baseProfile.athleteId) ?? baseProfile;
          const done = { ...current, loraStatus: "ready" as const, loraUrl: s.loraUrl, loraTrainedAt: new Date().toISOString() };
          setProfile(done);
          saveAthleteProfile(done);
          toast({ type: "success", title: "Likeness trained!", body: `${athleteName}'s LoRA is ready — future generations will use it automatically.` });
        } else if (s.status === "failed") {
          clearInterval(loraPollerRef.current!);
          setLoraTraining(false);
          const current = getAthleteProfile(baseProfile.athleteId) ?? baseProfile;
          const fail = { ...current, loraStatus: "failed" as const };
          setProfile(fail);
          saveAthleteProfile(fail);
          toast({ type: "error", title: "Training failed", body: "Check captures and retry." });
        }
      } catch { /* keep polling */ }
    }, 30_000);
  }, []);

  // ── Auto-resume polling if training was in progress when page loaded ───────
  useEffect(() => {
    if (!profile?.loraJobId || profile.loraStatus !== "training") return;
    if (loraPollerRef.current) return;
    const athleteName = athleteList.find(a => a.id === profile.athleteId)?.name ?? "Athlete";
    setLoraTraining(true);
    startLoraPoller(profile.loraJobId, profile, athleteName);
    return () => {
      if (loraPollerRef.current) { clearInterval(loraPollerRef.current); loraPollerRef.current = null; }
    };
  }, [profile?.loraJobId, profile?.loraStatus, profile?.athleteId, athleteList, startLoraPoller]);

  // ── Canonical set validation ───────────────────────────────────────────────
  const startCanonicalPoller = useCallback((jobId: string, baseProfile: AthleteProfile, athleteName: string) => {
    if (canonicalPollerRef.current) clearInterval(canonicalPollerRef.current);
    canonicalPollerRef.current = setInterval(async () => {
      try {
        const sess = (await supabase.auth.getSession()).data.session;
        const res = await fetch(`/canonical/status?athleteId=${baseProfile.athleteId}`, {
          headers: { "Authorization": `Bearer ${sess?.access_token ?? ""}` },
        });
        const s = await res.json() as { ok: boolean; status: string; score?: number; variance?: number; frameIds?: string[]; identityCardUrls?: string[]; houseStyleVersion?: string; failureReason?: string };
        if (s.status === "ready" && s.frameIds) {
          clearInterval(canonicalPollerRef.current!);
          setCanonicalValidating(false);
          const current = getAthleteProfile(baseProfile.athleteId) ?? baseProfile;
          const patch = {
            canonicalSetStatus: "ready" as const,
            canonicalReferenceFrameIds: s.frameIds,
            canonicalSetScore: s.score,
            canonicalSetVariance: s.variance,
            canonicalSetValidatedAt: new Date().toISOString(),
            canonicalSetHouseStyleVersion: s.houseStyleVersion,
            canonicalSetIdentityCardUrls: s.identityCardUrls ?? [],
            canonicalJobId: jobId,
          };
          const done = { ...current, ...patch };
          setProfile(done);
          saveCanonicalSet(baseProfile.athleteId, patch);
          toast({ type: "success", title: "Canonical set locked", body: `${athleteName}'s reference frames validated — score ${Math.round((s.score ?? 0) * 100)}%.` });
        } else if (s.status === "failed") {
          clearInterval(canonicalPollerRef.current!);
          setCanonicalValidating(false);
          const current = getAthleteProfile(baseProfile.athleteId) ?? baseProfile;
          const fail = { ...current, canonicalSetStatus: "failed" as const, canonicalSetFailureReason: s.failureReason };
          setProfile(fail);
          saveAthleteProfile(fail);
          toast({ type: "error", title: "Validation failed", body: s.failureReason ?? "Check captures and retry." });
        }
      } catch { /* keep polling */ }
    }, 15_000);
  }, []);

  useEffect(() => {
    if (!profile?.canonicalJobId || profile.canonicalSetStatus !== "validating") return;
    if (canonicalPollerRef.current) return;
    const athleteName = athleteList.find(a => a.id === profile.athleteId)?.name ?? "Athlete";
    setCanonicalValidating(true);
    startCanonicalPoller(profile.canonicalJobId, profile, athleteName);
    return () => {
      if (canonicalPollerRef.current) { clearInterval(canonicalPollerRef.current); canonicalPollerRef.current = null; }
    };
  }, [profile?.canonicalJobId, profile?.canonicalSetStatus, profile?.athleteId, athleteList, startCanonicalPoller]);

  const startCanonicalValidation = async () => {
    if (!athlete || !profile) return;
    const frames = CAPTURE_FRAMES.filter(f => getAngleDataUrl(f.key, athlete));
    if (frames.length < 3) {
      toast({ type: "error", title: "Not enough captures", body: `At least 3 captures required — have ${frames.length}.` });
      return;
    }
    setCanonicalValidating(true);
    try {
      const sess = (await supabase.auth.getSession()).data.session;
      const res = await fetch("/canonical/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sess?.access_token ?? ""}`,
        },
        body: JSON.stringify({ athleteId: athlete.id }),
      });
      const data = await res.json() as { ok: boolean; jobId?: string; error?: string };
      if (!data.ok || !data.jobId) throw new Error(data.error ?? "Failed to start validation");
      const patched = { ...profile, canonicalSetStatus: "validating" as const, canonicalJobId: data.jobId };
      setProfile(patched);
      saveAthleteProfile(patched);
      startCanonicalPoller(data.jobId, patched, athlete.name);
    } catch (e) {
      setCanonicalValidating(false);
      toast({ type: "error", title: "Validation error", body: e instanceof Error ? e.message : "Try again." });
    }
  };

  // ── LoRA training ──────────────────────────────────────────────────────────
  // v3 face/passport keys for LoRA training (body shots excluded — dilute portrait training)
  const LORA_FRAME_KEYS = new Set(["face-close", "front-passport", "left-passport", "right-passport", "back-passport"]);
  // Legacy face keys — kept for athletes captured before protocol migration
  const FACE_TRAINING_KEYS = new Set(["face-front", "face-close", "face-left", "face-right"]);

  const startLoraTraining = async () => {
    if (!athlete || !profile) return;

    // Use new protocol frames first; fall back to legacy face keys if not yet migrated
    // Priority: frame-1 (front/soft) > frame-5 (close-up) > frame-2 (front/key) > frame-3 > frame-4
    const PRIORITY_ORDER = ["frame-1", "frame-5", "frame-2", "frame-3", "frame-4", "face-front", "face-close", "face-left", "face-right"];
    // Include angles that have any image source, not just dataUrl
    const hasImage = (a: CaptureAngle) => !!(a.dataUrl || a.falCdnUrl || a.storageUrl);
    const allFaceCaptures = profile.captureAngles.filter(a => hasImage(a) && (LORA_FRAME_KEYS.has(a.key) || FACE_TRAINING_KEYS.has(a.key)));
    allFaceCaptures.sort((a, b) => PRIORITY_ORDER.indexOf(a.key) - PRIORITY_ORDER.indexOf(b.key));
    const faceCaptures = allFaceCaptures.slice(0, 2); // best 2 only — more dilutes without improving identity lock
    if (faceCaptures.length < 2) {
      toast({ type: "error", title: "Not enough face captures", body: "Add at least 2 face photos (Front, Close, Left, or Right) before training." });
      return;
    }

    // 100 steps per image — enough for portrait LoRA without overfitting
    const steps = Math.min(Math.max(faceCaptures.length * 100, 200), 400);

    // Unique trigger token: no spaces, no common words — avoids token collision
    const triggerWord = athlete.name.toLowerCase().replace(/\s+/g, "_") + "_person";

    setLoraTraining(true);
    try {
      // Build base64 payloads — prefer dataUrl (already decoded); fetch from CDN/storage if stripped
      const images: { base64: string; filename: string }[] = [];
      for (const [i, a] of faceCaptures.entries()) {
        if (a.dataUrl) {
          images.push({ base64: a.dataUrl.split(",")[1], filename: `face_${i + 1}_${a.key}.jpg` });
        } else {
          const srcUrl = a.falCdnUrl ?? a.storageUrl;
          if (!srcUrl) continue;
          try {
            const blob = await fetch(srcUrl).then(r => r.blob());
            const b64 = await new Promise<string>(res => {
              const reader = new FileReader();
              reader.onloadend = () => res((reader.result as string).split(",")[1]);
              reader.readAsDataURL(blob);
            });
            images.push({ base64: b64, filename: `face_${i + 1}_${a.key}.jpg` });
          } catch { /* skip this angle if fetch fails */ }
        }
      }
      if (images.length < 2) {
        toast({ type: "error", title: "Not enough face captures", body: "Could not load images for training. Re-upload captures and try again." });
        setLoraTraining(false);
        return;
      }

      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch("/api/fal/train", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ images, triggerWord, steps }),
      });

      const data = await res.json() as { ok: boolean; requestId?: string; error?: string };
      if (!data.ok || !data.requestId) throw new Error(data.error ?? "Training failed to start");

      const updated = { ...profile, loraStatus: "training" as const, loraJobId: data.requestId, loraTriggerPhrase: triggerWord };
      setProfile(updated);
      saveAthleteProfile(updated);

      const estMin = Math.round(steps / 100);
      toast({ type: "success", title: "Training started", body: `Using ${faceCaptures.length} face captures, ${steps} steps (~${estMin} min).` });

      startLoraPoller(data.requestId, updated, athlete.name);
    } catch (e: any) {
      setLoraTraining(false);
      toast({ type: "error", title: "Training error", body: e.message });
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getAngleDataUrl = (angleKey: AngleKey, ath: Athlete): string | undefined => {
    // Only use profile data if it belongs to this athlete (guard stale profile from prev selection)
    if (profile?.athleteId === ath.id) {
      const stored = profile.captureAngles.find(a => a.key === angleKey);
      if (stored) return stored.falCdnUrl ?? stored.storageUrl ?? stored.dataUrl;
    }
    // Fall back to athlete.image for front slots only if it's not a stale blob URL
    if ((angleKey === "face-front" || angleKey === "body-front") && ath.image && !ath.image.startsWith("blob:")) {
      return ath.image;
    }
    return undefined;
  };

  const athlete = athleteList.find((a) => a.id === selectedAthlete);

  // These must be declared before any useEffect that references them in deps
  const capturedFrameCount = CAPTURE_FRAMES.filter(f => athlete ? getAngleDataUrl(f.key, athlete) : false).length;
  const capturedFaceCount = FACE_ANGLES.filter(a => athlete ? getAngleDataUrl(a.key, athlete) : false).length;
  const capturedBodyCount = BODY_ANGLES.filter(a => athlete ? getAngleDataUrl(a.key, athlete) : false).length;

  useEffect(() => {
    setEditingAttrs(false);
    setConfirmDelete(false);
  }, [selectedAthlete]);

  // ── Auto-trigger canonical validation when ≥3 captures ────────────────────
  useEffect(() => {
    if (!athlete || !profile) return;
    if (capturedFrameCount < 3) return;
    const cs = profile.canonicalSetStatus;
    if (cs === "ready" || cs === "validating" || canonicalValidating) return;
    const timer = setTimeout(() => startCanonicalValidation(), 1200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturedFrameCount, athlete?.id, profile?.canonicalSetStatus]);

  // ── AngleSlot sub-component ────────────────────────────────────────────────
  const AngleSlot = ({ angleKey, label, aspectRatio }: { angleKey: AngleKey; label: string; aspectRatio: string }) => {
    const img = athlete ? getAngleDataUrl(angleKey, athlete) : undefined;
    const angle = profile?.captureAngles.find(a => a.key === angleKey);
    const isUploading = uploadingAngles.has(angleKey);
    const storageStatus = !angle ? null
      : angle.falCdnUrl ? "cdn"
      : angle.storagePath ? "stored"
      : null;
    return (
      <button
        onClick={() => !isUploading && openAnglePicker(angleKey)}
        disabled={isUploading}
        className="group relative overflow-hidden rounded-md border border-border hover:border-accent/40 transition-colors disabled:cursor-wait"
        style={{ aspectRatio }}
      >
        {isUploading ? (
          <div className="w-full h-full bg-card flex flex-col items-center justify-center text-muted-foreground gap-1.5">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-[10px]">Uploading…</span>
          </div>
        ) : img ? (
          <>
            <img src={img} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="size-4 text-white" strokeWidth={1.75} />
            </div>
          </>
        ) : (
          <div className="w-full h-full bg-card flex flex-col items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
            {getAngleSilhouette(angleKey)}
          </div>
        )}
        <span className="absolute bottom-1 left-1.5 text-[10px] text-white/80 leading-none drop-shadow">{label}</span>
        {!isUploading && storageStatus && (
          <span
            title={storageStatus === "cdn" ? "CDN ready" : "Stored"}
            className={`absolute top-1 right-1 size-2 rounded-full border border-black/20 ${
              storageStatus === "cdn" ? "bg-emerald-400" : "bg-sky-400"
            }`}
          />
        )}
      </button>
    );
  };

  // ── CaptureTab ─────────────────────────────────────────────────────────────
  function CaptureTab() {
    if (!athlete) return null;
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Captures</h3>
            <span className="text-xs text-muted-foreground">{capturedFrameCount} / {CAPTURE_FRAMES.length}</span>
          </div>

          {/* Portrait section */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">Portrait</p>
            <div className="grid grid-cols-3 gap-2">
              <AngleSlot angleKey="face-close"     label="Face close" aspectRatio="3/4" />
              <AngleSlot angleKey="front-passport" label="Front"      aspectRatio="3/4" />
              <AngleSlot angleKey="left-passport"  label="Left"       aspectRatio="3/4" />
              <AngleSlot angleKey="right-passport" label="Right"      aspectRatio="3/4" />
              <AngleSlot angleKey="back-passport"  label="Back"       aspectRatio="3/4" />
            </div>
          </div>

          {/* Full body section */}
          <div className="space-y-2">
            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">Full body</p>
            <div className="grid grid-cols-3 gap-2">
              <AngleSlot angleKey="front-body" label="Front" aspectRatio="3/4" />
              <AngleSlot angleKey="left-body"  label="Left"  aspectRatio="3/4" />
              <AngleSlot angleKey="right-body" label="Right" aspectRatio="3/4" />
              <AngleSlot angleKey="back-body"  label="Back"  aspectRatio="3/4" />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tattoos & marks</h3>
            {!addingMark && (
              <button onClick={() => setAddingMark(true)}
                className="h-6 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1">
                <Plus className="size-3" strokeWidth={2} /> Add
              </button>
            )}
          </div>
          {addingMark && (
            <div className="bg-card border border-border rounded-md p-3 space-y-3">
              <div className="flex gap-3">
                {/* Tattoo photo upload */}
                <button
                  type="button"
                  onClick={() => tattooFileRef.current?.click()}
                  className="w-18 shrink-0 rounded-md border border-dashed border-border hover:border-accent/40 transition-colors bg-secondary flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground overflow-hidden"
                  style={{ width: 68, minHeight: 96 }}
                >
                  {newMark.imageDataUrl ? (
                    <img src={newMark.imageDataUrl} className="w-full h-full object-cover" alt="tattoo" />
                  ) : (
                    <>
                      <Upload className="size-3.5" strokeWidth={1.75} />
                      <span className="text-[10px]">Photo</span>
                    </>
                  )}
                </button>
                {/* Body map */}
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">Tap to pin location</p>
                    <div className="flex rounded overflow-hidden border border-border">
                      {(["front", "back"] as const).map(v => (
                        <button key={v} type="button"
                          onClick={() => setNewMark(m => ({ ...m, bodyView: v }))}
                          className={`text-[10px] px-2 py-0.5 transition-colors ${newMark.bodyView === v ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                          {v.charAt(0).toUpperCase() + v.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-24 border border-border rounded-md overflow-hidden bg-secondary/20 flex items-center justify-center p-2">
                    <TattooBodyMap
                      x={newMark.bodyX >= 0 ? newMark.bodyX : undefined}
                      y={newMark.bodyY >= 0 ? newMark.bodyY : undefined}
                      view={newMark.bodyView}
                      onPlace={(px, py) => {
                        const loc = bodyPosToLocation(px, py, newMark.bodyView);
                        setNewMark(m => ({ ...m, bodyX: px, bodyY: py, location: loc }));
                      }}
                    />
                  </div>
                </div>
              </div>
              <input type="text" placeholder="Description (e.g. Eagle tattoo on forearm)" value={newMark.description}
                onChange={e => setNewMark(m => ({ ...m, description: e.target.value }))}
                className="w-full h-8 px-2 bg-secondary border border-border rounded text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent" autoFocus />
              <input type="text" placeholder="Location" value={newMark.location}
                onChange={e => setNewMark(m => ({ ...m, location: e.target.value }))}
                className="w-full h-8 px-2 bg-secondary border border-border rounded text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent" />
              <div className="flex gap-2">
                <button onClick={handleAddMark}
                  className="flex-1 h-7 rounded bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors">Save</button>
                <button onClick={() => { setAddingMark(false); setNewMark(resetNewMark()); }}
                  className="h-7 px-2 rounded bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors">Cancel</button>
              </div>
            </div>
          )}
          {(profile?.tattoos ?? []).length === 0 && !addingMark ? (
            <p className="text-xs text-muted-foreground py-2">No marks recorded</p>
          ) : (
            <div className="space-y-1.5">
              {(profile?.tattoos ?? []).map(mark => (
                <div key={mark.id} className="flex items-start gap-2 py-2 px-3 bg-card border border-border rounded-md">
                  {mark.imageUrl ? (
                    <img src={mark.imageUrl} alt="tattoo" className="w-10 h-12 object-cover rounded shrink-0" />
                  ) : (mark.bodyX !== undefined && mark.bodyY !== undefined) ? (
                    <div className="w-10 h-12 shrink-0 p-1 opacity-60">
                      <TattooBodyMap
                        x={mark.bodyX} y={mark.bodyY}
                        view={mark.bodyView ?? "front"}
                        onPlace={() => {}}
                        interactive={false}
                      />
                    </div>
                  ) : null}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{mark.description}</p>
                    {mark.location && <p className="text-xs text-muted-foreground">{mark.location}</p>}
                  </div>
                  <button onClick={() => handleRemoveMark(mark.id)}
                    className="p-0.5 hover:bg-secondary rounded transition-colors shrink-0 mt-0.5">
                    <X className="size-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
                className="w-full h-8 px-2 bg-secondary border border-border rounded text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent" autoFocus />
              <div className="flex gap-2">
                <button onClick={handleAddConstraint}
                  className="flex-1 h-7 rounded bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors">Save</button>
                <button onClick={() => { setAddingConstraint(false); setNewConstraint(""); }}
                  className="h-7 px-2 rounded bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors">Cancel</button>
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

        {capturedFrameCount > 0 && athlete.captureDate && (
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <div className="flex justify-between px-3 py-2 text-sm">
              <span className="text-muted-foreground">Capture date</span>
              <span className="font-medium text-foreground">{athlete.captureDate}</span>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ── IdentityTab ─────────────────────────────────────────────────────────────
  function IdentityTab() {
    if (!athlete) return null;
    const readiness = calculateIdentityReadiness(profile);
    const readinessCfg = READINESS_CONFIG[readiness.status];
    return (
      <div className="space-y-5">

        {/* ── Identity Readiness Card ─────────────────────────────────────── */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Identity readiness</span>
              <ReadinessBadge status={readiness.status} score={readiness.score} />
            </div>
            {/* Score ring */}
            <div className="relative size-10 shrink-0">
              <svg viewBox="0 0 36 36" className="size-10 -rotate-90">
                <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-border" />
                <circle
                  cx="18" cy="18" r="14" fill="none" strokeWidth="3.5"
                  stroke={readinessCfg.color}
                  strokeDasharray={`${(readiness.score / 100) * 87.96} 87.96`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums">
                {readiness.score}
              </span>
            </div>
          </div>

          {/* Recommended action */}
          <div className="px-4 py-2.5 bg-card/50 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Next: </span>
            {readiness.recommendedNextAction}
          </div>

          {/* Missing requirements */}
          {readiness.missingRequirements.length > 0 && (
            <div className="px-4 py-2 border-t border-border/50 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Missing</p>
              {readiness.missingRequirements.map((req, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-red-400/80">
                  <span className="size-1.5 rounded-full bg-red-400/60 shrink-0" />
                  {req}
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {readiness.warnings.length > 0 && (
            <div className="px-4 py-2 border-t border-border/50 space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Warnings</p>
              {readiness.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-amber-400/80">
                  <span className="size-1.5 rounded-full bg-amber-400/60 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-foreground">Physical features</h4>
            {!editingAttrs && (
              <button onClick={() => openEditAttrs(athlete)}
                className="h-6 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1">
                <Pencil className="size-3" strokeWidth={1.75} /> Edit
              </button>
            )}
          </div>
          {editingAttrs ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {([
                  { label: "Name", key: "name" },
                  { label: "Sport", key: "sport" },
                  { label: "Event", key: "event" },
                  { label: "Age", key: "age", type: "number" },
                  { label: "Country", key: "country", placeholder: "USA" },
                ] as { label: string; key: keyof typeof attrForm; placeholder?: string; type?: string }[]).map(({ label, key, placeholder, type }) => (
                  <div key={key}>
                    <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                    <input type={type ?? "text"} placeholder={placeholder} value={attrForm[key]}
                      onChange={e => setAttrForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full h-8 px-2 bg-secondary border border-border rounded text-xs focus:outline-none focus:border-accent placeholder:text-muted-foreground/50" />
                  </div>
                ))}
                {/* Height picker */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Height</p>
                  <div className="relative">
                    <select value={attrForm.height} onChange={e => setAttrForm(f => ({ ...f, height: e.target.value }))}
                      className="w-full h-8 pl-2.5 pr-7 bg-secondary border border-border rounded text-xs focus:outline-none focus:border-accent appearance-none">
                      <option value="">—</option>
                      {HEIGHT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" strokeWidth={1.75} />
                  </div>
                </div>
                {/* Weight picker */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Weight</p>
                  <div className="relative">
                    <select value={attrForm.weight} onChange={e => setAttrForm(f => ({ ...f, weight: e.target.value }))}
                      className="w-full h-8 pl-2.5 pr-7 bg-secondary border border-border rounded text-xs focus:outline-none focus:border-accent appearance-none">
                      <option value="">—</option>
                      {WEIGHT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" strokeWidth={1.75} />
                  </div>
                </div>
              </div>
              {/* AI-inferred overrides */}
              <div>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-2">AI-inferred — override if needed</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { label: "Build",     key: "build",     placeholder: "e.g. Lean" },
                    { label: "Skin tone", key: "skinTone",  placeholder: "e.g. Fair" },
                    { label: "Hair",      key: "hair",      placeholder: "e.g. Short" },
                  ] as { label: string; key: keyof typeof attrForm; placeholder: string }[]).map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                      <input type="text" placeholder={placeholder} value={attrForm[key]}
                        onChange={e => setAttrForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full h-8 px-2 bg-secondary border border-border rounded text-xs focus:outline-none focus:border-accent placeholder:text-muted-foreground/40" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
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
              {![athlete.height, athlete.weight, athlete.build, athlete.skinTone, athlete.hair, athlete.age, athlete.country].some(Boolean) && (
                <p className="text-xs text-muted-foreground px-3 py-2">No physical attributes set</p>
              )}
            </div>
          )}
        </div>

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

        {(profile?.approvedLikeness ?? []).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Approved likeness</h4>
            <p className="text-xs text-muted-foreground/70">Mark outputs as likeness references from the campaign workspace.</p>
            <div className="grid grid-cols-2 gap-2">
              {(profile?.approvedLikeness ?? []).map((item, idx) => (
                <div key={idx} className="rounded-md overflow-hidden border border-border bg-card group relative">
                  <div className="aspect-[3/4] overflow-hidden relative">
                    <img src={item.imageUrl} alt="Approved likeness" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemoveLikeness(idx)}
                      title="Remove reference"
                      className="absolute top-1.5 right-1.5 size-5 rounded-full bg-black/60 hover:bg-red-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="size-2.5 text-white" strokeWidth={2.5} />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground p-2 truncate">{item.context || "Approved reference"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(profile?.rejectedLikeness ?? []).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Rejected likeness</h4>
            <p className="text-xs text-muted-foreground/70">Outputs marked as identity mismatches — used to guide future generation.</p>
            <div className="grid grid-cols-2 gap-2">
              {(profile?.rejectedLikeness as RejectedLikeness[] ?? []).map((item, idx) => (
                <div key={idx} className="rounded-md overflow-hidden border border-red-500/30 bg-red-500/5 group relative">
                  <div className="aspect-[3/4] overflow-hidden relative">
                    <img src={item.imageUrl} alt="Rejected likeness" className="w-full h-full object-cover opacity-70" />
                    <button
                      onClick={() => handleRemoveRejectedLikeness(idx)}
                      title="Remove"
                      className="absolute top-1.5 right-1.5 size-5 rounded-full bg-black/60 hover:bg-red-500/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="size-2.5 text-white" strokeWidth={2.5} />
                    </button>
                  </div>
                  <p className="text-[10px] text-red-400/80 p-2 truncate">{item.context || "Rejected reference"}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Likeness model ─────────────────────────────────────────────── */}
        {(() => {
          const ALL_LORA_KEYS = new Set(["face-close", "front-passport", "left-passport", "right-passport", "back-passport", "face-front", "face-left", "face-right"]);
          const faceCount = (profile?.captureAngles ?? []).filter(a => (a.dataUrl || a.falCdnUrl || a.storageUrl) && ALL_LORA_KEYS.has(a.key)).length;
          const ready = faceCount >= 2;
          const ls = profile?.loraStatus;
          return (
            <div className="border border-border rounded-lg p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="size-3.5 text-accent shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Likeness model</p>
                  {ls === "ready" && profile?.loraTrainedAt ? (
                    <p className="text-xs text-muted-foreground/60">Trained {new Date(profile.loraTrainedAt).toLocaleDateString()}</p>
                  ) : ls === "training" || loraTraining ? (
                    <p className="text-xs text-muted-foreground/60">Training in progress…</p>
                  ) : ready ? (
                    <p className="text-xs text-muted-foreground/60">Train a custom model based on talent photos</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60">Needs ≥2 face captures ({faceCount} so far)</p>
                  )}
                </div>
              </div>
              {ls === "ready" ? (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">Ready</span>
              ) : ls === "training" || loraTraining ? (
                <span className="size-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin shrink-0" />
              ) : (
                <span className="text-[10px] font-medium text-muted-foreground/50 border border-border px-2 py-0.5 rounded-full shrink-0">
                  Coming soon
                </span>
              )}
            </div>
          );
        })()}

        {/* ── Canonical reference set ────────────────────────────────────── */}
        {(() => {
          const captureReadyForValidation = capturedFrameCount >= 3;
          const cs = profile?.canonicalSetStatus;
          const score = profile?.canonicalSetScore;
          if (!cs && capturedFrameCount < 3) return null;
          return (
            <div className="border border-border rounded-lg p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FlaskConical className="size-3.5 text-accent shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Identity check</p>
                  {cs === "ready" && profile?.canonicalSetValidatedAt ? (
                    <p className="text-xs text-muted-foreground/60">
                      Verified {new Date(profile.canonicalSetValidatedAt).toLocaleDateString()}{score !== undefined ? ` · ${Math.round(score * 100)}% match` : ""}
                    </p>
                  ) : cs === "failed" ? (
                    <p className="text-xs text-red-400/70">{profile?.canonicalSetFailureReason ?? "Check failed"}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60">Checking identity consistency…</p>
                  )}
                </div>
              </div>
              {cs === "ready" ? (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                  Verified
                </span>
              ) : cs === "failed" ? (
                <button onClick={startCanonicalValidation}
                  className="h-7 px-2 rounded-md text-xs font-medium bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  Retry
                </button>
              ) : (
                <span className="size-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin shrink-0" />
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div className="h-full flex bg-background">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

          {/* ── Toolbar ── */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" strokeWidth={1.75} />
              <input
                type="text"
                placeholder="Search talent…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 bg-card border border-border rounded-md text-sm focus:outline-none focus:border-accent placeholder:text-muted-foreground"
              />
            </div>
            {/* Sport filter */}
            {uniqueSports.length > 0 && (
              <select value={activeSportFilter} onChange={e => setActiveSportFilter(e.target.value)}
                className="h-8 px-2 bg-card border border-border rounded-md text-xs focus:outline-none focus:border-accent text-muted-foreground">
                <option value="">All sports</option>
                {uniqueSports.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {/* Status filter */}
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2 bg-card border border-border rounded-md text-xs focus:outline-none focus:border-accent text-muted-foreground">
              <option value="all">All statuses</option>
              <option value="complete">Captured</option>
              <option value="review">In progress</option>
              <option value="pending">Not started</option>
            </select>
            {/* Sort */}
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="h-8 px-2 bg-card border border-border rounded-md text-xs focus:outline-none focus:border-accent text-muted-foreground">
              <option value="name">Name</option>
              <option value="sport">Sport</option>
              <option value="date-added">Date added</option>
            </select>
            <button onClick={() => setSortOrder(o => o === "asc" ? "desc" : "asc")}
              title={sortOrder === "asc" ? "Ascending" : "Descending"}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors shrink-0">
              {sortOrder === "asc" ? <ArrowUp className="size-3" strokeWidth={2} /> : <ArrowDown className="size-3" strokeWidth={2} />}
            </button>
            {/* View toggle — single button, shows icon for the OTHER mode */}
            <button
              onClick={() => setViewMode(v => v === "grid" ? "list" : "grid")}
              title={viewMode === "grid" ? "List view" : "Grid view"}
              className="h-8 w-8 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors shrink-0">
              {viewMode === "grid" ? <List className="size-3.5" strokeWidth={1.75} /> : <LayoutGrid className="size-3.5" strokeWidth={1.75} />}
            </button>
          </div>

          {/* ── Grid view ── */}
          {viewMode === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredAthletes.map((ath) => {
                const readiness = calculateIdentityReadiness(getAthleteProfile(ath.id));
                const cfg = READINESS_CONFIG[readiness.status];
                return (
                  <div key={ath.id} className="group rounded-lg overflow-hidden bg-card border border-border hover:border-accent/40 transition-colors">
                    <div className="aspect-square overflow-hidden relative">
                      <button onClick={() => setSelectedAthlete(ath.id)} className="block w-full h-full bg-secondary">
                        {ath.image && !ath.image.startsWith("blob:") && !ath.image.includes("placeholder") ? (
                          <img src={ath.image} alt={ath.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg viewBox="0 0 80 80" fill="currentColor" className="w-1/2 h-1/2 text-muted-foreground/25">
                              <circle cx="40" cy="28" r="18" />
                              <path d="M8 76 C8 56 22 44 40 44 C58 44 72 56 72 76" />
                            </svg>
                          </div>
                        )}
                      </button>
                      {/* Readiness strip — bottom edge of image */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-[3px] pointer-events-none"
                        style={{ backgroundColor: cfg.color, opacity: readiness.score > 0 ? 1 : 0 }}
                      >
                        <div className="h-full" style={{ width: `${readiness.score}%` }} />
                      </div>
                      <button
                        onClick={() => { setThumbnailTargetId(ath.id); thumbnailInputRef.current?.click(); }}
                        className="absolute bottom-2 right-2 size-7 rounded-md bg-black/60 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Change photo"
                      >
                        <Camera className="size-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                    <div className="p-3 border-t border-border space-y-2">
                      <button onClick={() => setSelectedAthlete(ath.id)} className="text-left w-full">
                        <p className="text-sm font-medium truncate">{ath.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {ath.sport && <p className="text-xs text-muted-foreground truncate">{ath.sport}</p>}
                          <ReadinessBadge status={readiness.status} score={readiness.score} />
                        </div>
                      </button>
                      <button
                        onClick={() => onGenerate?.(ath.id)}
                        className="w-full h-7 rounded-md bg-secondary hover:bg-secondary/60 text-muted-foreground hover:text-foreground text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border border-border"
                      >
                        <Sparkles className="size-3" strokeWidth={2} />
                        Quick generate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── List view ── */}
          {viewMode === "list" && (
            <div className="space-y-px rounded-lg overflow-hidden border border-border">
              {filteredAthletes.map((ath) => {
                const readiness = calculateIdentityReadiness(getAthleteProfile(ath.id));
                return (
                  <div key={ath.id} className="group flex items-center gap-3 px-4 py-3 bg-card hover:bg-secondary/30 transition-colors">
                    <button onClick={() => setSelectedAthlete(ath.id)} className="size-10 rounded-md overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
                      {ath.image && !ath.image.startsWith("blob:") && !ath.image.includes("placeholder") ? (
                        <img src={ath.image} alt={ath.name} className="w-full h-full object-cover" />
                      ) : (
                        <svg viewBox="0 0 80 80" fill="currentColor" className="w-5 h-5 text-muted-foreground/30">
                          <circle cx="40" cy="28" r="18" /><path d="M8 76 C8 56 22 44 40 44 C58 44 72 56 72 76" />
                        </svg>
                      )}
                    </button>
                    <button onClick={() => setSelectedAthlete(ath.id)} className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium truncate">{ath.name}</p>
                      {ath.sport && <p className="text-xs text-muted-foreground truncate">{ath.sport}</p>}
                    </button>
                    <ReadinessBadge status={readiness.status} score={readiness.score} className="shrink-0" />
                    <button
                      onClick={() => onGenerate?.(ath.id)}
                      className="h-7 px-2 rounded-md bg-secondary hover:bg-secondary/60 text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1 transition-colors border border-border shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <Sparkles className="size-3" strokeWidth={2} />
                      Generate
                    </button>
                  </div>
                );
              })}
              {filteredAthletes.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground bg-card">No talent match your filters.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {athlete && (
        <div className="w-[480px] border-l border-border bg-background flex flex-col flex-shrink-0">
          <div className="bg-background border-b border-border shrink-0 z-10">
            <div className="px-5 pt-5 pb-4 flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-3">
                <h2 className="text-lg font-semibold text-foreground tracking-tight">{athlete.name}</h2>
                {athlete.sport && <p className="text-sm text-muted-foreground mt-0.5">{athlete.sport}</p>}
                {profile && (() => {
                  const pct = getProfileCompleteness(profile, athlete);
                  const isComplete = pct >= 100;
                  return (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">
                          {isComplete ? "Profile complete" : "Complete your profile"}
                        </span>
                        <span className="text-xs font-medium tabular-nums" style={{ color: isComplete ? "var(--sds-green-300)" : "var(--muted-foreground)" }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isComplete ? "var(--sds-green-300)" : "var(--sds-green-500)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => openEditAttrs(athlete)}
                  className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5">
                  <Pencil className="size-3" strokeWidth={1.75} /> Edit
                </button>
                {confirmDelete ? (
                  <div className="flex items-center gap-1">
                    <button onClick={handleDeleteAthlete}
                      className="h-7 px-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs font-medium transition-colors">
                      Confirm
                    </button>
                    <button onClick={() => setConfirmDelete(false)}
                      className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)}
                    className="h-7 px-2 rounded-md text-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5">
                    <Trash2 className="size-3" strokeWidth={1.75} /> Delete
                  </button>
                )}
                <div className="w-px h-4 bg-border mx-0.5" />
                <button onClick={handleCloseAthlete} className="p-1.5 hover:bg-secondary rounded-md transition-colors">
                  <X className="size-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="px-5 flex gap-5">
              {(["capture", "identity", "brand", "history", "collab"] as const).map((tab) => (
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

          <div className="flex-1 overflow-y-auto p-5">

            {/* ── CAPTURE TAB ── */}
            {activeTab === "capture" && CaptureTab()}

            {/* ── IDENTITY TAB ── */}
            {activeTab === "identity" && IdentityTab()}

            {/* ── BRAND TAB ── */}
            {activeTab === "brand" && (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="size-10 rounded-full bg-secondary flex items-center justify-center">
                  <Sparkles className="size-4 text-muted-foreground" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium">Brand kit — coming soon</p>
                  <p className="text-xs text-muted-foreground mt-1">Upload uniform variants, brand colours, and kit guidelines.</p>
                </div>
              </div>
            )}

            {/* ── COLLAB TAB ── */}
            {activeTab === "collab" && selectedAthlete && (() => {
              const tasks = getCollabTasks(selectedAthlete.id);
              const consent = getUsageConsent(selectedAthlete.id);
              const profile = getAthleteProfile(selectedAthlete.id);
              const portalUrl = profile?.portalToken
                ? `${window.location.origin}/subject/${profile.portalToken}`
                : null;

              const handleSendInvite = async () => {
                const token = crypto.randomUUID().replace(/-/g, "");
                const { data: { session } } = await supabase.auth.getSession();
                const by = session?.user?.email ?? "admin";
                savePortalInvite(selectedAthlete.id, token, by);
                const url = `${window.location.origin}/subject/${token}`;
                await navigator.clipboard.writeText(url).catch(() => {});
                toast({ type: "success", title: "Portal link copied", body: "Paste it to send to the talent." });
              };

              const pendingTasks = tasks.filter(t => t.status === "pending");
              const doneTasks = tasks.filter(t => t.status === "complete");

              return (
                <div className="space-y-6">
                  {/* Portal invite */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Talent portal</p>
                    {portalUrl ? (
                      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                        <p className="text-xs text-muted-foreground">Invite link (active)</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-secondary rounded px-2 py-1.5 truncate text-foreground">{portalUrl}</code>
                          <button
                            onClick={() => { navigator.clipboard.writeText(portalUrl); toast({ type: "info", title: "Copied" }); }}
                            className="shrink-0 h-7 px-2 text-xs rounded-md border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          >Copy</button>
                        </div>
                        {profile?.portalInvitedAt && (
                          <p className="text-[11px] text-muted-foreground/70">
                            Sent {new Date(profile.portalInvitedAt).toLocaleDateString()}{profile.portalInvitedBy ? ` by ${profile.portalInvitedBy}` : ""}
                          </p>
                        )}
                        <button
                          onClick={() => {
                            revokePortalToken(selectedAthlete.id);
                            toast({ type: "info", title: "Portal link revoked", body: "The talent can no longer access this link." });
                          }}
                          className="w-full h-7 text-xs rounded-md text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          Revoke link
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleSendInvite}
                        className="w-full h-9 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-accent transition-colors"
                      >
                        Generate & copy portal link
                      </button>
                    )}
                  </div>

                  {/* Consent status */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Usage consent</p>
                    {consent?.consentGiven ? (
                      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          <p className="text-xs font-medium text-emerald-400">Consent given</p>
                          {consent.consentAt && (
                            <span className="text-[11px] text-muted-foreground ml-auto">
                              {new Date(consent.consentAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {consent.scopes.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {consent.scopes.map(s => (
                              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                                {USAGE_SCOPE_LABELS[s as UsageScope]}
                              </span>
                            ))}
                          </div>
                        )}
                        {consent.note && (
                          <p className="text-xs text-muted-foreground italic">"{consent.note}"</p>
                        )}
                        {consent.expiresAt && (
                          <p className="text-[11px] text-amber-400">Expires {new Date(consent.expiresAt).toLocaleDateString()}</p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-amber-500/25 bg-amber-500/8 p-3 flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-amber-400" />
                        <p className="text-xs text-amber-400">Consent not yet given</p>
                      </div>
                    )}
                  </div>

                  {/* Task list */}
                  {tasks.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        Collaboration tasks
                        <span className="text-[10px] normal-case">{doneTasks.length}/{tasks.length} done</span>
                      </p>
                      <div className="space-y-1.5">
                        {tasks.map(task => (
                          <div key={task.id} className={`rounded-lg border p-3 flex items-start gap-3 ${task.status === "complete" ? "border-emerald-500/20 bg-emerald-500/5 opacity-70" : "border-border bg-card"}`}>
                            <span className={`size-4 rounded-full shrink-0 mt-0.5 flex items-center justify-center ${task.status === "complete" ? "bg-emerald-500" : "border-2 border-border"}`}>
                              {task.status === "complete" && <Check className="size-2.5 text-white" strokeWidth={3} />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs font-medium ${task.status === "complete" ? "line-through text-muted-foreground" : "text-foreground"}`}>{task.title}</p>
                              {task.description && <p className="text-[11px] text-muted-foreground mt-0.5">{task.description}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Approval summary */}
                  {(() => {
                    const outputs = getCampaignOutputs().filter(o => o.athleteId === selectedAthlete.id);
                    const withApproval = outputs.filter(o => o.subjectApprovalStatus);
                    if (withApproval.length === 0) return null;
                    const approved = withApproval.filter(o => o.subjectApprovalStatus === "approved").length;
                    const rejected = withApproval.filter(o => o.subjectApprovalStatus === "rejected").length;
                    const pending = withApproval.filter(o => o.subjectApprovalStatus === "pending").length;
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Likeness approval summary</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Approved", count: approved, color: "text-emerald-400" },
                            { label: "Pending", count: pending, color: "text-amber-400" },
                            { label: "Rejected", count: rejected, color: "text-red-400" },
                          ].map(s => (
                            <div key={s.label} className="rounded-lg border border-border bg-card px-3 py-2.5 text-center">
                              <p className={`text-lg font-semibold tabular-nums ${s.color}`}>{s.count}</p>
                              <p className="text-[10px] text-muted-foreground">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* ── HISTORY TAB ── */}
            {activeTab === "history" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-semibold text-foreground">Generated assets</h4>
                  <span className="text-xs text-muted-foreground">{athleteHistory.length} total</span>
                </div>
                {athleteHistory.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="text-sm">No assets yet</p>
                    <p className="text-xs mt-1">Generate from a campaign to see results here</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {athleteHistory.map((item) => (
                      <div key={item.id} className="aspect-[3/4] bg-black rounded-md overflow-hidden relative group cursor-pointer">
                        <img src={item.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            item.status === "approved" ? "bg-emerald-500/80 text-white"
                            : item.status === "rejected" ? "bg-red-500/80 text-white"
                            : "bg-black/60 text-white/80"
                          }`}>{item.status}</span>
                          <a href={item.url} download target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="p-1 bg-white/20 hover:bg-white/40 rounded transition-colors">
                            <Download className="size-3 text-white" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Persistent save footer ── */}
          {editingAttrs && (
            <div className="shrink-0 border-t border-border bg-background px-5 py-3 flex gap-2">
              <button onClick={saveAttrs}
                className="flex-1 h-9 rounded-md bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors flex items-center justify-center gap-1.5">
                <Check className="size-3.5" strokeWidth={2.5} /> Save changes
              </button>
              <button onClick={() => setEditingAttrs(false)}
                className="h-9 px-4 rounded-md bg-secondary text-muted-foreground hover:text-foreground text-sm transition-colors">
                Cancel
              </button>
            </div>
          )}
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
      {/* Hidden tattoo photo input */}
      <input ref={tattooFileRef} type="file" accept="image/*" className="hidden" onChange={handleTattooImageUpload} />

      {/* ── Add Athlete Modal ── */}
      <input ref={thumbnailInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailChange} />

      {showAddModal && (
        <AddAthleteModal
          onClose={() => setShowAddModal(false)}
          onAdded={athlete => {
            setAthleteList(getAthletes());
            setSelectedAthlete(athlete.id);
          }}
        />
      )}
    </div>
  );
}
