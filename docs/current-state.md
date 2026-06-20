# Current State

## Status

Pre-launch. Sprints 1–20 complete + Sprint 13 (13a Ship-Blockers + 13b Consent Moat + 13c Observability) complete. Deployed 2026-06-20. 6/6 E2E tests passing.

---

## Completed

### Infrastructure
- [x] Supabase auth (email/password, JWT Bearer token threading to fal.ai proxy)
- [x] HTTPS via Let's Encrypt (pluribus.danielasiegbunam.com)
- [x] Bun proxy at 127.0.0.1:3333 — auth signup, asset mirror, review tokens, fal.ai proxy, canonical validation, subject portal routes
- [x] nginx reverse proxy — TLS termination, rate limiting, CSP; `/storage/` + `/api/review/` + `/api/fal/` + `/auth/` + `/canonical/` + `/api/subject/` rules (20MB body limit on subject routes)
- [x] Supabase Postgres — Phase 1 tables: `users`, `assets`, `asset_versions`, `exports`
- [x] Supabase Postgres — Phase 2 tables: `subjects`, `subject_profiles`, `campaigns`, `recipes`, `campaign_outputs`, `campaign_runs` (all live, RLS enforced)
- [x] Supabase Postgres — Phase 3 table: `review_tokens` (live)
- [x] Supabase Postgres — Phase 4–6 tables: `campaign_recipes`, `wardrobe_kits`, `moodboards` (live — migrated 2026-05-17)
- [x] Supabase Storage — `pluribus-assets-private`, `pluribus-exports-private` buckets (live, RLS enforced)
- [x] In-memory cache in store.ts backed by Supabase; `hydrateStore()` on login; fire-and-forget write-through on all mutations
- [x] Asset mirror: post-generation CDN URL → `POST /storage/mirror` → permanent signed URL
- [x] Settings page (profile, password, theme, notifications)
- [x] Demo account seeding (daniel@pluribus.ai gets athletes + projects + recipes)
- [x] Bundle splitting — React.lazy + Suspense for 9 heavy page components; Vite manualChunks (vendor-react, vendor-ui, vendor-radix, vendor-supabase, vendor-fal); main chunk reduced from 1,035 kB → 416 kB

### Generation
- [x] Image generation via Nano Banana exclusively (fal-ai/nano-banana, IP-Adapter)
- [x] Video generation (Pika 2.2, Kling v2/Pro, Sora) via fal.ai — unchanged
- [x] All reference captures uploaded to fal CDN concurrently; passed as `reference_image_urls` (all) + `reference_image_url` (primary) to Nano Banana
- [x] House style conditioning via `styleReferenceUrls` (placeholder `[]` until style refs are sourced)
- [x] Resemblance scoring (OpenCV.js histogram, 0–100)
- [x] Batch generation per campaign
- [x] Studio with full controls (Workspace.tsx)
- [x] Seed capture from fal.ai via `onSeed` callback

### Prompt System
- [x] `buildNanaBananaPrompt(recipe)` — joins 7 structured NB scene fields into ≤60-word prompt
- [x] Legacy `recipe.prompt` fallback for user-created recipes predating NB schema
- [x] Campaign recipe mode (CampaignRecipeLibrary) untouched — has its own prompt builder
- [x] Wardrobe and moodboard prompt injection still live

### Campaigns & Assets
- [x] Campaign creation — 4-step wizard (Details → Subjects → Recipe → Moodboard)
- [x] Moodboard in campaign creation: image/PDF upload + link with `/fetch/preview` OG extraction
- [x] Subject selection with search (handles 40+ subjects)
- [x] Campaign status machine: draft / in_review / approved / delivered
- [x] Export log per campaign
- [x] Campaign output storage with Supabase write-through
- [x] 5-state approval: pending / approved / needs_revision / rejected / flagged
- [x] Rejection reason taxonomy (CC§20): FACE_DRIFT | AGE_DRIFT | SKIN_TONE | TATTOO_MISMATCH | WARDROBE | CONTEXT | QUALITY
- [x] Comment thread with reviewer attribution
- [x] Review history timeline (append-only audit trail)
- [x] Filter outputs by approval state (6 tabs)
- [x] Batch multi-select + bulk status actions
- [x] Export approved as ZIP with metadata.json (jszip)
- [x] Per-asset download
- [x] External review links — shareable `/review/{token}` URLs, no login required
- [x] Tags on outputs (free-form, searchable in Library)

### Identity Profiles (Sprint 1 ✓)
- [x] AthleteProfile schema (capture angles, tattoos, do-not-change, approved/rejected likeness, notes)
- [x] v3 9-frame capture protocol: `face-close` + 4 angles × 2 formats (passport + body)
  - Keys: `front-passport`, `front-body`, `left-passport`, `left-body`, `right-passport`, `right-body`, `back-passport`, `back-body`, `face-close`
  - Legacy keys kept for backward compat: `face-front`, `face-left`, `face-right`, `face-back`, `body-*`, `frame-1` through `frame-9`
- [x] Capture UI: face close-up solo, then 4 angle pairs (passport + body 2-col each)
- [x] Reference images uploaded to Supabase Storage post-capture; base64 kept as offline fallback
- [x] Profile completeness % — `getProfileCompleteness()` helper; progress bar on subject cards + campaign sidebar

### Creative Recipes (Sprint 2 ✓)
- [x] NB-optimised Recipe interface: `shot`, `action`, `environment`, `lighting`, `mood`, `style`, `colorStyle`
- [x] 6 seed recipes rewritten as structured NB scene descriptions
- [x] Legacy `prompt` + `negativePrompt` fields kept optional for backward compat
- [x] Recipe library (browse, create, edit, clone, delete)
- [x] Recipe form: Basic / Scene / Checklist tabs
- [x] Quality checklist visible and interactive in campaign review sidebar

### Generation Run Records (Sprint 3 ✓)
- [x] Run interface: id, campaignId, athleteId/Name, recipeId/Name, prompt, model, aspectRatio, seed, status, startedAt, completedAt, assetIds, errorMessage
- [x] Run history in CampaignWorkspace sidebar (click to filter gallery, re-run from run)
- [x] Asset detail panel with full generation lineage

### Approval System (Sprints 4–8 ✓)
- [x] 5-state OutputStatus, OutputComment, ReviewHistoryEntry
- [x] AssetDetailPanel standalone component with status selector, comment thread, tags, rejected likeness
- [x] 500-run cap (raised from 50)

### Asset Library (Sprint 5 ✓)
- [x] LibraryPage — global asset grid, filters by subject/status/text

### Organization Layer (Sprint 6 ✓)
- [x] Subjects rename throughout
- [x] getRecipes() unified recipe store
- [x] Library nav item

### Canonical Set Validation (updated Sprint 18)
- [x] `store.ts` — `getCanonicalReferences()` returns all captures in NB priority order (face-close first, then passport frames, then body frames, then legacy)
- [x] AthleteLibrary canonical validation UI: status badge, validate button, identity card grid, 15s poller
- [x] Proxy: `POST /canonical/validate`, `GET /canonical/status`
- [x] **Sprint 18**: Removed `CANONICAL_COMBOS` (vestigial frame-1-9 combo selection); now uses v3 semantic priority order directly, runs 3 quality-check test prompts, requires ≥3 captures (was exactly 9 `frame-N`)
- [x] `houseStyleVersion: "v3"` on new validation results

### House Style
- [x] `houseStyle.ts` — `HOUSE_STYLE_V1` (Kodak Portra 400 film aesthetic), `ACTIVE_HOUSE_STYLE`
- [x] `styleReferenceUrls: []` placeholder — awaiting style reference images on fal CDN

### Campaign Pack Generator (Sprint 19 ✓)
- [x] `data/campaignPacks.ts` — 4 pack types: Athlete Announcement (5 images), Hero Campaign (7), Social Content (6), Sponsor Clean (4)
- [x] Pack selector UI in Workspace right rail — pack cards + slot breakdown table + credit estimation
- [x] `handlePackGenerate` — loops slots × count, submits one job per image, deducts credits per job
- [x] `GenerationJob` extended with `packId` + `packName` for traceability
- [x] QueuePage — violet pack-name chip on jobs belonging to a pack

### Production Hardening + Consent Moat (Sprint 13 ✓ — 2026-06-20)

#### 13a — Ship-Blockers
- [x] `VITE_BYPASS_AUTH` — auth bypass now requires explicit env var; no longer a dev-mode leak in production
- [x] `clearStore()` called on SIGNED_OUT in `onAuthStateChange` — in-memory cache wiped on logout
- [x] `setWriteErrorHandler` registered in App.tsx — critical write failures surface as "Saved locally" toast
- [x] 429 backoff on generation queue — `rateRetryAfter` field on `GenerationJob`; skips job for 30s on 429; clears automatically
- [x] NSFW filter — generated images with `nsfw: true` flag stripped before display
- [x] SLA progress pill in header — shows `42% · ~20s` or `2/4 ready` during active generation
- [x] `TOKEN_REFRESHED` skip in `onAuthStateChange` — Realtime channel no longer recycled on pure token refresh

#### 13b — Consent Moat
- [x] 5 Subject Portal proxy routes live: GET portal data, POST consent, POST references, POST approve, POST reject
- [x] `resolvePortalToken()` — looks up `subject_profiles.portal_token` (service-role, no talent auth required)
- [x] Consent scope allowlist — `VALID_CONSENT_SCOPES` set; unknown scopes rejected at the proxy with 400
- [x] HTML-escaped email receipts — `htmlEscape()` applied to all user-sourced content before Resend interpolation
- [x] `athlete_id` anchor on approve/reject — prevents cross-subject forgery when two subjects share an operator account
- [x] Reference upload hardened — MIME allowlist (JPEG/PNG/WebP/HEIC), 20MB size cap, `frameIndex` bounded to [0,8]
- [x] `sanitizePromptField()` in `promptEnhancer.ts` — strips injection phrases, `system prompt`, `nsfw`, control characters from talent-sourced text
- [x] `revokePortalToken` retry — 3-retry loop (0/2/4s backoff); restores in-memory token + fires write-error toast on total failure
- [x] Supabase Realtime subscription moved to `initStore` — channel tracked in `_realtimeChannel`, removed on `clearStore` and re-init; no leak on re-auth
- [x] `can()` guards wired — `outputs:approve`, `outputs:export` in `CampaignWorkspace`; `members:manage` in `Settings`
- [x] SubjectPortal — `capture="user"` removed from file input; 3-step progress bar added; "Share approved" copies receipt text, not portal URL
- [x] Campaign readiness scores on Dashboard — inline talent enrollment + approval progress bars per campaign card
- [x] nginx `/api/subject/` location block — `client_max_body_size 20m`, `proxy_read_timeout 60s`

#### 13c — Observability + Polish
- [x] Sentry error tracking — `Sentry.init()` in `main.tsx` gated on `VITE_SENTRY_DSN`; `captureException` in `ErrorBoundary.componentDidCatch`
- [x] Playwright E2E — 6 tests (consent error gate, portal progress bar, app shell, review link, auth screen); all passing against production URL

### Collaboration Model (Sprint 20 ✓)
- [x] `app/lib/permissions.ts` — centralized 8-role model (`admin`, `editor`, `viewer`, `reviewer`, `subject`, `subject_manager`, `legal`, `guest`); 29 permissions; `can()` / `canAll()` / `canAny()` API
- [x] `SubjectPortal` at `/subject/<token>` — public, no auth; consent gate → likeness review → reference upload tabs
- [x] Consent step — usage scope selector (6 scopes), optional note, agreement checkbox; POSTs to `/api/subject/<token>/consent`
- [x] 9-frame reference upload in Subject Portal with per-slot preview and status
- [x] Subject approve/reject likeness — Approve / Reject buttons per output; reject requires free-text reason
- [x] `CampaignOutput` extended: `subjectApprovalStatus`, `subjectApprovalBy`, `subjectApprovalAt`, `subjectRejectionNote`
- [x] `canExportOutput` + `exportBlockReason` — blocks on `rejected`/`pending` subject approval before score gate
- [x] `AssetDetailPanel` — subject approval status badges (amber pending, red rejected with note, emerald approved)
- [x] `CampaignWorkspace` — export toasts surface specific block reason via `exportBlockReason`
- [x] `AthleteLibrary` — new "Collab" tab: portal invite link generator, consent status + scopes, task checklist, likeness approval summary
- [x] `data/athletes.ts` — `UsageConsent`, `UsageScope`, `CollabTask` types + `portalToken`/`usageConsent`/`collabTasks` on `AthleteProfile`
- [x] Store helpers: `saveUsageConsent`, `getUsageConsent`, `getCollabTasks`, `addCollabTask`, `updateCollabTask`, `savePortalInvite`, `getPortalToken`, `defaultCollabTasksForSubject`
- [x] Identity scoring — durable `identityScoringStatus` with exponential-backoff retry (Sprints 4–5)
- [x] Identity score tier system — 5 tiers (Hero/Campaign/Internal/Exploration/Weak); auto-flag, auto-tag, export gate (Sprint 5)
- [x] Settings — new "Members" tab: invite form with role selector, member list with role-change and remove

### External Review Links (Sprint 12 ✓)
- [x] ReviewPage at /review/{token} — public, no auth, tab filter, lightbox, download approved

### Supabase Persistence (Sprint 11 ✓)
- [x] All product data in Supabase Postgres with localStorage offline fallback
- [x] Auto-migration on first login

---

## Known Bugs (Active — Not Yet Fixed)

None currently known.

---

## Known Issues / Active Gaps
- **Workspace.tsx monolith** — ~1,360 lines; refactor deferred (JSX split requires UI testing)
- **Base64 dataUrls in Supabase JSONB** — reference images still stored as base64 in AthleteProfile; ~9MB per fully profiled subject
- **styleReferenceUrls is `[]`** — house style conditioning not active until fal CDN style refs are sourced
- **Canonical validation is NB-specific** — validation runs test prompts via NB then scores with Claude Haiku; serves as quality check, not frame selection
- **Members tab is a UI stub** — invite/role-change actions are local-state only; no Supabase `workspace_members` table or invite email flow yet

---

## Critical Pre-Launch Blockers

All resolved:
- [x] HTTPS — Let's Encrypt live
- [x] Supabase schema migration — Phase 1, 2, 3 tables all created and confirmed live
- [x] Demo account — daniel@pluribus.ai created
- [x] Site URL — https://pluribus.danielasiegbunam.com configured

---

## Technical Risks

| Risk | Severity | Status |
|---|---|---|
| Subject Portal proxy routes missing | High | Resolved — Sprint 13b |
| Members tab local-state only | Medium | Active — needs Supabase table + invite API |
| Base64 dataUrls in Supabase JSONB (~9MB/subject) | Medium | Active |
| Workspace.tsx monolith (~1,360 lines) | Low | Deferred |
| Signed URL expiry | Resolved | Sprint 15 — useRefreshableUrl hook |
| Recipe edits break run lineage | Resolved | Sprint 16 — recipeSnapshot on Run |
| No server-side credit enforcement | Resolved | Sprint 17 — proxy check/deduct, 402 on zero |
| No structured proxy logging | Resolved | Sprint 17 — reqId/userId/model/duration JSON |
| Studio/Campaign dual generation paradigm | Resolved | Sprint 18 — campaign context, back-to-campaign |
| No URL routing | Resolved | Sprint 17 — hash routing in App.tsx |
| Project.workflowId legacy naming | Resolved | Sprint 17 — renamed to recipeId |
| Supabase write-through: no retry on failure | Resolved | Sprint 16 — 3× exponential backoff |
| Workspace.tsx monolith (~1,200 lines) | Medium | Active |
| styleReferenceUrls empty — house style conditioning inactive | Medium | Active |
| doNotChange text constraints removed from NB prompts | Medium | Active — deliberate NB trade-off |
