# Current State

## Status

Pre-launch. Sprint 2 complete. Sprint 3 (Generation Run Records) next.

## Completed

### Infrastructure
- [x] Supabase auth (email/password, JWT Bearer token threading to fal.ai)
- [x] Per-user localStorage namespacing (`plb_{userId}_*`)
- [x] Demo account seeding (daniel@pluribus.ai gets athletes + projects)
- [x] Bun proxy at 127.0.0.1:3333 (auth signup + fal.ai forwarding)
- [x] nginx reverse proxy at :80 with CSP headers
- [x] Settings page (profile, password, theme, notifications)

### Generation
- [x] Image generation (FLUX Schnell/Dev/Pro, nano-banana) via fal.ai
- [x] Video generation (Pika 2.2, Kling v2/Pro, Sora) via fal.ai
- [x] Prompt enhancement (athlete descriptor, sport-specific actions, quality tail)
- [x] **Negative prompt injection** (from recipe, applied to all generation paths)
- [x] Resemblance scoring (OpenCV.js histogram, 0-100 score on campaign outputs)
- [x] Batch generation per campaign
- [x] Studio with full controls (pose, LoRA, seed, guidance, aspect ratio, color treatment)

### Campaigns & Assets
- [x] Campaign creation (recipe selection, athlete assignment)
- [x] Campaign output storage (CampaignOutput persisted to localStorage)
- [x] Approve / reject outputs (persists to localStorage)
- [x] Filter outputs by approval state
- [x] Export approved (opens URLs in tabs — basic)

### Sprint 1 — Identity Profiles ✓
- [x] AthleteProfile schema (capture angles, tattoos, do-not-change, approved likeness, notes)
- [x] Profile persists to localStorage (base64 JPEG, compressed to 800px)
- [x] Do-not-change + visible tattoo constraints injected into all generation prompts
- [x] Approved likeness saved from campaign workspace (bookmark action)
- [x] Blob URL bug fixed in AddAthleteModal

### Sprint 2 — Creative Recipes ✓
- [x] `Recipe` interface in `data/recipes.ts` (prompt, negativePrompt, qualityChecklist, styleRules, lightingRules, compositionRules, aspectRatioLocked, isSystemRecipe)
- [x] 6 seed recipes: Classic Noir, Daylight Action, Victory Podium, Editorial Portrait, Social Vertical, Athlete Announcement
- [x] Recipes seed for ALL users on first login (not just demo account)
- [x] `getRecipes` / `addRecipe` / `updateRecipe` / `deleteRecipe` in store.ts
- [x] WorkflowLibrary upgraded to full recipe library (browse, create, edit, clone, delete)
- [x] Create/edit modal with Basic / Creative Direction / Checklist tabs
- [x] Clone system recipes → editable user copies
- [x] System recipes cannot be deleted
- [x] `NewCampaignModal` shows all recipes from store
- [x] `CampaignWorkspace` quality checklist visible in review sidebar
- [x] `CampaignWorkspace` recipe lookup from store (not static templates)
- [x] Negative prompt injected in `runBatch`, `regenerateOutput`, and Studio generation
- [x] `Workspace.tsx` preset dropdown loads all recipes from store
- [x] Nav label renamed "Styles" → "Recipes"

## In Progress

Nothing — Sprint 2 complete.

## Next Sprint

**Sprint 3: Generation Run Records**
- Create `Run` schema (runId, athleteId, recipeId, prompt, seed, model, status, assetIds, etc.)
- Create run record before each generation
- Link CampaignOutputs to run ID
- Run history visible in CampaignWorkspace
- Asset detail shows: run, prompt, seed, model, resemblance score
- Re-run from previous run parameters

## Known Issues / Debt

- Resemblance scoring still uses histogram (Phase 2: replace with ML classifier)
- localStorage size limit: base64 images ~2MB per athlete for full angle set
- CampaignOutput schema thin (no tags, comments, reviewer, runId) — Sprint 3-4
- Sport enum hard-coded in Athlete: `"Swimming" | "Track" | "Weightlifting"` — Sprint 6
- Fake "Share" link in CampaignWorkspace — remove or implement
- Supabase DB schema not yet migrated (manual action still needed)
- Minor: `buildCampaignPrompt` param still named `doNotChange` but receives full constraints

## Blockers (User Action Required)

- [ ] Run Supabase schema migration in Supabase SQL editor
- [ ] Create demo account (daniel@pluribus.ai / demo123) in Supabase Auth > Users
- [ ] Set Site URL in Supabase Auth > URL Configuration
