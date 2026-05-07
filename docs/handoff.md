# Handoff

## Handoff — 2025-05-07

### Completed This Session
- Sprint 0: Full product audit (architecture, capabilities, 6-moat gap analysis, UX audit, technical risks, sprint order)
- Sprint 1: Identity Profiles — complete

### Sprint 1 — What Was Built

**New interfaces in `data/athletes.ts`:**
- `AngleKey` (moved from component scope)
- `CaptureAngle` (key, dataUrl, uploadedAt, notes)
- `TattooMark` (id, description, location, visible)
- `ApprovedLikeness` (imageUrl, context, approvedAt)
- `AthleteProfile` (athleteId, version, updatedAt, captureAngles, tattoos, doNotChange, approvedLikeness, notes)

**New store functions in `app/lib/store.ts`:**
- `getAthleteProfile(athleteId)` → `AthleteProfile | null`
- `saveAthleteProfile(profile)` → void
- `deleteAthleteProfile(athleteId)` → void
- Key: `plb_{userId}_athleteProfile_{athleteId}`

**`app/components/AthleteLibrary.tsx` — complete rewrite:**
- Removed `captureImages` and `tattoos` component state
- Added `profile: AthleteProfile | null` state
- Loads profile on athlete selection via `getAthleteProfile`
- Saves profile immediately on every change via `saveAthleteProfile`
- `compressToDataUrl()` helper: resizes to 800px JPEG, safe for localStorage
- AngleSlot now reads from `profile.captureAngles`, falls back to `athlete.image` (blob URL guard added)
- Do-not-change section: add/remove constraints, saved to profile
- Identity notes: textarea in Identity tab, saves on blur
- Tattoos now have `visible` toggle (controls whether they appear in prompts)
- Approved likeness gallery in Identity tab
- Profile version increments on each save

**`app/components/AddAthleteModal.tsx`:**
- Photo upload now converts to base64 DataURL (not blob URL)
- Uses same `compressToDataUrl` pattern — photo persists after refresh

**`app/lib/promptEnhancer.ts`:**
- `EnhanceOptions` now accepts `doNotChange?: string[]`
- If present, appended as "Identity constraints: ..." to prompt
- `buildCampaignPrompt` accepts and passes `doNotChange`

**`app/components/CampaignWorkspace.tsx`:**
- Imports `getAthleteProfile`, `saveAthleteProfile`, `ApprovedLikeness`
- `runBatch` now loads athlete profile and passes `doNotChange` to `buildCampaignPrompt`
- `markAsLikeness(output)` function: saves approved output to athlete's `approvedLikeness[]`
- Bookmark icon button added to output hover overlay (saves as likeness reference)

### In Progress

Nothing — Sprint 1 complete and build verified clean.

### Immediate Next Action

Begin Sprint 2: Creative Recipes.

1. Create `data/recipes.ts` with `Recipe` interface (extends current Workflow with negativePrompt, qualityChecklist, styleRules, aspectRatioLocked, etc.)
2. Add `getRecipes` / `saveRecipe` / `deleteRecipe` to `store.ts`
3. Seed 4-6 recipe examples
4. Build recipe create/edit modal in WorkflowLibrary
5. Wire recipe into NewCampaignModal
6. Surface quality checklist in CampaignWorkspace sidebar

### Modified Files

- `data/athletes.ts` — added AthleteProfile and related interfaces
- `app/lib/store.ts` — added profile storage functions
- `app/components/AthleteLibrary.tsx` — full rewrite with persistent profile
- `app/components/AddAthleteModal.tsx` — base64 upload fix
- `app/lib/promptEnhancer.ts` — doNotChange injection
- `app/components/CampaignWorkspace.tsx` — profile integration + mark as likeness

### Important Notes

- **localStorage size:** base64 images at 800px JPEG ≈ 150-300KB each. 9 angles = ~2MB per athlete. Should be fine for 3-5 athletes but worth monitoring. Consider adding a storage warning in Sprint 3.
- **Visible toggle on tattoos:** tattoos marked `visible: false` are excluded from prompt injection. UI shows "hidden" badge. This is important for subjects who want tattoos documented but not always shown.
- **Profile version:** increments on every save. Used to detect staleness in future sync logic.
- **Demo account:** seed athletes use `/athletes/james-magnussen.jpg` (static paths, not base64) — these will continue to work as-is. No regression.
- **Blob URL guard:** `athlete.image.startsWith("blob:")` check prevents broken images on athlete cards for pre-fix athletes.

### Active Blockers (User Action Required)

- Supabase schema migration not run
- Demo account not created in Supabase
- Site URL not set in Supabase

### Risks Introduced

- localStorage approaching limit if users upload many athletes with many angles. Low immediate risk. Monitor in Sprint 3.
- No regression observed on demo account or generation flow (build clean).
