# Current State

## Status

Pre-launch. Sprint 1 complete. Sprint 2 (Creative Recipes) next.

## Completed

### Infrastructure
- [x] Supabase auth (email/password, JWT Bearer token threading to fal.ai)
- [x] Per-user localStorage namespacing (`plb_{userId}_*`)
- [x] Demo account seeding (daniel@pluribus.ai gets athletes + projects; all others start empty)
- [x] Bun proxy at 127.0.0.1:3333 (auth signup + fal.ai forwarding with token validation)
- [x] nginx reverse proxy at :80 with CSP headers
- [x] Settings page (profile, password, theme, notifications)

### Generation
- [x] Image generation (FLUX Schnell/Dev/Pro, nano-banana) via fal.ai
- [x] Video generation (Pika 2.2, Kling v2/Pro, Sora) via fal.ai
- [x] Prompt enhancement (athlete descriptor, sport-specific actions, quality tail)
- [x] Resemblance scoring (OpenCV.js histogram, 0-100 score on campaign outputs)
- [x] Batch generation per campaign (runBatch loops over athletes)
- [x] Studio with full controls (pose, LoRA, seed, guidance, aspect ratio, color treatment)

### Campaigns & Assets
- [x] Campaign creation (from templates or blank)
- [x] Campaign output storage (CampaignOutput persisted to localStorage)
- [x] Approve / reject outputs (persists to localStorage)
- [x] Filter outputs by approval state
- [x] Export approved (opens URLs in tabs — basic)

### Sprint 1 — Identity Profiles ✓
- [x] AthleteProfile schema (`CaptureAngle`, `TattooMark`, `AthleteProfile`, `ApprovedLikeness`) in `data/athletes.ts`
- [x] `getAthleteProfile` / `saveAthleteProfile` / `deleteAthleteProfile` in `store.ts`
- [x] Capture angles persist to localStorage (base64 DataURL, compressed to 800px JPEG)
- [x] Tattoos / marks persist to localStorage (description, location, visible toggle)
- [x] Do-not-change constraints persist and are injected into generation prompts
- [x] Identity notes persist (textarea in Identity tab)
- [x] Approved likeness entries visible in Identity tab
- [x] "Mark as likeness reference" button on campaign output hover (saves to athlete profile)
- [x] doNotChange constraints injected via `buildCampaignPrompt` → `enhancePrompt`
- [x] Blob URL bug fixed in AddAthleteModal (converts to base64 DataURL on upload)
- [x] Blob URL fallback in AthleteLibrary (stale blob URLs show placeholder, not broken image)

## In Progress

Nothing — Sprint 1 complete.

## Next Sprint

**Sprint 2: Creative Recipes**
- Upgrade Workflow → Recipe schema (add negativePrompt, qualityChecklist, styleRules, etc.)
- Recipe library page (browse, create, edit, clone)
- Recipe quality checklist visible in campaign workspace review
- Negative prompt injected at generation time

## Known Issues / Debt

- Resemblance scoring still uses histogram (Phase 2: replace with ML classifier)
- localStorage size limit: base64 images take ~2.6MB per 2MB photo. 9 angles × multiple athletes can approach 5-10MB limit. Monitor and add warning.
- CampaignOutput schema still thin (no tags, comments, reviewer, runId, metadata) — Sprint 4
- Sport enum hard-coded: `"Swimming" | "Track" | "Weightlifting"` — needs to be free-form string
- No generation run records yet — Sprint 3
- Fake "Share" link in CampaignWorkspace (copies non-functional URL) — remove or implement
- Supabase DB schema not yet migrated (manual action still needed)
- Demo account creation in Supabase (manual action still needed)

## Blockers (User Action Required)

- [ ] Run Supabase schema migration in Supabase SQL editor
- [ ] Create demo account (daniel@pluribus.ai / demo123) in Supabase Auth > Users
- [ ] Set Site URL in Supabase Auth > URL Configuration
