import { useEffect, useReducer } from "react";
import { Athlete, AthleteProfile, RejectedLikeness, UsageConsent, UsageScope, CollabTask } from "../../data/athletes";
export type { RejectedLikeness, UsageConsent, UsageScope, CollabTask };
import { Project, CampaignStatus, ExportLogEntry } from "../../data/projects";
export type { CampaignStatus, ExportLogEntry };
import type { WardrobeKit } from "../../data/wardrobe";
export type { WardrobeKit };
import type { Moodboard } from "../../data/moodboard";
export type { Moodboard };
import { supabase } from "./supabase";
import { getIdentityMatchTier } from "./identityMatchTier";
export type { IdentityMatchTier, IdentityMatchTierKey } from "./identityMatchTier";
export { getIdentityMatchTier } from "./identityMatchTier";

export const DEMO_EMAIL = "daniel@pluribus.ai";

// ── Store pub/sub ─────────────────────────────────────────────────────────────
// Allows components to reactively re-render when the store is hydrated or updated.
// Primary use case: `hydrateStore` completion after auth, token-refresh re-hydration.

const _storeListeners = new Set<() => void>();

function _notifyListeners() {
  _storeListeners.forEach(fn => fn());
}

/** Subscribe to store updates. Returns an unsubscribe function. */
export function subscribeToStore(fn: () => void): () => void {
  _storeListeners.add(fn);
  return () => _storeListeners.delete(fn);
}

/**
 * React hook: forces a re-render whenever the store is updated (hydration or mutation).
 * Use in any component that reads from the store via getter functions.
 */
export function useStoreSync(): void {
  const [, dispatch] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeToStore(dispatch), []);
}

let _userId = "";
let _realtimeChannel: ReturnType<typeof supabase.channel> | null = null;


// ── In-memory cache ──────────────────────────────────────────────────────────

export interface QueueItem {
  id: string;
  name: string;
  athleteName: string;
  type: "image" | "video";
  model: string;
  status: "rendering" | "queued" | "done" | "failed";
  progress: number;
  credits: number;
  resultUrl?: string;
  thumb?: string;
  startedAt: string;
  duration?: string;
  error?: string;
}

export type OutputStatus = "pending" | "approved" | "needs_revision" | "rejected" | "flagged";

export type RejectionReason =
  | "FACE_DRIFT"
  | "AGE_DRIFT"
  | "SKIN_TONE"
  | "TATTOO_MISMATCH"
  | "WARDROBE"
  | "CONTEXT"
  | "QUALITY";

export const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  FACE_DRIFT:      "Face drift — identity not preserved",
  AGE_DRIFT:       "Age drift — looks wrong age",
  SKIN_TONE:       "Skin tone mismatch",
  TATTOO_MISMATCH: "Tattoo/marking mismatch",
  WARDROBE:        "Wardrobe/styling off",
  CONTEXT:         "Wrong context or setting",
  QUALITY:         "Technical quality failure",
};

export interface GenerationJob {
  id: string;
  subjectId?: string;
  subjectName?: string;
  recipeId?: string;
  recipeName?: string;
  prompt: string;
  aspectRatio: string;
  modelId: string;
  requestId: string;
  status: "queued" | "running" | "complete" | "failed";
  progress: number;
  resultUrls: string[];
  error?: string;
  seed?: number;
  startedAt: string;
  completedAt?: string;
  runId?: string;
  campaignId?: string;
  mode: "image" | "video";
  /** Set when the job was created as part of a Campaign Pack batch */
  packId?: string;
  packName?: string;
  /** Epoch ms: skip polling this job until after this timestamp (429 backoff) */
  rateRetryAfter?: number;
}

export interface OutputComment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface ReviewHistoryEntry {
  status: OutputStatus;
  by: string;
  at: string;
}

export const USAGE_SCOPE_LABELS: Record<UsageScope, string> = {
  social_media:     "Social media",
  paid_advertising: "Paid advertising",
  out_of_home:      "Out-of-home / OOH",
  press_editorial:  "Press & editorial",
  internal_only:    "Internal use only",
  unlimited:        "Unlimited use",
};

export interface CampaignOutput {
  id: string;
  campaignId: string;
  athleteId?: string;
  runId?: string;
  /** Display URL — Supabase Storage signed URL when available, CDN URL as fallback. */
  url: string;
  /** Permanent path inside pluribus-assets-private. Set after successful mirror. */
  storagePath?: string;
  /** Original fal.ai CDN URL (temporary — kept for debugging/re-mirror). */
  originalFalUrl?: string;
  status: OutputStatus;
  resemblanceScore?: number;
  identityScoringStatus?: "pending" | "scoring" | "complete" | "failed";
  identityScoringError?: string;
  identityScoringAttempts?: number;
  /** Subject / talent likeness approval */
  subjectApprovalStatus?: "pending" | "approved" | "rejected";
  subjectApprovalBy?: string;
  subjectApprovalAt?: string;
  subjectRejectionNote?: string;
  createdAt: string;
  comments?: OutputComment[];
  reviewedBy?: string;
  reviewedAt?: string;
  tags?: string[];
  reviewHistory?: ReviewHistoryEntry[];
  rejectionReason?: RejectionReason;
}

export interface Run {
  id: string;
  campaignId: string;
  athleteId?: string;
  athleteName?: string;
  recipeId?: string;
  recipeName?: string;
  recipeSnapshot?: Record<string, unknown>;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  model: string;
  aspectRatio: string;
  status: "running" | "complete" | "failed";
  startedAt: string;
  completedAt?: string;
  assetIds: string[];
  errorMessage?: string;
}

interface StoreCache {
  athletes: Athlete[];
  projects: Project[];
  archivedProjects: Project[];
  profiles: Map<string, AthleteProfile>;

  wardrobeKits: WardrobeKit[];
  moodboards: Moodboard[];
  credits: number;
  queue: QueueItem[];
  runsMap: Map<string, Run[]>;
  outputs: CampaignOutput[];
  role: "admin" | "editor" | "viewer";
  jobs: GenerationJob[];
}

let _cache: StoreCache | null = null;

// ── Supabase write-through ───────────────────────────────────────────────────

// Tables where a silent write failure would lose data the talent cares about.
const CRITICAL_TABLES = new Set(["subject_profiles", "campaign_outputs"]);

// Optional handler registered by App.tsx — called after all retries exhausted on a critical table.
let _onWriteError: ((table: string) => void) | null = null;
export function setWriteErrorHandler(fn: (table: string) => void): void {
  _onWriteError = fn;
}

async function _upsert(table: string, data: object, onConflict: string) {
  if (!_userId) return;
  const DELAYS = [1000, 2000, 4000];
  for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
    const { error } = await supabase.from(table).upsert(data, { onConflict });
    if (!error) return;
    if (attempt === 0) {
      console.error(`[store] ${table} upsert 400:`, error.code, error.message, error.details, error.hint);
    }
    if (attempt < DELAYS.length) {
      await new Promise(r => setTimeout(r, DELAYS[attempt]));
    }
  }
  // All retries exhausted — notify if this is a table talent-facing data lives in
  if (CRITICAL_TABLES.has(table)) {
    _onWriteError?.(table);
  }
}

function _delete(table: string, match: Record<string, string>) {
  if (!_userId) return;
  let q = supabase.from(table).delete().eq("user_id", _userId);
  for (const [col, val] of Object.entries(match)) q = q.eq(col, val);
  q.then(({ error }) => {
    if (error) console.warn(`[store] ${table} delete failed:`, error.message);
  });
}

function _dbSubject(a: Athlete) {
  _upsert("subjects", {
    id:           a.id,
    user_id:      _userId,
    name:         a.name,
    sport:        a.sport ?? null,
    event:        a.event ?? null,
    status:       a.status,
    image_url:    a.image ?? null,
    capture_date: a.captureDate ?? null,
    height:       a.height ?? null,
    weight:       a.weight ?? null,
    build:        a.build ?? null,
    skin_tone:    a.skinTone ?? null,
    hair:         a.hair ?? null,
    age:          a.age ?? null,
    country:      a.country ?? null,
  }, "user_id,id");
}
function _dbCampaign(p: Project) {
  _upsert("campaigns", { id: p.id, user_id: _userId, type: p.type, data: p, updated_at: new Date().toISOString() }, "user_id,id");
}
function _dbProfile(profile: AthleteProfile) {
  _upsert("subject_profiles", {
    subject_id:        profile.athleteId,
    user_id:           _userId,
    notes:             profile.notes ?? "",
    version:           profile.version,
    capture_angles:    profile.captureAngles,
    tattoos:           profile.tattoos,
    do_not_change:     profile.doNotChange,
    approved_likeness: profile.approvedLikeness,
    rejected_likeness: profile.rejectedLikeness ?? [],
    updated_at:        profile.updatedAt,
  }, "user_id,subject_id");
}
function _dbWardrobeKit(k: WardrobeKit) {
  _upsert("wardrobe_kits", { id: k.id, user_id: _userId, data: k, updated_at: k.updatedAt }, "user_id,id");
}
function _dbMoodboard(m: Moodboard) {
  _upsert("moodboards", { id: m.id, user_id: _userId, data: m, updated_at: m.updatedAt }, "user_id,id");
}
function _dbOutput(o: CampaignOutput) {
  _upsert("campaign_outputs", {
    id:               o.id,
    campaign_id:      o.campaignId,
    user_id:          _userId,
    athlete_id:       o.athleteId ?? null,
    run_id:           o.runId ?? null,
    url:              o.url,
    storage_path:     o.storagePath ?? null,
    original_fal_url: o.originalFalUrl ?? null,
    status:           o.status,
    resemblance_score: o.resemblanceScore ?? null,
    reviewed_by:      o.reviewedBy ?? null,
    reviewed_at:      o.reviewedAt ?? null,
    tags:             o.tags ?? [],
    review_history:   o.reviewHistory ?? [],
    comments:         o.comments ?? [],
    created_at:       o.createdAt,
  }, "user_id,id");
}
function _dbRun(r: Run) {
  _upsert("campaign_runs", {
    id:               r.id,
    campaign_id:      r.campaignId,
    user_id:          _userId,
    athlete_id:       r.athleteId ?? null,
    athlete_name:     r.athleteName ?? null,
    recipe_id:        r.recipeId ?? null,
    recipe_name:      r.recipeName ?? null,
    prompt:           r.prompt,
    negative_prompt:  r.negativePrompt ?? null,
    model:            r.model,
    aspect_ratio:     r.aspectRatio,
    seed:             r.seed ?? null,
    status:           r.status,
    asset_ids:        r.assetIds,
    started_at:       r.startedAt,
    completed_at:     r.completedAt ?? null,
    error_message:    r.errorMessage ?? null,
  }, "user_id,id");
}

// ── init ─────────────────────────────────────────────────────────────────────

/** Reset all in-memory store state on signout to prevent data leaking between users. */
export function clearStore() {
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel).catch(() => {});
    _realtimeChannel = null;
  }
  _userId = "";
  _cache  = null;
}

/** Call immediately after the user session is known, before any store reads drive UI. */
export function initStore(userId: string, _userEmail: string) {
  // Idempotent for the same user — prevents token-refresh events from wiping the
  // already-hydrated cache when onAuthStateChange fires without a real user change.
  if (_userId === userId && _cache !== null) return;

  _userId = userId;
  _cache = {
    athletes:         [],
    projects:         [],
    archivedProjects: [],
    profiles:         new Map(),
    wardrobeKits:     [],
    moodboards:       [],
    credits:          500,
    role:             "editor",
    queue:            [],
    runsMap:          new Map(),
    outputs:          [],
    jobs:             [],
  };

  // ── Supabase Realtime — approval state sync ──────────────────────────────
  // Remove any previous channel before creating a new one (prevents callback stacking
  // on token refresh when initStore is called again for the same or a new user).
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel).catch(() => {});
  }
  _realtimeChannel = supabase
    .channel(`campaign_outputs_approval_${userId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "campaign_outputs",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        if (!_cache) return;
        const row = payload.new as Record<string, unknown>;
        const id = row.id as string;
        const idx = _cache.outputs.findIndex(o => o.id === id);
        if (idx === -1) return;
        _cache.outputs[idx] = {
          ..._cache.outputs[idx],
          status: (row.status as CampaignOutput["status"]) ?? _cache.outputs[idx].status,
          subjectApprovalStatus: (row.subject_approval_status as CampaignOutput["subjectApprovalStatus"]) ?? _cache.outputs[idx].subjectApprovalStatus,
          subjectApprovalBy:     (row.subject_approval_by as string | undefined) ?? _cache.outputs[idx].subjectApprovalBy,
          subjectApprovalAt:     (row.subject_approval_at as string | undefined) ?? _cache.outputs[idx].subjectApprovalAt,
          subjectRejectionNote:  (row.subject_rejection_note as string | undefined) ?? _cache.outputs[idx].subjectRejectionNote,
          reviewedBy:            (row.reviewed_by as string | undefined) ?? _cache.outputs[idx].reviewedBy,
          reviewedAt:            (row.reviewed_at as string | undefined) ?? _cache.outputs[idx].reviewedAt,
        };
        _notifyListeners();
      }
    )
    .subscribe();
}

/** Async: pull all product data from Supabase into the in-memory cache. */
export async function hydrateStore(userId: string): Promise<void> {
  if (!_cache) return;

  const [subjectsRes, campaignsRes, profilesRes, outputsRes, runsRes, wardrobeRes, moodboardsRes, roleRes] =
    await Promise.allSettled([
      supabase.from("subjects").select("id,name,sport,event,status,image_url,capture_date,height,weight,build,skin_tone,hair,age,country").eq("user_id", userId),
      supabase.from("campaigns").select("data, type").eq("user_id", userId),
      supabase.from("subject_profiles").select("subject_id,notes,version,capture_angles,tattoos,do_not_change,approved_likeness,rejected_likeness,updated_at").eq("user_id", userId),
      supabase.from("campaign_outputs").select("id,campaign_id,athlete_id,run_id,url,storage_path,original_fal_url,status,resemblance_score,reviewed_by,reviewed_at,tags,review_history,comments,created_at").eq("user_id", userId),
      supabase.from("campaign_runs").select("id,campaign_id,athlete_id,athlete_name,recipe_id,recipe_name,prompt,negative_prompt,model,aspect_ratio,seed,status,asset_ids,started_at,completed_at,error_message").eq("user_id", userId),
      supabase.from("wardrobe_kits").select("data").eq("user_id", userId),
      supabase.from("moodboards").select("data").eq("user_id", userId),
      supabase.from("users").select("role,credits").eq("id", userId).single(),
    ]);

  // subjects
  if (subjectsRes.status === "fulfilled" && !subjectsRes.value.error) {
    _cache.athletes = (subjectsRes.value.data ?? []).map(r => ({
      id:          r.id,
      name:        r.name,
      sport:       r.sport ?? "",
      event:       r.event ?? "",
      status:      r.status as Athlete["status"],
      image:       r.image_url ?? "/athletes/placeholder.jpg",
      captureDate: r.capture_date ?? null,
      height:      r.height ?? undefined,
      weight:      r.weight ?? undefined,
      build:       r.build ?? undefined,
      skinTone:    r.skin_tone ?? undefined,
      hair:        r.hair ?? undefined,
      age:         r.age ?? undefined,
      country:     r.country ?? undefined,
    } as Athlete));
  }

  // campaigns
  if (campaignsRes.status === "fulfilled" && !campaignsRes.value.error) {
    const rows = campaignsRes.value.data ?? [];
    _cache.projects         = rows.filter(r => r.type !== "archived").map(r => r.data as Project);
    _cache.archivedProjects = rows.filter(r => r.type === "archived").map(r => r.data as Project);
  }

  // subject_profiles
  if (profilesRes.status === "fulfilled" && !profilesRes.value.error) {
    for (const r of (profilesRes.value.data ?? [])) {
      _cache.profiles.set(r.subject_id as string, {
        athleteId:        r.subject_id,
        version:          r.version ?? 1,
        updatedAt:        r.updated_at,
        captureAngles:    r.capture_angles ?? [],
        tattoos:          r.tattoos ?? [],
        doNotChange:      r.do_not_change ?? [],
        approvedLikeness: r.approved_likeness ?? [],
        rejectedLikeness: r.rejected_likeness ?? [],
        notes:            r.notes ?? "",
      });
    }
  }

  // campaign_outputs
  if (outputsRes.status === "fulfilled" && !outputsRes.value.error) {
    _cache.outputs = (outputsRes.value.data ?? []).map(r => ({
      id:               r.id,
      campaignId:       r.campaign_id,
      athleteId:        r.athlete_id ?? undefined,
      runId:            r.run_id ?? undefined,
      url:              r.url,
      storagePath:      r.storage_path ?? undefined,
      originalFalUrl:   r.original_fal_url ?? undefined,
      status:           r.status as CampaignOutput["status"],
      resemblanceScore: r.resemblance_score ?? undefined,
      reviewedBy:       r.reviewed_by ?? undefined,
      reviewedAt:       r.reviewed_at ?? undefined,
      tags:             r.tags ?? [],
      reviewHistory:    r.review_history ?? [],
      comments:         r.comments ?? [],
      createdAt:        r.created_at,
    } as CampaignOutput));
  }

  // wardrobe_kits
  if (wardrobeRes.status === "fulfilled" && !wardrobeRes.value.error) {
    const rows = wardrobeRes.value.data ?? [];
    if (rows.length > 0) _cache.wardrobeKits = rows.map(r => r.data as WardrobeKit);
  }

  // moodboards
  if (moodboardsRes.status === "fulfilled" && !moodboardsRes.value.error) {
    const rows = moodboardsRes.value.data ?? [];
    if (rows.length > 0) _cache.moodboards = rows.map(r => r.data as Moodboard);
  }

  // role + credits
  if (roleRes.status === "fulfilled" && roleRes.value.data) {
    const row = roleRes.value.data as { role?: string; credits?: number };
    if (row.role) _cache.role = row.role as "admin" | "editor" | "viewer";
    if (typeof row.credits === "number") _cache.credits = row.credits;
  } else {
    supabase.from("users").upsert(
      { id: userId, role: "editor" },
      { onConflict: "id", ignoreDuplicates: true }
    ).then(() => {});
  }

  // campaign_runs
  if (runsRes.status === "fulfilled" && !runsRes.value.error) {
    for (const r of (runsRes.value.data ?? [])) {
      const run: Run = {
        id:             r.id,
        campaignId:     r.campaign_id,
        athleteId:      r.athlete_id ?? undefined,
        athleteName:    r.athlete_name ?? undefined,
        recipeId:       r.recipe_id ?? undefined,
        recipeName:     r.recipe_name ?? undefined,
        prompt:         r.prompt,
        negativePrompt: r.negative_prompt ?? undefined,
        model:          r.model,
        aspectRatio:    r.aspect_ratio,
        seed:           r.seed ?? undefined,
        status:         r.status as Run["status"],
        assetIds:       r.asset_ids ?? [],
        startedAt:      r.started_at,
        completedAt:    r.completed_at ?? undefined,
        errorMessage:   r.error_message ?? undefined,
      };
      const list = _cache.runsMap.get(run.campaignId) ?? [];
      list.push(run);
      _cache.runsMap.set(run.campaignId, list);
    }
    _cache.runsMap.forEach((list, cid) => {
      _cache!.runsMap.set(cid, list.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    });
  }

  // Signal all subscribed components to re-read from the now-populated cache.
  _notifyListeners();
}


// ---------- athletes ----------

export function getAthletes(): Athlete[] {
  return _cache?.athletes ?? [];
}
export function saveAthletes(list: Athlete[]): void {
  if (_cache) _cache.athletes = list;
  list.forEach(_dbSubject);
}
export function addAthlete(athlete: Athlete): Athlete[] {
  const list = [...getAthletes(), athlete];
  if (_cache) _cache.athletes = list;
  _dbSubject(athlete);
  return list;
}

// ---------- projects ----------

export function getProjects(): Project[] {
  return _cache?.projects ?? [];
}
export function getArchivedProjects(): Project[] {
  return _cache?.archivedProjects ?? [];
}
export function saveProjects(projects: Project[]): void {
  if (_cache) _cache.projects = projects;
  projects.forEach(_dbCampaign);
}
export function addProject(project: Project): Project[] {
  const list = [...getProjects(), project];
  if (_cache) _cache.projects = list;
  _dbCampaign(project);
  return list;
}
export function updateProject(id: string, patch: Partial<Project>): void {
  const list = getProjects().map(p => p.id === id ? { ...p, ...patch } : p);
  if (_cache) _cache.projects = list;
  const updated = list.find(p => p.id === id);
  if (updated) _dbCampaign(updated);
}
export function appendExportLog(id: string, entry: ExportLogEntry): void {
  const list = getProjects().map(p =>
    p.id === id ? { ...p, exportLog: [entry, ...(p.exportLog ?? [])] } : p
  );
  if (_cache) _cache.projects = list;
  const updated = list.find(p => p.id === id);
  if (updated) _dbCampaign(updated);
}

// ---------- athlete profiles ----------

export function createEmptyProfile(athleteId: string): AthleteProfile {
  return {
    athleteId,
    version: 0,
    updatedAt: new Date().toISOString(),
    captureAngles: [],
    tattoos: [],
    doNotChange: [],
    approvedLikeness: [],
    notes: "",
  };
}

/**
 * Derives the full list of generation constraints from an athlete profile.
 * Combines explicit do-not-change rules with visible tattoo descriptions.
 * Returns [] if profile is null.
 */
/** Returns 0–100 completeness score for an identity profile. */
export function getProfileCompleteness(profile: AthleteProfile | null, athlete?: Athlete | null): number {
  // Athlete-level checks (30 pts)
  const hasPhoto   = !!(athlete?.image && !athlete.image.includes("placeholder"));
  const hasSport   = !!(athlete?.sport?.trim());
  const hasHeight  = !!(athlete?.height?.trim());
  const hasWeight  = !!(athlete?.weight?.trim());
  const hasPhysical = !!(athlete?.build?.trim() || athlete?.skinTone?.trim() || athlete?.hair?.trim());

  // Capture angle checks (50 pts — weighted by count out of 9)
  const angleCount = profile?.captureAngles.length ?? 0;
  const anglePct   = Math.min(angleCount / 9, 1); // 0–1

  // Profile data checks (20 pts)
  const hasLikeness    = (profile?.approvedLikeness.length ?? 0) > 0;
  const hasNotes       = !!(profile?.notes?.trim().length);
  const hasConstraints = (profile?.doNotChange.length ?? 0) > 0;

  // Notes and do-not-change are not scored — they're advanced fields that penalise
  // most subjects unnecessarily. Score is out of 100 without them.
  const score =
    (hasPhoto    ? 10 : 0) +
    (hasSport    ? 10 : 0) +
    (hasHeight   ?  5 : 0) +
    (hasWeight   ?  5 : 0) +
    (hasPhysical ?  5 : 0) +
    anglePct * 55 +
    (hasLikeness ? 10 : 0);

  return Math.min(Math.round(score), 100);
}

// Reference priority for Nano Banana IP-adapter conditioning.
// Face close-up anchors identity hardest; passport shots add angle coverage;
// Face-only captures for identity — body shots excluded to avoid diluting facial signal.
// Nano Banana Pro fidelity is highest with 2–4 well-chosen face references.
const NB_FACE_PRIORITY: import("../../data/athletes").AngleKey[] = [
  "face-close",
  "front-passport", "left-passport", "right-passport",
  // legacy keys
  "face-front", "face-left", "face-right",
  "frame-1", "frame-5", "frame-2", "frame-3",
];

/**
 * Returns face capture URLs ordered by identity-signal priority for Nano Banana Pro.
 * Body shots excluded — they dilute facial identity signal without improving consistency.
 * Priority per angle: falCdnUrl → fresh signed URL from storagePath → storageUrl → dataUrl.
 * generate.ts caps at 4 refs; beyond that fidelity plateaus.
 *
 * Async because storagePath refresh requires a Supabase API call.
 * For non-generation uses (display, scoring) where you already have a usable URL,
 * call getCanonicalReferencesSync instead.
 */
export async function getCanonicalReferences(profile: AthleteProfile | null): Promise<string[]> {
  if (!profile) return [];
  const { getSignedUrl } = await import("./storage");
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const key of NB_FACE_PRIORITY) {
    const angle = profile.captureAngles.find(a => a.key === key);
    if (!angle) continue;
    let url: string | undefined;
    if (angle.falCdnUrl) {
      url = angle.falCdnUrl;
    } else if (angle.storagePath) {
      // Refresh signed URL — 1-year expiry, cached in memory by caller
      const fresh = await getSignedUrl(angle.storagePath, 365 * 24 * 3600).catch(() => null);
      url = fresh ?? angle.storageUrl ?? angle.dataUrl;
    } else {
      url = angle.storageUrl ?? angle.dataUrl;
    }
    if (url && !seen.has(url)) {
      seen.add(url);
      refs.push(url);
    }
  }
  return refs;
}

/**
 * Sync variant — returns best available cached URL without any network calls.
 * Use for scoring, display, and any non-generation context.
 * Priority per angle: falCdnUrl → storageUrl → dataUrl.
 */
export function getCanonicalReferencesSync(profile: AthleteProfile | null): string[] {
  if (!profile) return [];
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const key of NB_FACE_PRIORITY) {
    const angle = profile.captureAngles.find(a => a.key === key);
    if (!angle) continue;
    const url = angle.falCdnUrl ?? angle.storageUrl ?? angle.dataUrl;
    if (url && !seen.has(url)) {
      seen.add(url);
      refs.push(url);
    }
  }
  return refs;
}

/** Patch canonical set fields onto a profile and persist. */
export function saveCanonicalSet(
  athleteId: string,
  patch: Pick<AthleteProfile, "canonicalReferenceFrameIds" | "canonicalSetScore" | "canonicalSetVariance" | "canonicalSetStatus" | "canonicalSetValidatedAt" | "canonicalSetHouseStyleVersion" | "canonicalSetIdentityCardUrls" | "canonicalSetFailureReason">,
): void {
  const profile = getAthleteProfile(athleteId);
  if (!profile) return;
  saveAthleteProfile({ ...profile, ...patch, version: profile.version + 1, updatedAt: new Date().toISOString() });
}

export function getProfilePromptConstraints(profile: AthleteProfile | null): string[] {
  if (!profile) return [];
  const constraints = [...profile.doNotChange];
  for (const tattoo of profile.tattoos.filter(t => t.visible)) {
    const loc = tattoo.location ? ` on ${tattoo.location}` : "";
    constraints.push(`preserve: ${tattoo.description}${loc}`);
  }
  return constraints;
}

export function getAthleteProfile(athleteId: string): AthleteProfile | null {
  return _cache?.profiles.get(athleteId) ?? null;
}
export function saveAthleteProfile(profile: AthleteProfile): void {
  if (_cache) _cache.profiles.set(profile.athleteId, profile);
  _dbProfile(profile);
}
export function deleteAthleteProfile(athleteId: string): void {
  if (_cache) _cache.profiles.delete(athleteId);
  _delete("subject_profiles", { subject_id: athleteId });
}
export function addRejectedLikeness(athleteId: string, entry: RejectedLikeness): void {
  const profile = getAthleteProfile(athleteId) ?? createEmptyProfile(athleteId);
  saveAthleteProfile({
    ...profile,
    rejectedLikeness: [...(profile.rejectedLikeness ?? []), entry],
    version: profile.version + 1,
    updatedAt: new Date().toISOString(),
  });
}
export function removeRejectedLikeness(athleteId: string, idx: number): void {
  const profile = getAthleteProfile(athleteId);
  if (!profile) return;
  saveAthleteProfile({
    ...profile,
    rejectedLikeness: (profile.rejectedLikeness ?? []).filter((_, i) => i !== idx),
    version: profile.version + 1,
    updatedAt: new Date().toISOString(),
  });
}

// ---------- credits ----------

export function getCredits(): number {
  return _cache?.credits ?? 500;
}
export function deductCredits(amount: number): number {
  const next = Math.max(0, getCredits() - amount);
  if (_cache) _cache.credits = next;
  return next;
}
export async function refreshCredits(): Promise<void> {
  const uid = _userId;
  if (!uid) return;
  const { data } = await supabase.from("users").select("credits").eq("id", uid).single();
  if (typeof data?.credits === "number") {
    if (_cache) _cache.credits = data.credits;
  }
}

// ---------- render queue ----------

export function getQueue(): QueueItem[] {
  return _cache?.queue ?? [];
}
export function saveQueue(items: QueueItem[]): void {
  if (_cache) _cache.queue = items;
}
export function pushQueueItem(item: QueueItem): QueueItem[] {
  const list = [item, ...getQueue()];
  if (_cache) _cache.queue = list;
  return list;
}
export function updateQueueItem(id: string, patch: Partial<QueueItem>): QueueItem[] {
  const list = getQueue().map(i => i.id === id ? { ...i, ...patch } : i);
  if (_cache) _cache.queue = list;
  return list;
}
export function removeQueueItem(id: string): QueueItem[] {
  const list = getQueue().filter(i => i.id !== id);
  if (_cache) _cache.queue = list;
  return list;
}

// ---------- generation runs ----------

export function getRuns(campaignId: string): Run[] {
  return _cache?.runsMap.get(campaignId) ?? [];
}
export function addRun(run: Run): void {
  const list = [run, ...getRuns(run.campaignId)].slice(0, 500);
  if (_cache) _cache.runsMap.set(run.campaignId, list);
  _dbRun(run);
}
export function updateRun(campaignId: string, id: string, patch: Partial<Run>): void {
  const list = getRuns(campaignId).map(r => r.id === id ? { ...r, ...patch } : r);
  if (_cache) _cache.runsMap.set(campaignId, list);
  const updated = list.find(r => r.id === id);
  if (updated) _dbRun(updated);
}

// ---------- generation jobs ----------

export function getJobs(): GenerationJob[] {
  return _cache?.jobs ?? [];
}
export function addJob(job: GenerationJob): void {
  const active = getJobs().filter(j => j.status === "queued" || j.status === "running");
  const done   = getJobs().filter(j => j.status === "complete" || j.status === "failed").slice(0, 30);
  const list   = [job, ...active, ...done];
  if (_cache) _cache.jobs = list;
}
export function updateJob(id: string, patch: Partial<GenerationJob>): void {
  const list = getJobs().map(j => j.id === id ? { ...j, ...patch } : j);
  if (_cache) _cache.jobs = list;
}
export function getJobById(id: string): GenerationJob | undefined {
  return getJobs().find(j => j.id === id);
}
export function getActiveJobForCampaign(campaignId: string): GenerationJob | undefined {
  return getJobs().find(
    j => j.campaignId === campaignId && (j.status === "queued" || j.status === "running"),
  );
}

// ---------- campaign outputs ----------

export function getCampaignOutputs(campaignId?: string): CampaignOutput[] {
  const all = _cache?.outputs ?? [];
  return campaignId ? all.filter(o => o.campaignId === campaignId) : all;
}
export function saveCampaignOutputs(outputs: CampaignOutput[]): void {
  if (_cache) _cache.outputs = outputs;
}
export function addCampaignOutput(output: CampaignOutput): void {
  const list = [...getCampaignOutputs(), output];
  if (_cache) _cache.outputs = list;
  _dbOutput(output);
}
export function updateCampaignOutput(id: string, patch: Partial<CampaignOutput>): void {
  const list = getCampaignOutputs().map(o => o.id === id ? { ...o, ...patch } : o);
  if (_cache) _cache.outputs = list;
  const updated = list.find(o => o.id === id);
  if (updated) _dbOutput(updated);
}
export function setOutputStatus(id: string, status: OutputStatus, reviewedBy: string, rejectionReason?: RejectionReason): void {
  const now = new Date().toISOString();
  const existing = getCampaignOutputs().find(o => o.id === id);
  const entry: ReviewHistoryEntry = { status, by: reviewedBy, at: now };
  const history = [...(existing?.reviewHistory ?? []), entry];
  const patch: Partial<CampaignOutput> = { status, reviewedBy, reviewedAt: now, reviewHistory: history };
  if (status === "rejected" && rejectionReason) patch.rejectionReason = rejectionReason;
  if (status !== "rejected") patch.rejectionReason = undefined;
  updateCampaignOutput(id, patch);
}
export function addOutputComment(outputId: string, comment: OutputComment): void {
  const list = getCampaignOutputs().map(o =>
    o.id === outputId ? { ...o, comments: [...(o.comments ?? []), comment] } : o
  );
  if (_cache) _cache.outputs = list;
  const updated = list.find(o => o.id === outputId);
  if (updated) _dbOutput(updated);
}
export function addOutputTag(outputId: string, tag: string): void {
  const list = getCampaignOutputs().map(o => {
    if (o.id !== outputId) return o;
    const tags = o.tags ?? [];
    return tags.includes(tag) ? o : { ...o, tags: [...tags, tag] };
  });
  if (_cache) _cache.outputs = list;
  const updated = list.find(o => o.id === outputId);
  if (updated) _dbOutput(updated);
}
export function removeOutputTag(outputId: string, tag: string): void {
  const list = getCampaignOutputs().map(o =>
    o.id === outputId ? { ...o, tags: (o.tags ?? []).filter(t => t !== tag) } : o
  );
  if (_cache) _cache.outputs = list;
  const updated = list.find(o => o.id === outputId);
  if (updated) _dbOutput(updated);
}

// ---------- identity scoring ----------

const SCORE_DELAYS_MS = [2000, 4000, 8000] as const;

/**
 * Scores a generated output against a reference face with exponential backoff.
 * Persists status transitions so the UI can show pending/scoring/complete/failed.
 * Call immediately after generation — do NOT fire-and-forget computeResemblanceScore directly.
 */
export async function scoreOutputWithRetry(
  outputId: string,
  referenceUrl: string,
  generatedUrl: string,
): Promise<void> {
  const { computeResemblanceScore } = await import("./faceScore");
  updateCampaignOutput(outputId, { identityScoringStatus: "scoring", identityScoringAttempts: 0 });

  let lastError = "";
  for (let attempt = 0; attempt < SCORE_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, SCORE_DELAYS_MS[attempt - 1]));
    updateCampaignOutput(outputId, { identityScoringStatus: "scoring", identityScoringAttempts: attempt + 1 });
    try {
      const score = await computeResemblanceScore(referenceUrl, generatedUrl);
      if (score !== null) {
        updateCampaignOutput(outputId, {
          resemblanceScore: score,
          identityScoringStatus: "complete",
          identityScoringError: undefined,
        });
        _applyTierBehavior(outputId, score);
        return;
      }
      lastError = "No score returned";
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Scoring failed";
    }
  }

  updateCampaignOutput(outputId, {
    identityScoringStatus: "failed",
    identityScoringError: lastError || "Max retries reached",
  });
}

function _applyTierBehavior(outputId: string, score: number): void {
  const tier = getIdentityMatchTier(score);
  if (tier.shouldAutoFlag) {
    updateCampaignOutput(outputId, { status: "flagged" });
  }
  if (tier.autoTag) addOutputTag(outputId, tier.autoTag);
}

/**
 * Whether an output may be included in an export zip.
 * Unscored outputs (legacy) are allowed through for backward compat.
 */
export function canExportOutput(output: CampaignOutput): boolean {
  // Block if subject has explicitly rejected their likeness
  if (output.subjectApprovalStatus === "rejected") return false;
  // Block if subject approval is required but not yet given
  // (only enforced once a subject has been invited — pending means awaiting decision)
  // For outputs where no subject invite was sent, undefined means no gate applies.
  if (output.subjectApprovalStatus === "pending") return false;
  // Identity score gate — backward compat: no score = pass
  if (output.resemblanceScore === undefined) return true;
  return getIdentityMatchTier(output.resemblanceScore).canApproveForExport;
}

export function exportBlockReason(output: CampaignOutput): string | null {
  if (output.subjectApprovalStatus === "rejected") return "Subject rejected this likeness";
  if (output.subjectApprovalStatus === "pending") return "Awaiting subject approval";
  if (output.resemblanceScore !== undefined) {
    const tier = getIdentityMatchTier(output.resemblanceScore);
    if (!tier.canApproveForExport) return tier.restrictionReason;
  }
  return null;
}

/**
 * Returns outputs that are waiting to be scored.
 * Backward compat: outputs with resemblanceScore but no status are treated as complete.
 */
export function getPendingScoringOutputs(): CampaignOutput[] {
  return getCampaignOutputs().filter(o => o.identityScoringStatus === "pending");
}

// ---------- onboarding ----------

export function isOnboarded(): boolean {
  try { return localStorage.getItem("plb_onboarded") === "1"; } catch { return false; }
}
export function setOnboarded(): void {
  try { localStorage.setItem("plb_onboarded", "1"); } catch {}
}

// ---------- wardrobe kits ----------

export function getWardrobeKits(): WardrobeKit[] {
  return _cache?.wardrobeKits ?? [];
}
export function addWardrobeKit(kit: WardrobeKit): void {
  const list = [kit, ...getWardrobeKits()];
  if (_cache) _cache.wardrobeKits = list;
  _dbWardrobeKit(kit);
}
export function updateWardrobeKit(id: string, patch: Partial<WardrobeKit>): void {
  const now  = new Date().toISOString();
  const list = getWardrobeKits().map(k => k.id === id ? { ...k, ...patch, updatedAt: now } : k);
  if (_cache) _cache.wardrobeKits = list;
  const updated = list.find(k => k.id === id);
  if (updated) _dbWardrobeKit(updated);
}
export function deleteWardrobeKit(id: string): void {
  const list = getWardrobeKits().filter(k => k.id !== id);
  if (_cache) _cache.wardrobeKits = list;
  _delete("wardrobe_kits", { id });
}

// ---------- moodboards ----------

export function getMoodboards(): Moodboard[] {
  return _cache?.moodboards ?? [];
}
export function addMoodboard(mb: Moodboard): void {
  const list = [mb, ...getMoodboards()];
  if (_cache) _cache.moodboards = list;
  _dbMoodboard(mb);
}
export function updateMoodboard(id: string, patch: Partial<Moodboard>): void {
  const now  = new Date().toISOString();
  const list = getMoodboards().map(m => m.id === id ? { ...m, ...patch, updatedAt: now } : m);
  if (_cache) _cache.moodboards = list;
  const updated = list.find(m => m.id === id);
  if (updated) _dbMoodboard(updated);
}
export function deleteMoodboard(id: string): void {
  const list = getMoodboards().filter(m => m.id !== id);
  if (_cache) _cache.moodboards = list;
  _delete("moodboards", { id });
}

// ---------- role ----------

export function getUserRole(): "admin" | "editor" | "viewer" {
  return _cache?.role ?? "editor";
}

// ---------- studio mode ----------

export function getStudioMode(): "quick" | "expert" {
  try { return (localStorage.getItem("plb_studio_mode") as "quick" | "expert") || "quick"; } catch { return "quick"; }
}
export function setStudioMode(mode: "quick" | "expert"): void {
  try { localStorage.setItem("plb_studio_mode", mode); } catch {}
}

// ── Usage consent ────────────────────────────────────────────────────────────

export function saveUsageConsent(athleteId: string, consent: UsageConsent): void {
  if (!_cache) return;
  const idx = _cache.athletes.findIndex(a => a.id === athleteId);
  if (idx === -1) return;
  const profile = _cache.profiles.get(athleteId);
  if (!profile) return;
  const updated: AthleteProfile = { ...profile, usageConsent: consent };
  _cache.profiles.set(athleteId, updated);
  _dbProfile(updated);
}

export function getUsageConsent(athleteId: string): UsageConsent | undefined {
  return _cache?.profiles.get(athleteId)?.usageConsent;
}

// ── Collaboration tasks ──────────────────────────────────────────────────────

export function getCollabTasks(athleteId: string): CollabTask[] {
  return _cache?.profiles.get(athleteId)?.collabTasks ?? [];
}

export function addCollabTask(athleteId: string, task: CollabTask): void {
  if (!_cache) return;
  const profile = _cache.profiles.get(athleteId);
  if (!profile) return;
  const updated: AthleteProfile = {
    ...profile,
    collabTasks: [...(profile.collabTasks ?? []), task],
  };
  _cache.profiles.set(athleteId, updated);
  _dbProfile(updated);
}

export function updateCollabTask(athleteId: string, taskId: string, patch: Partial<CollabTask>): void {
  if (!_cache) return;
  const profile = _cache.profiles.get(athleteId);
  if (!profile) return;
  const updated: AthleteProfile = {
    ...profile,
    collabTasks: (profile.collabTasks ?? []).map(t => t.id === taskId ? { ...t, ...patch } : t),
  };
  _cache.profiles.set(athleteId, updated);
  _dbProfile(updated);
}

/** Returns default tasks that should be created when a subject portal invite is sent */
export function defaultCollabTasksForSubject(athleteId: string): CollabTask[] {
  const now = new Date().toISOString();
  return [
    {
      id: `task-${crypto.randomUUID().slice(0, 8)}`,
      subjectId: athleteId,
      type: "sign_consent",
      title: "Review and sign consent",
      description: "Confirm your consent to AI likeness generation and specify usage scopes.",
      status: "pending",
      createdAt: now,
    },
    {
      id: `task-${crypto.randomUUID().slice(0, 8)}`,
      subjectId: athleteId,
      type: "upload_references",
      title: "Upload reference photos",
      description: "Provide 9 reference photos so the AI can accurately preserve your likeness.",
      status: "pending",
      createdAt: now,
    },
    {
      id: `task-${crypto.randomUUID().slice(0, 8)}`,
      subjectId: athleteId,
      type: "review_outputs",
      title: "Review generated outputs",
      description: "Approve or reject each generated image of your likeness.",
      status: "pending",
      createdAt: now,
    },
  ];
}

// ── Portal invite ────────────────────────────────────────────────────────────

export function savePortalInvite(athleteId: string, token: string, invitedBy: string): void {
  if (!_cache) return;
  const profile = _cache.profiles.get(athleteId);
  if (!profile) return;
  const tasks = defaultCollabTasksForSubject(athleteId);
  const updated: AthleteProfile = {
    ...profile,
    portalToken: token,
    portalInvitedAt: new Date().toISOString(),
    portalInvitedBy: invitedBy,
    collabTasks: tasks,
  };
  _cache.profiles.set(athleteId, updated);
  _dbProfile(updated);
}

export function getPortalToken(athleteId: string): string | undefined {
  return _cache?.profiles.get(athleteId)?.portalToken;
}

export function revokePortalToken(athleteId: string): void {
  if (!_cache) return;
  const profile = _cache.profiles.get(athleteId);
  if (!profile) return;
  const updated: AthleteProfile = {
    ...profile,
    portalToken: undefined,
    portalInvitedAt: undefined,
    portalInvitedBy: undefined,
  };
  _cache.profiles.set(athleteId, updated);
  _notifyListeners();

  // Retry up to 3 times with 2s backoff. On total failure, restore the in-memory
  // token so the UI doesn't show "revoked" while the portal is still accessible.
  const DELAYS = [0, 2000, 4000];
  (async () => {
    for (let attempt = 0; attempt < DELAYS.length; attempt++) {
      if (DELAYS[attempt]) await new Promise(r => setTimeout(r, DELAYS[attempt]));
      const { error } = await supabase
        .from("subject_profiles")
        .update({ portal_token: null } as Record<string, null>)
        .eq("subject_id", athleteId)
        .eq("user_id", _userId);
      if (!error) return;
      if (attempt === DELAYS.length - 1) {
        console.error("[store] revokePortalToken: all retries failed", error.message);
        if (_cache) {
          const current = _cache.profiles.get(athleteId);
          if (current) _cache.profiles.set(athleteId, { ...current, portalToken: profile.portalToken, portalInvitedAt: profile.portalInvitedAt, portalInvitedBy: profile.portalInvitedBy });
          _notifyListeners();
        }
        _onWriteError?.("subject_profiles");
      }
    }
  })();
}
