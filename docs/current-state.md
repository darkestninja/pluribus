# Current State

## Status

Pre-launch. Sprints 1–8 complete. Sprint 9 next.

## Completed

### Infrastructure
- [x] Supabase auth (email/password, JWT Bearer token threading to fal.ai)
- [x] Per-user localStorage namespacing (`plb_{userId}_*`)
- [x] Demo account seeding (daniel@pluribus.ai gets athletes + projects)
- [x] Bun proxy at 127.0.0.1:3333 (auth signup + fal.ai forwarding)
- [x] nginx reverse proxy at :80 with CSP headers + correct Cache-Control (index.html no-cache, assets immutable)
- [x] Settings page (profile, password, theme, notifications)

### Generation
- [x] Image generation (FLUX Schnell/Dev/Pro, nano-banana) via fal.ai
- [x] Video generation (Pika 2.2, Kling v2/Pro, Sora) via fal.ai
- [x] Prompt enhancement (athlete descriptor, sport-specific actions, quality tail)
- [x] Negative prompt injection (from recipe, applied to all generation paths)
- [x] Resemblance scoring (OpenCV.js histogram, 0-100 score)
- [x] Batch generation per campaign
- [x] Studio with full controls
- [x] Seed capture from fal.ai via `onSeed` callback

### Campaigns & Assets
- [x] Campaign creation (recipe selection, athlete assignment)
- [x] Campaign output storage (CampaignOutput + runId persisted)
- [x] Approve / reject outputs (persists to localStorage)
- [x] Filter outputs by approval state (6 tabs: All/Approved/Pending/Revision/Flagged/Rejected)
- [x] Export approved as ZIP with metadata.json (jszip, Sprint 8)

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

### Sprint 5 — Asset Tagging + Cross-Campaign Search ✓
- [x] `tags?: string[]` on `CampaignOutput` + `addOutputTag`/`removeOutputTag` store helpers
- [x] Tag chip UI in `AssetDetailPanel` (add/remove, idempotent)
- [x] `relativeTime()` extracted to `app/lib/utils.ts`
- [x] Run records capped at 50 per campaign
- [x] `LibraryPage` — global asset grid, filters by subject/status/text

### Sprint 6 — Organization Layer ✓
- [x] `Athlete.sport` widened from enum → `string`
- [x] `AddAthleteModal` — free-text sport + event inputs
- [x] `AthleteLibrary` — sport filter is text input; "Athletes" → "Subjects" labels
- [x] `Projects.tsx` / `Onboarding.tsx` — `getRecipes()` replaces `workflowTemplates`
- [x] `data/workflows.ts` deleted
- [x] `CommandPalette` — Subjects rename, Library nav item, ViewType updated
- [x] `App.tsx` — ViewType `athletes` → `subjects`, `library` added; nav + routing updated

### Sprint 7 — Creative Constitution UX ✓
- [x] Quality checklist items are interactive (toggle, checked state, progress counter)
- [x] `brief?: string` on `Project`; `updateProject(id, patch)` store helper added
- [x] Creative brief textarea in `CampaignWorkspace` sidebar — auto-saves on blur
- [x] Brief injected into `enhancePrompt` as "Campaign brief: …"
- [x] Recipe card is collapsible — expands to show style/lighting/composition/negative prompt

### Sprint 8 — Asset Export + Identity Memory ✓
- [x] `downloadUrl()` / `downloadZip()` utilities in `app/lib/utils.ts`
- [x] jszip added as dependency
- [x] Per-asset download button in `AssetDetailPanel` header
- [x] Campaign "Export N" button builds ZIP (approved assets + metadata.json) via downloadZip
- [x] `isExporting` loading state on export button
- [x] `RejectedLikeness` interface added to `data/athletes.ts`
- [x] `rejectedLikeness?: RejectedLikeness[]` on `AthleteProfile` (backward compatible)
- [x] `addRejectedLikeness` / `removeRejectedLikeness` in `store.ts`
- [x] "Reject" (ThumbsDown) button in `AssetDetailPanel` footer — calls `onMarkRejectedLikeness`
- [x] `onMarkRejectedLikeness` wired in `CampaignWorkspace`
- [x] Rejected likeness section in `AthleteLibrary` identity tab (red-tinted grid, × remove)
- [x] `ReviewHistoryEntry { status, by, at }` on `CampaignOutput`
- [x] `setOutputStatus` appends to `reviewHistory[]` (append-only audit trail)
- [x] Collapsible review history timeline in `AssetDetailPanel`
- [x] Dashboard activity feed now reads `getCampaignOutputs()` sorted by `createdAt` desc

## In Progress

Nothing — ready for Sprint 9.

## Known Issues / Bugs

- `LibraryPage` does not pass `onMarkRejectedLikeness` to `AssetDetailPanel` — "Reject" button visible but non-functional in the library view
- `QueuePage` / `RenderQueue` are Studio-only and create a confusing parallel to Campaign generation — needs UX clarification
- No URL routing — back button broken, links cannot be shared
- `App.tsx` (491 lines), `CampaignWorkspace.tsx` (884 lines), `AthleteLibrary.tsx` (928 lines) — monolith threshold approaching
- `CommandPalette` has its own local `ViewType` — must be kept in sync with App.tsx manually
- `Project.workflowId` field is actually a `recipeId` — legacy name causing confusion

## Critical Pre-Launch Blockers (User Action Required)

- [ ] Add HTTPS — certbot/Let's Encrypt on 185.158.132.125
- [ ] Run Supabase schema migration in SQL editor
- [ ] Create demo account: daniel@pluribus.ai / demo123 in Supabase Auth > Users
- [ ] Set Site URL: http://185.158.132.125 in Supabase Auth > URL Configuration

## Technical Risks (Active)

| Risk | Severity | Notes |
|---|---|---|
| No HTTPS — credentials over HTTP | Critical | certbot; user action |
| All product data localStorage-only | Critical | Migrate to Supabase Phase 2 |
| fal.ai CDN URL expiry → approved assets 404 | High | downloadZip mitigates but doesn't solve permanently |
| localStorage quota (base64 images ~2MB per athlete) | High | Supabase Storage migration planned |
| Supabase schema not migrated | High | Blocking for new signups |
| App.tsx / CampaignWorkspace.tsx monolith size | Medium | Split before Sprint 11 |
| No credits enforcement server-side | Medium | UI-only; easily bypassed |
| Resemblance scorer accuracy (histogram) | Known | Phase 2: ML classifier |
