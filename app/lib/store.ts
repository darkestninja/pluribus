import { athletes as seedAthletes, Athlete, AthleteProfile } from "../../data/athletes";
import { projects as seedProjects, archivedProjects as seedArchived, Project } from "../../data/projects";
import { seedRecipes, Recipe } from "../../data/recipes";

export const DEMO_EMAIL = "daniel@pluribus.ai";

// Namespaced per user — set by initStore() after login.
// Falls back to a throwaway prefix before login (queue reads return [] safely).
let _prefix = "plb_pre_";

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
    // Re-throw quota errors so callers can surface a warning to the user.
    // Swallow other errors (e.g. Safari private-browsing storage restrictions).
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
      throw e;
    }
  }
}

/** Call immediately after the user session is known, before any store reads drive UI. */
export function initStore(userId: string, userEmail: string) {
  _prefix = `plb_${userId}_`;

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
}

// ---------- athletes ----------
export function getAthletes(): Athlete[] {
  return load<Athlete[]>("athletes", []);
}
export function saveAthletes(athletes: Athlete[]): void {
  save("athletes", athletes);
}
export function addAthlete(athlete: Athlete): Athlete[] {
  const list = [...getAthletes(), athlete];
  saveAthletes(list);
  return list;
}

// ---------- projects ----------
export function getProjects(): Project[] {
  return load<Project[]>("projects", []);
}
export function getArchivedProjects(): Project[] {
  return load<Project[]>("archived", []);
}
export function saveProjects(projects: Project[]): void {
  save("projects", projects);
}
export function addProject(project: Project): Project[] {
  const list = [...getProjects(), project];
  saveProjects(list);
  return list;
}
export function updateProject(id: string, patch: Partial<Project>): void {
  saveProjects(getProjects().map(p => p.id === id ? { ...p, ...patch } : p));
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
  return load<AthleteProfile | null>(`athleteProfile_${athleteId}`, null);
}
export function saveAthleteProfile(profile: AthleteProfile): void {
  save(`athleteProfile_${profile.athleteId}`, profile);
}
export function deleteAthleteProfile(athleteId: string): void {
  try { localStorage.removeItem(key(`athleteProfile_${athleteId}`)); } catch {}
}

// ---------- recipes ----------
export function getRecipes(): Recipe[] {
  return load<Recipe[]>("recipes", seedRecipes);
}
export function saveRecipes(recipes: Recipe[]): void {
  save("recipes", recipes);
}
export function addRecipe(recipe: Recipe): void {
  saveRecipes([...getRecipes(), recipe]);
}
export function updateRecipe(id: string, patch: Partial<Recipe>): void {
  saveRecipes(getRecipes().map(r => r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r));
}
export function deleteRecipe(id: string): void {
  saveRecipes(getRecipes().filter(r => r.id !== id || r.isSystemRecipe));
}

// ---------- credits ----------
export function getCredits(): number {
  return load<number>("credits", 500);
}
export function deductCredits(amount: number): number {
  const next = Math.max(0, getCredits() - amount);
  save("credits", next);
  return next;
}

// ---------- render queue ----------
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

export function getQueue(): QueueItem[] {
  return load<QueueItem[]>("queue", []);
}
export function saveQueue(items: QueueItem[]): void {
  save("queue", items);
}
export function pushQueueItem(item: QueueItem): QueueItem[] {
  const list = [item, ...getQueue()];
  saveQueue(list);
  return list;
}
export function updateQueueItem(id: string, patch: Partial<QueueItem>): QueueItem[] {
  const list = getQueue().map(i => i.id === id ? { ...i, ...patch } : i);
  saveQueue(list);
  return list;
}
export function removeQueueItem(id: string): QueueItem[] {
  const list = getQueue().filter(i => i.id !== id);
  saveQueue(list);
  return list;
}

// ---------- generation runs ----------
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

export function getRuns(campaignId: string): Run[] {
  return load<Run[]>(`runs_${campaignId}`, []);
}
export function addRun(run: Run): void {
  const list = [run, ...getRuns(run.campaignId)].slice(0, 50);
  save(`runs_${run.campaignId}`, list);
}
export function updateRun(campaignId: string, id: string, patch: Partial<Run>): void {
  const list = getRuns(campaignId).map(r => r.id === id ? { ...r, ...patch } : r);
  save(`runs_${campaignId}`, list);
}

// ---------- campaign outputs ----------
export type OutputStatus = "pending" | "approved" | "needs_revision" | "rejected" | "flagged";

export interface OutputComment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface CampaignOutput {
  id: string;
  campaignId: string;
  athleteId?: string;
  runId?: string;
  url: string;
  status: OutputStatus;
  resemblanceScore?: number;
  createdAt: string;
  comments?: OutputComment[];
  reviewedBy?: string;
  reviewedAt?: string;
  tags?: string[];
}

export function getCampaignOutputs(campaignId?: string): CampaignOutput[] {
  const all = load<CampaignOutput[]>("outputs", []);
  return campaignId ? all.filter(o => o.campaignId === campaignId) : all;
}
export function saveCampaignOutputs(outputs: CampaignOutput[]): void {
  save("outputs", outputs);
}
export function addCampaignOutput(output: CampaignOutput): void {
  saveCampaignOutputs([...getCampaignOutputs(), output]);
}
export function updateCampaignOutput(id: string, patch: Partial<CampaignOutput>): void {
  saveCampaignOutputs(getCampaignOutputs().map(o => o.id === id ? { ...o, ...patch } : o));
}
export function setOutputStatus(id: string, status: OutputStatus, reviewedBy: string): void {
  updateCampaignOutput(id, { status, reviewedBy, reviewedAt: new Date().toISOString() });
}
export function addOutputComment(outputId: string, comment: OutputComment): void {
  saveCampaignOutputs(
    getCampaignOutputs().map(o =>
      o.id === outputId ? { ...o, comments: [...(o.comments ?? []), comment] } : o
    )
  );
}
export function addOutputTag(outputId: string, tag: string): void {
  saveCampaignOutputs(
    getCampaignOutputs().map(o => {
      if (o.id !== outputId) return o;
      const tags = o.tags ?? [];
      return tags.includes(tag) ? o : { ...o, tags: [...tags, tag] };
    })
  );
}
export function removeOutputTag(outputId: string, tag: string): void {
  saveCampaignOutputs(
    getCampaignOutputs().map(o =>
      o.id === outputId ? { ...o, tags: (o.tags ?? []).filter(t => t !== tag) } : o
    )
  );
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
