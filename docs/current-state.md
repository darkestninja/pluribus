# Current State

## Status

Pre-launch. Sprint 3 complete. Sprint 4 (Approval System expansion) next.

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

## In Progress

Nothing — Sprint 3 complete.

## Next Sprint

**Sprint 4: Approval System Expansion**
- Expand CampaignOutput approval states: `pending | approved | rejected | flagged | needs_revision`
- Add comments/feedback field to CampaignOutput
- Reviewer name (from session)
- Review history log per asset
- Filter gallery by approval state (already exists — expand states)
- Remove fake "Share" link or implement real review URL

## Known Issues / Debt

- Resemblance scoring still uses histogram (Phase 2: ML classifier)
- localStorage limit: base64 images ~2MB per athlete for full angle set
- Sport enum hard-coded in Athlete: `"Swimming" | "Track" | "Weightlifting"` — Sprint 6
- Fake "Share" link in CampaignWorkspace — Sprint 4
- `buildCampaignPrompt` param named `doNotChange` but receives full constraints — minor
- `data/workflows.ts` superseded but not removed — Sprint 6 cleanup

## Blockers (User Action Required)

- [ ] Run Supabase schema migration in Supabase SQL editor
- [ ] Create demo account (daniel@pluribus.ai / demo123) in Supabase Auth > Users
- [ ] Set Site URL in Supabase Auth > URL Configuration
