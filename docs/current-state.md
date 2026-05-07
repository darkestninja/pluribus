# Current State

## Status

Pre-launch. Sprints 1–7 complete. Sprint 8 next (TBD).

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
- [x] Negative prompt injection (from recipe, applied to all generation paths)
- [x] Resemblance scoring (OpenCV.js histogram, 0-100 score)
- [x] Batch generation per campaign
- [x] Studio with full controls
- [x] **Seed capture from fal.ai via `onSeed` callback**

### Campaigns & Assets
- [x] Campaign creation (recipe selection, athlete assignment)
- [x] Campaign output storage (CampaignOutput + runId persisted)
- [x] Approve / reject outputs (persists to localStorage)
- [x] Filter outputs by approval state
- [x] Export approved (opens URLs in tabs)

### Sprint 1 — Identity Profiles ✓
- [x] AthleteProfile schema (capture angles, tattoos, do-not-change, approved likeness, notes)
- [x] Profile persists to localStorage (base64 JPEG, compressed 800px)
- [x] Constraints injected into all generation prompts
- [x] Approved likeness saved from campaign workspace

### Sprint 2 — Creative Recipes ✓
- [x] Recipe interface with full creative direction fields
- [x] 6 seed recipes (Classic Noir, Daylight Action, Victory Podium, Editorial Portrait, Social Vertical, Athlete Announcement)
- [x] Recipe library (browse, create, edit, clone, delete)
- [x] Negative prompt injected in all generation paths
- [x] Quality checklist visible in campaign review sidebar
- [x] Nav renamed "Styles" → "Recipes"

### Sprint 3 — Generation Run Records ✓
- [x] `Run` interface: id, campaignId, athleteId/Name, recipeId/Name, prompt, negativePrompt, seed, model, aspectRatio, status, startedAt, completedAt, assetIds, errorMessage
- [x] `getRuns` / `addRun` / `updateRun` in store.ts
- [x] `runId` added to `CampaignOutput` (backward compatible — optional)
- [x] `onSeed` callback added to `GenerateImageParams` — captures returned seed from fal.ai
- [x] Every `runBatch` iteration creates a Run record, captures seed, links outputs
- [x] Every `regenerateOutput` creates a Run record, captures seed
- [x] Run history section in CampaignWorkspace right sidebar (newest first, click to filter gallery)
- [x] Re-run button on each run record (regenerates with same prompt + seed)
- [x] Asset detail panel (click image → modal with full lineage: recipe, model, seed, prompt, negative prompt)
- [x] Approval actions available in asset detail panel
- [x] Graceful handling of pre-Sprint-3 outputs (no run record → info message)

### Sprint 4 — Approval System Expansion ✓
- [x] `OutputStatus` type: `pending | approved | needs_revision | rejected | flagged`
- [x] `OutputComment` interface: `{ id, text, author, createdAt }`
- [x] `CampaignOutput` extended with `comments[]`, `reviewedBy`, `reviewedAt` (all optional)
- [x] `setOutputStatus` + `addOutputComment` store helpers
- [x] `AssetDetailPanel` extracted as standalone component
- [x] 5-state status selector in asset detail panel
- [x] Comment thread + input with reviewer attribution
- [x] 6 filter tabs: All | Approved | Pending | Revision | Flagged | Rejected
- [x] Gallery card rings + badges for all 5 states
- [x] Comment count badge on card thumbnails
- [x] Hover overlay: 6 quick-action buttons
- [x] Reviewer email from Supabase session
- [x] Share button removed
- [x] `regenerateOutput` concurrency fixed + URL persistence fix

### Sprint 5 — Asset Tagging + Cross-Campaign Search ✓
- [x] `tags?: string[]` on `CampaignOutput` + `addOutputTag`/`removeOutputTag` store helpers
- [x] Tag chip UI in `AssetDetailPanel` (add/remove, idempotent)
- [x] `relativeTime()` extracted to `app/lib/utils.ts`, duplicates removed from AssetDetailPanel + CampaignWorkspace
- [x] Run records capped at 50 per campaign (`addRun` slices to 50, oldest trimmed)
- [x] `LibraryPage` — global asset grid, filters by subject/status/text (subject name, campaign name, tags)
- [x] Library nav entry (Images icon, 5th nav item)

### Sprint 7 — Creative Constitution UX ✓
- [x] Quality checklist items are interactive (toggle, checked state, progress counter "N / M")
- [x] `brief?: string` on `Project`; `updateProject(id, patch)` store helper added
- [x] Creative brief textarea in `CampaignWorkspace` sidebar — auto-saves on blur, "saved" indicator
- [x] Brief injected into `enhancePrompt` as "Campaign brief: …" after identity constraints
- [x] `buildCampaignPrompt` accepts optional `brief` 4th param
- [x] Recipe card is now collapsible — expands to show styleRules, lightingRules, compositionRules, negativePrompt
- [x] Stale-prop fix: brief textarea reads from localStorage directly, not from stale parent state
- [x] setTimeout cleanup: briefSavedTimerRef prevents setState on unmounted component
- [x] Sidebar "Athletes" → "Subjects" label (Sprint 6 rename missed this location)

### Sprint 6 — Organization Layer ✓
- [x] `Athlete.sport` widened from enum → `string` (backward compatible)
- [x] `AddAthleteModal` — free-text sport + event inputs (removed SPORTS enum + EVENTS map)
- [x] `AthleteLibrary` — sport filter is text input (partial match); "Athletes" → "Subjects" labels throughout
- [x] `Projects.tsx` / `Onboarding.tsx` — `getRecipes()` replaces `workflowTemplates` (IDs match)
- [x] `data/workflows.ts` deleted
- [x] `CommandPalette` — Athletes group → Subjects, Library nav item, ViewType updated
- [x] `App.tsx` — ViewType `athletes` → `subjects`, `library` added; nav + routing updated

## In Progress

Nothing — ready for Sprint 8.

## Next Sprint — Sprint 8 (TBD)

Candidates (user to choose):
- Side-by-side asset comparison
- Export packs (ZIP with metadata)
- Contact sheet view
- Batch feedback / bulk status actions

## Known Issues / Debt

- Resemblance scoring still uses histogram (Phase 2: ML classifier)
- localStorage limit: base64 images ~2MB per athlete for full angle set
- `buildCampaignPrompt` param named `doNotChange` but receives full constraints — minor rename
- Hover overlay 6 icons may clip on 2-column grid at narrow viewports
- `CommandPalette` has its own local `ViewType` definition — must be kept in sync with `App.tsx` manually

## Blockers (User Action Required)

- [ ] Run Supabase schema migration in Supabase SQL editor
- [ ] Create demo account (daniel@pluribus.ai / demo123) in Supabase Auth > Users
- [ ] Set Site URL in Supabase Auth > URL Configuration
