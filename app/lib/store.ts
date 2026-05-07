import { athletes as seedAthletes, Athlete, AthleteProfile, RejectedLikeness } from "../../data/athletes";
export type { RejectedLikeness };
import { projects as seedProjects, archivedProjects as seedArchived, Project, CampaignStatus, ExportLogEntry } from "../../data/projects";
export type { CampaignStatus, ExportLogEntry };
import { seedRecipes, Recipe } from "../../data/recipes";
import { supabase } from "./supabase";

export const DEMO_EMAIL = "daniel@pluribus.ai";

// Namespaced per user — set by initStore() after login.
let _prefix = "plb_pre_";
let _userId  = "";

// ── localStorage helpers ─────────────────────────────────────────────────────

function key(name: string) { return _prefix + name; }

function load<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function save<T>(name: string, val: T): void {
  try {
    localStorage.setItem(key(name), JSON.stringify(val));
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
      throw e;
    }
  }
}

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
  createdAt: string;
  comments?: OutputComment[];
  reviewedBy?: string;
  reviewedAt?: string;
  tags?: string[];
  reviewHistory?: ReviewHistoryEntry[];
}

export interface Run {
  id: string;
  campaignId: string;
  athleteId?: string;
  athleteName?: string;
  recipeId?: string;
  recipeName?: string;
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
  recipes: Recipe[];
  credits: number;
  queue: QueueItem[];
  runsMap: Map<string, Run[]>;
  outputs: CampaignOutput[];
}

let _cache: StoreCache | null = null;

// ── Supabase write-through ───────────────────────────────────────────────────

function _upsert(table: string, data: object, onConflict: string) {
  if (!_userId) return;
  supabase.from(table).upsert(data, { onConflict }).then(({ error }) => {
    if (error) console.warn(`[store] ${table} upsert failed:`, error.message);
  });
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
  _upsert("subjects", { id: a.id, user_id: _userId, data: a, updated_at: new Date().toISOString() }, "user_id,id");
}
function _dbCampaign(p: Project) {
  _upsert("campaigns", { id: p.id, user_id: _userId, type: p.type, data: p, updated_at: new Date().toISOString() }, "user_id,id");
}
function _dbProfile(profile: AthleteProfile) {
  _upsert("subject_profiles", { athlete_id: profile.athleteId, user_id: _userId, data: profile, updated_at: profile.updatedAt }, "user_id,athlete_id");
}
function _dbRecipe(r: Recipe) {
  _upsert("recipes", { id: r.id, user_id: _userId, is_system: r.isSystemRecipe, data: r, updated_at: r.updatedAt }, "user_id,id");
}
function _dbOutput(o: CampaignOutput) {
  _upsert("campaign_outputs", { id: o.id, campaign_id: o.campaignId, user_id: _userId, status: o.status, data: o, created_at: o.createdAt }, "user_id,id");
}
function _dbRun(r: Run) {
  _upsert("campaign_runs", { id: r.id, campaign_id: r.campaignId, user_id: _userId, data: r, created_at: r.startedAt }, "user_id,id");
}

// ── init ─────────────────────────────────────────────────────────────────────

/** Call immediately after the user session is known, before any store reads drive UI. */
export function initStore(userId: string, userEmail: string) {
  _prefix = `plb_${userId}_`;
  _userId = userId;

  // Seed demo account once — every other account starts completely empty
  if (userEmail === DEMO_EMAIL && !localStorage.getItem(_prefix + "seeded")) {
    save("athletes", seedAthletes);
    save("projects", seedProjects);
    save("archived", seedArchived);
    save("credits", 500);
    localStorage.setItem(_prefix + "seeded", "1");
  }

  // Seed system recipes for ALL users on first login
  if (!localStorage.getItem(_prefix + "recipes_seeded")) {
    save("recipes", seedRecipes);
    localStorage.setItem(_prefix + "recipes_seeded", "1");
  }

  // Build cache from localStorage — synchronous baseline before hydrateStore resolves
  _cache = {
    athletes:         load<Athlete[]>("athletes", []),
    projects:         load<Project[]>("projects", []),
    archivedProjects: load<Project[]>("archived", []),
    profiles:         new Map(),
    recipes:          load<Recipe[]>("recipes", seedRecipes),
    credits:          load<number>("credits", 500),
    queue:            load<QueueItem[]>("queue", []),
    runsMap:          new Map(),
    outputs:          load<CampaignOutput[]>("outputs", []),
  };
}

/**
 * Async: pull all product data from Supabase into the in-memory cache.
 * Where Supabase has data it takes precedence over localStorage.
 * Where Supabase is empty and localStorage has data, pushes to Supabase (one-time migration).
 * Silently falls back to localStorage if Supabase is unavailable (tables not yet created).
 */
export async function hydrateStore(userId: string): Promise<void> {
  if (!_cache) return;

  const [subjectsRes, campaignsRes, profilesRes, recipesRes, outputsRes, runsRes] =
    await Promise.allSettled([
      supabase.from("subjects").select("data").eq("user_id", userId),
      supabase.from("campaigns").select("data, type").eq("user_id", userId),
      supabase.from("subject_profiles").select("athlete_id, data").eq("user_id", userId),
      supabase.from("recipes").select("data").eq("user_id", userId),
      supabase.from("campaign_outputs").select("data").eq("user_id", userId),
      supabase.from("campaign_runs").select("campaign_id, data").eq("user_id", userId),
    ]);

  // subjects
  if (subjectsRes.status === "fulfilled" && !subjectsRes.value.error) {
    const rows = subjectsRes.value.data ?? [];
    if (rows.length > 0) {
      _cache.athletes = rows.map(r => r.data as Athlete);
      save("athletes", _cache.athletes);
    } else if (_cache.athletes.length > 0) {
      _cache.athletes.forEach(_dbSubject); // one-time migration
    }
  }

  // campaigns
  if (campaignsRes.status === "fulfilled" && !campaignsRes.value.error) {
    const rows = campaignsRes.value.data ?? [];
    if (rows.length > 0) {
      const active   = rows.filter(r => r.type !== "archived").map(r => r.data as Project);
      const archived = rows.filter(r => r.type === "archived").map(r => r.data as Project);
      if (active.length)   { _cache.projects         = active;   save("projects", active); }
      if (archived.length) { _cache.archivedProjects  = archived; save("archived", archived); }
    } else {
      const all = [..._cache.projects, ..._cache.archivedProjects];
      if (all.length > 0) all.forEach(_dbCampaign);
    }
  }

  // subject_profiles — populate Map; lazy-loads for profiles not yet fetched
  if (profilesRes.status === "fulfilled" && !profilesRes.value.error) {
    for (const r of (profilesRes.value.data ?? [])) {
      _cache.profiles.set(r.athlete_id as string, r.data as AthleteProfile);
    }
  }

  // recipes
  if (recipesRes.status === "fulfilled" && !recipesRes.value.error) {
    const rows = recipesRes.value.data ?? [];
    if (rows.length > 0) {
      _cache.recipes = rows.map(r => r.data as Recipe);
      save("recipes", _cache.recipes);
    } else if (_cache.recipes.length > 0) {
      _cache.recipes.forEach(_dbRecipe);
    }
  }

  // campaign_outputs
  if (outputsRes.status === "fulfilled" && !outputsRes.value.error) {
    const rows = outputsRes.value.data ?? [];
    if (rows.length > 0) {
      _cache.outputs = rows.map(r => r.data as CampaignOutput);
      save("outputs", _cache.outputs);
    } else if (_cache.outputs.length > 0) {
      _cache.outputs.forEach(_dbOutput);
    }
  }

  // campaign_runs — group by campaignId
  if (runsRes.status === "fulfilled" && !runsRes.value.error) {
    for (const r of (runsRes.value.data ?? [])) {
      const cid  = r.campaign_id as string;
      const list = _cache.runsMap.get(cid) ?? [];
      list.push(r.data as Run);
      _cache.runsMap.set(cid, list);
    }
    // Sort each bucket newest-first
    _cache.runsMap.forEach((list, cid) => {
      _cache!.runsMap.set(cid, list.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
    });
  }
}

// ---------- athletes ----------

export function getAthletes(): Athlete[] {
  return _cache?.athletes ?? load<Athlete[]>("athletes", []);
}
export function saveAthletes(list: Athlete[]): void {
  if (_cache) _cache.athletes = list;
  save("athletes", list);
  list.forEach(_dbSubject);
}
export function addAthlete(athlete: Athlete): Athlete[] {
  const list = [...getAthletes(), athlete];
  if (_cache) _cache.athletes = list;
  save("athletes", list);
  _dbSubject(athlete);
  return list;
}

// ---------- projects ----------

export function getProjects(): Project[] {
  return _cache?.projects ?? load<Project[]>("projects", []);
}
export function getArchivedProjects(): Project[] {
  return _cache?.archivedProjects ?? load<Project[]>("archived", []);
}
export function saveProjects(projects: Project[]): void {
  if (_cache) _cache.projects = projects;
  save("projects", projects);
  projects.forEach(_dbCampaign);
}
export function addProject(project: Project): Project[] {
  const list = [...getProjects(), project];
  if (_cache) _cache.projects = list;
  save("projects", list);
  _dbCampaign(project);
  return list;
}
export function updateProject(id: string, patch: Partial<Project>): void {
  const list = getProjects().map(p => p.id === id ? { ...p, ...patch } : p);
  if (_cache) _cache.projects = list;
  save("projects", list);
  const updated = list.find(p => p.id === id);
  if (updated) _dbCampaign(updated);
}
export function appendExportLog(id: string, entry: ExportLogEntry): void {
  const list = getProjects().map(p =>
    p.id === id ? { ...p, exportLog: [entry, ...(p.exportLog ?? [])] } : p
  );
  if (_cache) _cache.projects = list;
  save("projects", list);
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
  if (_cache) {
    if (_cache.profiles.has(athleteId)) return _cache.profiles.get(athleteId) ?? null;
    // Lazy-load from localStorage for profiles not yet in Supabase
    const fromStorage = load<AthleteProfile | null>(`athleteProfile_${athleteId}`, null);
    if (fromStorage) {
      _cache.profiles.set(athleteId, fromStorage);
      _dbProfile(fromStorage); // push to Supabase
    }
    return fromStorage;
  }
  return load<AthleteProfile | null>(`athleteProfile_${athleteId}`, null);
}
export function saveAthleteProfile(profile: AthleteProfile): void {
  if (_cache) _cache.profiles.set(profile.athleteId, profile);
  save(`athleteProfile_${profile.athleteId}`, profile);
  _dbProfile(profile);
}
export function deleteAthleteProfile(athleteId: string): void {
  if (_cache) _cache.profiles.delete(athleteId);
  try { localStorage.removeItem(key(`athleteProfile_${athleteId}`)); } catch {}
  _delete("subject_profiles", { athlete_id: athleteId });
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

// ---------- recipes ----------

export function getRecipes(): Recipe[] {
  return _cache?.recipes ?? load<Recipe[]>("recipes", seedRecipes);
}
export function saveRecipes(recipes: Recipe[]): void {
  if (_cache) _cache.recipes = recipes;
  save("recipes", recipes);
  recipes.forEach(_dbRecipe);
}
export function addRecipe(recipe: Recipe): void {
  saveRecipes([...getRecipes(), recipe]);
}
export function updateRecipe(id: string, patch: Partial<Recipe>): void {
  saveRecipes(getRecipes().map(r => r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r));
}
export function deleteRecipe(id: string): void {
  saveRecipes(getRecipes().filter(r => r.id !== id || r.isSystemRecipe));
  _delete("recipes", { id });
}

// ---------- credits ----------

export function getCredits(): number {
  return _cache?.credits ?? load<number>("credits", 500);
}
export function deductCredits(amount: number): number {
  const next = Math.max(0, getCredits() - amount);
  if (_cache) _cache.credits = next;
  save("credits", next);
  return next;
}

// ---------- render queue ----------

export function getQueue(): QueueItem[] {
  return _cache?.queue ?? load<QueueItem[]>("queue", []);
}
export function saveQueue(items: QueueItem[]): void {
  if (_cache) _cache.queue = items;
  save("queue", items);
}
export function pushQueueItem(item: QueueItem): QueueItem[] {
  const list = [item, ...getQueue()];
  if (_cache) _cache.queue = list;
  save("queue", list);
  return list;
}
export function updateQueueItem(id: string, patch: Partial<QueueItem>): QueueItem[] {
  const list = getQueue().map(i => i.id === id ? { ...i, ...patch } : i);
  if (_cache) _cache.queue = list;
  save("queue", list);
  return list;
}
export function removeQueueItem(id: string): QueueItem[] {
  const list = getQueue().filter(i => i.id !== id);
  if (_cache) _cache.queue = list;
  save("queue", list);
  return list;
}

// ---------- generation runs ----------

export function getRuns(campaignId: string): Run[] {
  if (_cache) {
    if (_cache.runsMap.has(campaignId)) return _cache.runsMap.get(campaignId)!;
    // Lazy-load from localStorage for campaigns whose runs aren't in the Map yet
    const fromStorage = load<Run[]>(`runs_${campaignId}`, []);
    _cache.runsMap.set(campaignId, fromStorage);
    if (fromStorage.length > 0) fromStorage.forEach(_dbRun);
    return fromStorage;
  }
  return load<Run[]>(`runs_${campaignId}`, []);
}
export function addRun(run: Run): void {
  const list = [run, ...getRuns(run.campaignId)].slice(0, 50);
  if (_cache) _cache.runsMap.set(run.campaignId, list);
  save(`runs_${run.campaignId}`, list);
  _dbRun(run);
}
export function updateRun(campaignId: string, id: string, patch: Partial<Run>): void {
  const list = getRuns(campaignId).map(r => r.id === id ? { ...r, ...patch } : r);
  if (_cache) _cache.runsMap.set(campaignId, list);
  save(`runs_${campaignId}`, list);
  const updated = list.find(r => r.id === id);
  if (updated) _dbRun(updated);
}

// ---------- campaign outputs ----------

export function getCampaignOutputs(campaignId?: string): CampaignOutput[] {
  const all = _cache?.outputs ?? load<CampaignOutput[]>("outputs", []);
  return campaignId ? all.filter(o => o.campaignId === campaignId) : all;
}
export function saveCampaignOutputs(outputs: CampaignOutput[]): void {
  if (_cache) _cache.outputs = outputs;
  save("outputs", outputs);
}
export function addCampaignOutput(output: CampaignOutput): void {
  const list = [...getCampaignOutputs(), output];
  if (_cache) _cache.outputs = list;
  save("outputs", list);
  _dbOutput(output);
}
export function updateCampaignOutput(id: string, patch: Partial<CampaignOutput>): void {
  const list = getCampaignOutputs().map(o => o.id === id ? { ...o, ...patch } : o);
  if (_cache) _cache.outputs = list;
  save("outputs", list);
  const updated = list.find(o => o.id === id);
  if (updated) _dbOutput(updated);
}
export function setOutputStatus(id: string, status: OutputStatus, reviewedBy: string): void {
  const now = new Date().toISOString();
  const existing = getCampaignOutputs().find(o => o.id === id);
  const entry: ReviewHistoryEntry = { status, by: reviewedBy, at: now };
  const history = [...(existing?.reviewHistory ?? []), entry];
  updateCampaignOutput(id, { status, reviewedBy, reviewedAt: now, reviewHistory: history });
}
export function addOutputComment(outputId: string, comment: OutputComment): void {
  const list = getCampaignOutputs().map(o =>
    o.id === outputId ? { ...o, comments: [...(o.comments ?? []), comment] } : o
  );
  if (_cache) _cache.outputs = list;
  save("outputs", list);
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
  save("outputs", list);
  const updated = list.find(o => o.id === outputId);
  if (updated) _dbOutput(updated);
}
export function removeOutputTag(outputId: string, tag: string): void {
  const list = getCampaignOutputs().map(o =>
    o.id === outputId ? { ...o, tags: (o.tags ?? []).filter(t => t !== tag) } : o
  );
  if (_cache) _cache.outputs = list;
  save("outputs", list);
  const updated = list.find(o => o.id === outputId);
  if (updated) _dbOutput(updated);
}

// ---------- onboarding ----------

export function isOnboarded(): boolean {
  return load<boolean>("onboarded", false);
}
export function setOnboarded(): void {
  save("onboarded", true);
}

// ---------- studio mode ----------

export function getStudioMode(): "quick" | "expert" {
  return load<"quick" | "expert">("studio_mode", "quick");
}
export function setStudioMode(mode: "quick" | "expert"): void {
  save("studio_mode", mode);
}
