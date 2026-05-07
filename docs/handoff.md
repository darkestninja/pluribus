# Handoff

## Handoff — 2025-05-07 (Sprint 2)

### Completed This Session
- Sprint 1: Identity Profiles (committed)
- Sprint 2: Creative Recipes (complete)

### Sprint 2 — What Was Built

**`data/recipes.ts`** (new file):
- `Recipe` interface: id, name, description, thumbnail, useCase, prompt, negativePrompt, aspectRatio, aspectRatioLocked, defaultLook, styleRules[], lightingRules[], compositionRules[], qualityChecklist[], tags[], isSystemRecipe, createdAt, updatedAt
- 6 seed recipes with full prompts, negative prompts, checklists:
  - Classic Noir (wf-noir-studio) — B&W studio portrait
  - Daylight Action (wf-daylight-action) — golden hour sports
  - Victory Podium (wf-victory-podium) — celebration coverage
  - Editorial Portrait (recipe-editorial-portrait) — press kit headshot
  - Social Vertical (recipe-social-vertical) — 9:16 social content
  - Athlete Announcement (recipe-announcement) — broadcast-ready portrait

**`app/lib/store.ts`** additions:
- `seedRecipes` imported from data/recipes.ts
- All users get recipes seeded on first login (not just demo account)
- `getRecipes()`, `addRecipe()`, `updateRecipe()`, `deleteRecipe()` — full CRUD

**`app/lib/generate.ts`**:
- `negativePrompt?: string` added to `GenerateImageParams`
- Passed to fal.ai as `negative_prompt` field in request input

**`app/components/WorkflowLibrary.tsx`** (complete rewrite):
- Loads recipes from `getRecipes()` (not static import)
- Browse with category filter and search
- Recipe cards: thumbnail, name, useCase, tags, neg/checklist badge indicators
- Expandable checklist preview per card
- Clone button (all recipes) → opens create modal pre-filled
- Edit button (user recipes only)
- Delete button with confirmation (user recipes only)
- System recipes marked with shield icon, cannot be deleted
- Create/edit modal with 3 tabs: Basic (name, prompt, negative, tags), Creative Direction (style/lighting/composition rules), Checklist (quality checklist items)
- All recipes persist to localStorage

**`app/components/NewCampaignModal.tsx`**:
- Removed `workflowTemplates` import
- "Recipe" section now calls `getRecipes()` to show all recipes

**`app/components/CampaignWorkspace.tsx`**:
- Imports `getRecipes`, `CheckSquare`
- `wf = getRecipes().find(r => r.id === project.workflowId)` (was workflowTemplates.find)
- `runBatch` passes `negativePrompt: wf?.negativePrompt`
- `regenerateOutput` passes `negativePrompt: wf?.negativePrompt`
- Right sidebar: "Recipe" section (was "Style")
- Right sidebar: "Review checklist" section shows qualityChecklist items as visual checkboxes

**`app/components/Workspace.tsx`**:
- Removed `workflowTemplates` import
- All 4 usages replaced with `getRecipes()` / `.find(r => r.id === ...)`
- `generateImage` call now passes `negativePrompt: preset?.negativePrompt`

**`app/App.tsx`**:
- Nav label "Styles" → "Recipes"
- PAGE_TITLES "Styles" → "Recipes"

### In Progress

Nothing — Sprint 2 complete and build verified clean.

### Immediate Next Action

Begin Sprint 3: Generation Run Records.

1. Create `Run` interface in `data/runs.ts` (or `app/lib/store.ts`)
2. Add `getRuns`, `addRun`, `updateRun` to store.ts
3. In `generate.ts` / `CampaignWorkspace.tsx`: create run record before generation, update on completion
4. In `CampaignWorkspace.tsx`: run history panel (timeline/list)
5. Add `runId` field to `CampaignOutput`
6. Asset detail view: show run ID, prompt, seed, model, resemblance score

### Modified Files (Sprint 2)

- `data/recipes.ts` — new file
- `app/lib/store.ts` — recipe CRUD + seeding
- `app/lib/generate.ts` — negativePrompt param
- `app/components/WorkflowLibrary.tsx` — complete rewrite
- `app/components/NewCampaignModal.tsx` — use getRecipes()
- `app/components/CampaignWorkspace.tsx` — recipe lookup, checklist, negative prompt
- `app/components/Workspace.tsx` — recipe source swap + negativePrompt
- `app/App.tsx` — nav label rename

### Important Notes

- Seed recipes use same IDs as old workflow templates (wf-noir-studio, etc.). Existing projects continue to resolve their workflowId correctly — no data migration needed.
- `data/workflows.ts` is now superseded but left in place for safety. It is no longer imported by any component. Can be removed in Sprint 6 cleanup.
- `negative_prompt` field is passed to fal.ai for all models. If a model doesn't support it, fal.ai ignores the field gracefully.
- Recipe seeding for all users uses `plb_{userId}_recipes_seeded` flag to run only once per user.

### Active Blockers (User Action Required)

- Supabase schema migration not run
- Demo account not created in Supabase
- Site URL not set in Supabase

### Risks Introduced

- None significant. Build passes clean. No generation flow changes other than adding optional negativePrompt.
