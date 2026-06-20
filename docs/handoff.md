# Handoff

## Handoff — 2026-06-20 (Sprint 13 — Production Hardening + Consent Moat) ← CURRENT

### Completed This Session

**Sprint 13a — Ship-Blockers:**
- `App.tsx` — `BYPASS_AUTH` now `import.meta.env.VITE_BYPASS_AUTH === "true"`; `.env.local` (gitignored) holds the flag for local dev
- `store.ts` — `clearStore()` called on SIGNED_OUT; `setWriteErrorHandler` registered (shows "Saved locally" toast); `TOKEN_REFRESHED` skip in `onAuthStateChange`
- `App.tsx` — 429 backoff: `rateRetryAfter` on `GenerationJob`; skips job for 30s; NSFW filter strips `nsfw: true` outputs; SLA progress pill in header

**Sprint 13b — Consent Moat:**
- `proxy.ts` — 5 SubjectPortal routes: GET `/api/subject/:token`, POST consent, POST references (upload), POST approve, POST reject
- `proxy.ts` — `resolvePortalToken()` resolves `subject_profiles.portal_token` via service-role Supabase; no talent auth required
- `proxy.ts` — `VALID_CONSENT_SCOPES` allowlist; `htmlEscape()` helper; athlete_id anchor on approve/reject; frameIndex bounds check [0,8]; MIME allowlist + 20MB cap on reference upload
- `proxy.ts` — consent receipt email via Resend to `invited_by` email; HTML-escaped
- `store.ts` — Realtime subscription moved to `initStore`, tracked in `_realtimeChannel`, removed on `clearStore`; `revokePortalToken` 3-retry loop (0/2/4s) with in-memory restore on failure
- `SubjectPortal.tsx` — `capture="user"` removed; 3-step progress bar; "Share approved" copies receipt text not portal URL
- `CampaignWorkspace.tsx` — `can()` guards on `outputs:approve` and `outputs:export`
- `Settings.tsx` — `can()` guards on `members:manage`
- `Dashboard.tsx` — campaign readiness scores (enrollment + approval progress bars)
- `promptEnhancer.ts` — `sanitizePromptField()` strips injection phrases, `system prompt`, `nsfw`, control characters from talent-sourced text
- `nginx` — `/api/subject/` location block; `client_max_body_size 20m`; `proxy_read_timeout 60s`

**Sprint 13c — Observability + Polish:**
- `main.tsx` — Sentry init gated on `VITE_SENTRY_DSN`
- `ErrorBoundary.tsx` — `Sentry.captureException` in `componentDidCatch`
- `playwright.config.ts` + `e2e/consent.spec.ts` + `e2e/approval.spec.ts` — 6 E2E tests, all passing against production URL

**Engineering review (2 passes):**
- Pass 1 (primary): 3 issues found and fixed (MIME allowlist, Realtime channel leak, revocation retry)
- Pass 2 (outside voice): 6 issues found and fixed (scope validation, email HTML injection, cross-subject forgery, frameIndex bounds, share-button portal URL exposure, Realtime channel on token refresh)
- 9 total issues, all resolved

### Known Gaps Left Open

| Gap | File | Notes |
|---|---|---|
| `styleReferenceUrls: []` | `app/lib/houseStyle.ts` | House style conditioning inactive until fal CDN style refs sourced |
| Members tab local-state only | `Settings.tsx` | Needs `workspace_members` Supabase table + invite email via Supabase Auth |
| Base64 dataUrls in JSONB | `store.ts` | ~9MB per fully profiled subject; migration helper exists but base64 fallback still primary |

### Next Recommended Actions
```
1. Source 3–5 editorial style images → upload to fal CDN → add to ACTIVE_HOUSE_STYLE.styleReferenceUrls
2. Second customer outreach (NOT Enhanced.com) — lead with talent consent story
3. YC application — use /root/.gstack/projects/pluribus/root-main-design-20260620-111513.md as the founder narrative doc
```

### Files Modified
- `app/App.tsx` — BYPASS_AUTH, clearStore, setWriteErrorHandler, 429 backoff, NSFW filter, SLA pill, TOKEN_REFRESHED skip
- `app/lib/store.ts` — Realtime to initStore, revokePortalToken retry, clearStore channel cleanup
- `app/components/SubjectPortal.tsx` — capture attr, progress bar, share button
- `app/components/CampaignWorkspace.tsx` — can() guards
- `app/components/Settings.tsx` — can() guards
- `app/components/Dashboard.tsx` — readiness scores
- `app/components/ErrorBoundary.tsx` — new file; Sentry capture
- `app/lib/promptEnhancer.ts` — sanitizePromptField
- `main.tsx` — Sentry init
- `/opt/pluribus-proxy/proxy.ts` — 5 subject routes, htmlEscape, VALID_CONSENT_SCOPES, athlete_id anchor, frameIndex bounds, MIME allowlist
- `/etc/nginx/sites-enabled/pluribus` — /api/subject/ block
- `playwright.config.ts` — new
- `e2e/consent.spec.ts` — new
- `e2e/approval.spec.ts` — new

---

## Handoff — 2026-05-17 (Sprints 19–20 + DB migration)

### Completed This Session

**Sprint 19 — Campaign Pack Generator:**
- `data/campaignPacks.ts` (new) — 4 pack types: Athlete Announcement (5 images / 20 cr), Hero Campaign (7 / 28 cr), Social Content (6 / 24 cr), Sponsor Clean (4 / 16 cr); `packTotalImages`, `packTotalCredits` helpers; `PACK_CREDITS_PER_IMAGE = 4`
- `Workspace.tsx` — "Pack" tab in right rail; pack card grid + slot breakdown table + credit estimate; `handlePackGenerate` loops slots × count, submits one `addJob` per image, deducts credits per job; progress display while submitting
- `GenerationJob` extended with `packId?: string` and `packName?: string`
- `QueuePage.tsx` — violet pack-name chip on job rows when `packId` is set

**Sprint 20 — Collaboration Model (Phases 1–3):**
- `app/lib/permissions.ts` (new) — 8 roles, 29 permissions, `can()` / `canAll()` / `canAny()` / `isInternalRole()` / `isSubjectRole()`
- `app/components/SubjectPortal.tsx` (new) — public portal at `/subject/<token>`; consent gate (scope checkboxes + agreement) guards review and upload tabs; approve/reject per output (reject requires free-text note); 9-frame reference upload with per-slot camera/file picker
- `App.tsx` — `/subject/<token>` IIFE route alongside existing `/review/<token>`
- `data/athletes.ts` — `UsageConsent`, `UsageScope`, `CollabTask` interfaces added (source of truth; store re-exports)
- `app/lib/store.ts` — `USAGE_SCOPE_LABELS`; store helpers for consent, collab tasks, and portal invites; `canExportOutput` now blocks on `subjectApprovalStatus === "rejected" | "pending"`; new `exportBlockReason()` returns human-readable string
- `app/components/AthleteLibrary.tsx` — "Collab" tab: portal invite link generator (generates token via `savePortalInvite`, copies to clipboard), consent status panel with scope chips, task checklist, likeness approval summary counts
- `app/components/AssetDetailPanel.tsx` — subject approval notices (amber pending / red rejected + note / emerald approved)
- `app/components/CampaignWorkspace.tsx` — export toast uses `exportBlockReason` for specific messaging
- `app/components/Settings.tsx` — "Members" tab with `MembersTab` component: invite form, role selector, member list with role-change + remove (local state stub — no backend yet)

**Database migration (applied 2026-05-17):**
- Phase 4–6 tables created in Supabase: `campaign_recipes`, `wardrobe_kits`, `moodboards`
- Was causing `PGRST205` upsert errors in production; now resolved

**Deployed:** `dist/` → `/var/www/pluribus/`, nginx reloaded

### Known Gaps Left Open (Intentional Phase 2/3 Stubs)

| Gap | File | Notes |
|---|---|---|
| Subject Portal proxy routes missing | `proxy.ts` | Frontend complete; need GET/POST routes + `subject_portal_tokens` table in Supabase |
| Members tab local-state only | `Settings.tsx` | Needs `workspace_members` Supabase table + invite email via Supabase Auth |
| `styleReferenceUrls: []` | `app/lib/houseStyle.ts` | House style conditioning inactive until style refs sourced and uploaded to fal CDN |

### Next Recommended Action
```
1. Wire Subject Portal proxy routes in proxy.ts (see P1 in tasks.md for full endpoint list)
2. Add nginx /api/subject/ location block
3. Create subject_portal_tokens table in Supabase (similar pattern to review_tokens)
4. Source 3–5 editorial style images and add to ACTIVE_HOUSE_STYLE.styleReferenceUrls
```

### Files Modified
- `data/campaignPacks.ts` — new
- `data/athletes.ts` — UsageConsent, UsageScope, CollabTask types; portal/consent fields on AthleteProfile
- `app/lib/permissions.ts` — new
- `app/lib/store.ts` — USAGE_SCOPE_LABELS, consent/task/portal helpers, canExportOutput + exportBlockReason updated, subjectApprovalStatus on CampaignOutput
- `app/components/SubjectPortal.tsx` — new
- `app/components/AthleteLibrary.tsx` — Collab tab, store imports
- `app/components/AssetDetailPanel.tsx` — subject approval notices
- `app/components/CampaignWorkspace.tsx` — exportBlockReason import + toast update
- `app/components/QueuePage.tsx` — pack chip on job rows
- `app/components/Settings.tsx` — Members tab + MembersTab component
- `app/App.tsx` — /subject/<token> route

---

## Handoff — 2026-05-14 (Sprint 14 — UX Overhaul + Nano Banana Pipeline)

### Completed This Session

**UX / Dashboard cleanup:**
- Removed greeting/stats header from Dashboard ("Good afternoon…" line)
- Removed Activity section from Dashboard
- Renamed "Add athlete" → "Add subject" throughout Dashboard
- `NewCampaignModal` rewritten as 4-step wizard: Details → Subjects → Recipe → Moodboard
  - Step indicator with checkmarks
  - Subject step: search box, selected chips, scrollable row list with checkboxes (handles 40+ subjects)
  - Recipe step: library tab + custom style tab
  - Moodboard step: image/PDF upload + link input with `/fetch/preview` OG extraction, 4-col preview grid
- Fixed campaigns not appearing after creation — `Projects.tsx` lazy-init bug; `addProject` called before navigation in `handleCampaignCreated`
- Bundle splitting — `manualChunks` (vendor-react, vendor-ui, vendor-radix, vendor-supabase, vendor-fal) + `React.lazy`/`Suspense` for 9 heavy page components; main chunk 1,035 kB → 416 kB
- Dynamic JSZip import in IdentityStudio (removed static import causing build conflict)

**v3 9-frame capture protocol:**
- `AngleKey` type updated to semantic keys: `front-passport`, `front-body`, `left-passport`, `left-body`, `right-passport`, `right-body`, `back-passport`, `back-body`, `face-close`; legacy keys preserved
- `AthleteLibrary.tsx` capture UI: face close-up solo slot, then 4 angle pairs (passport + body 2-col); `CAPTURE_FRAMES` array replaces old `FACE_ANGLES`/`BODY_ANGLES`; `captureReadiness()` updated

**Nano Banana pipeline:**
- `generate.ts` — NB exclusively; removed two-stage pipeline (NB → FLUX img2img), LoRA path, `IMAGE_MODELS`, `DEFAULT_IMAGE_MODEL`; single NB call; all refs uploaded concurrently
- `promptEnhancer.ts` — complete rewrite; `buildNanaBananaPrompt(recipe)` joins 7 scene fields into ≤60 words; `QUALITY_NEGATIVE = ""`; legacy `recipe.prompt` fallback
- `recipes.ts` — new NB `Recipe` interface (`shot`, `action`, `environment`, `lighting`, `mood`, `style`, `colorStyle`); 6 seed recipes rewritten; old text-prompt fields optional for compat
- `WorkflowLibrary.tsx` — form rebuilt (3 tabs: Basic / Scene / Checklist); Scene tab has 7 NB field inputs; recipe card chips updated
- `CampaignWorkspace.tsx` + `Workspace.tsx` — all generate call sites updated; removed `loraUrl`/`loraTriggerPhrase`/`negativePrompt`; `buildNanaBananaPrompt(wf)` replaces old `buildCampaignPrompt`
- `store.ts getCanonicalReferences` — simplified to priority-ordered list; no canonical combo logic

### Known Bugs (Not Yet Fixed)

| Bug | File | Severity |
|---|---|---|
| `wf.styleRules.length` throws TypeError for NB recipes | `CampaignSidebar.tsx:159,172,185` | **Blocker** |
| Direction panel empty for NB recipes — should show scene fields | `CampaignSidebar.tsx` | High |
| `recipe.cameraStyle` stale reference (renders nothing) | `Workspace.tsx:675` | Low |
| `doNotChange` constraints no longer injected into prompts | `promptEnhancer.ts` | Medium |

### Files Modified
- `data/athletes.ts` — AngleKey v3 protocol
- `data/recipes.ts` — NB Recipe interface + 6 seed recipes
- `app/lib/generate.ts` — NB exclusively
- `app/lib/promptEnhancer.ts` — complete rewrite for NB
- `app/lib/store.ts` — getCanonicalReferences simplified
- `app/components/AthleteLibrary.tsx` — v3 capture UI, CAPTURE_FRAMES
- `app/components/CampaignWorkspace.tsx` — NB call sites, removed loraUrl/negativePrompt
- `app/components/Workspace.tsx` — NB call sites, simplified IMAGE_TIERS
- `app/components/WorkflowLibrary.tsx` — Scene tab, NB recipe form
- `app/components/Dashboard.tsx` — removed greeting, stats, Activity section
- `app/components/NewCampaignModal.tsx` — 4-step wizard
- `app/components/Projects.tsx` — campaigns-after-creation fix
- `app/App.tsx` — React.lazy, addProject, handleCampaignCreated
- `vite.config.ts` — manualChunks bundle splitting

### Next Recommended Action
```
Fix CampaignSidebar.tsx crash first (wf.styleRules.length on NB recipes — blocker).
Then: update direction panel to display NB scene fields instead of old styleRules/lightingRules.
Then: commit and deploy.
Sprint 15 top candidates: resemblance score display, ComparePanel, style reference images.
```

---

## Handoff — 2026-05-14 (Identity Pipeline + House Style + Canonical Set)

### Completed This Session

**Identity pipeline overhaul:**
- Removed face-swap from LoRA path (was degrading quality 78% → 60%)
- LoRA training speedup: rank 8, no multiresolution, 200–400 steps, best 2 face captures only
- Two-stage identity pipeline: Nano Banana (identity lock) → FLUX dev img2img (editorial pass, strength 0.60)
- All generation paths (Workspace, CampaignWorkspace) now use `getCanonicalReferences()` with graceful fallback

**House Style v1 (`app/lib/houseStyle.ts` — new):**
- `HOUSE_STYLE_V1`: medium format film, Kodak Portra 400, single key from camera left, teal-orange split-tone, natural skin texture
- `ACTIVE_HOUSE_STYLE` exported constant — single source of truth for all generation paths
- `promptEnhancer.ts`: `QUALITY_TAIL` and `QUALITY_NEGATIVE` now derive from `ACTIVE_HOUSE_STYLE`
- `styleReferenceUrls: []` placeholder ready for style conditioning images

**Canonical reference set data model:**
- `canonicalSet.ts` (new): 10 combos × 8 test prompts, `CANONICAL_COMBOS`, `FRAME_TO_KEY`, `CANONICAL_SCORE_THRESHOLD`
- `data/athletes.ts`: AngleKey extended with frame-1 through frame-9; `AthleteProfile` extended with canonical set fields
- `store.ts`: `getCanonicalReferences()` replaces `getFaceDataUrls()` everywhere, `saveCanonicalSet()` helper

**9-frame standardised capture protocol (`app/components/AthleteLibrary.tsx`):**
- `CAPTURE_FRAMES` replaces `FACE_ANGLES`/`BODY_ANGLES` — 9 labelled frames with hints
- `captureReadiness()` scores against all 9 frames
- CaptureTab: 3-col grid for frames 1–6 (identity), 3-col grid for frames 7–9 (reference)
- LoRA training updated to use new frame keys first, legacy keys as fallback

**Canonical set validation UI (`AthleteLibrary.tsx` — identity tab):**
- Status badge (Not validated / Validating… / score% / Failed)
- `startCanonicalValidation()` calls proxy, patches profile to `validating`, starts 15s poller
- Auto-resumes polling on page load if `canonicalSetStatus === "validating"`
- Identity card grid shows up to 8 test output thumbnails when validated

**Proxy endpoints (`/opt/pluribus-proxy/proxy.ts`):**
- `POST /analyze/face-embedding-compare` — Claude Haiku placeholder for ArcFace; `{ score, confidence, faceDetected }`
- `POST /canonical/validate` — starts background validation (10 combos × 2 sampled prompts via Nano Banana + Claude Haiku scoring)
- `GET /canonical/status` — polls in-memory job map; returns score, variance, frameIds, identityCardUrls
- nginx `/canonical/` location block added

**Audit documentation:**
- `docs/identity-generation-audit.md` — 15-section comprehensive audit of the full identity pipeline

### Files Modified
- `app/lib/houseStyle.ts` — new
- `app/lib/canonicalSet.ts` — new
- `app/lib/promptEnhancer.ts` — QUALITY_TAIL/QUALITY_NEGATIVE from ACTIVE_HOUSE_STYLE, poseId support
- `app/lib/store.ts` — getCanonicalReferences, saveCanonicalSet
- `app/lib/generate.ts` — styleReferenceUrls param, face-swap removed from LoRA path
- `app/components/AthleteLibrary.tsx` — 9-frame capture protocol, canonical validation UI
- `app/components/Workspace.tsx` — getCanonicalReferences, ACTIVE_HOUSE_STYLE
- `app/components/CampaignWorkspace.tsx` — getCanonicalReferences, ACTIVE_HOUSE_STYLE
- `data/athletes.ts` — AngleKey frame-1–9, canonical profile fields
- `data/poses.ts` — new, 20 approved poses
- `/opt/pluribus-proxy/proxy.ts` — 3 new endpoints + canonical job store
- `/etc/nginx/sites-enabled/pluribus` — /canonical/ location block

### Known Issues / Next Steps
- `styleReferenceUrls` is `[]` until style reference images are sourced and uploaded to fal CDN
- Face-embedding-compare uses Claude Haiku (vision similarity) — replace with ArcFace for production accuracy
- Canonical validation runs 2 of 8 test prompts (cost reduction) — increase to all 8 for higher confidence
- Proxy canonical job store is in-memory — lost on restart (validation jobs are short, acceptable for now)

### Next Recommended Action
```
Complete any remaining athletes' capture protocol (all 9 frames),
then run canonical validation per athlete.
After validation, verify generation quality with house style v1.
Next sprint: surface poseId picker in Workspace and CampaignWorkspace generation forms.
```

---

## Handoff — 2026-05-07 (Post-Sprint 12 + Audit)

### Completed This Session
- Sprint 11: Phase 2 Supabase Postgres — full persistence layer live
- Sprint 12: External review links — shareable `/review/{token}` pages
- 3 security/correctness fixes: SSRF on mirror endpoint, ID collision (Date.now → UUID), review token race condition
- nginx `/storage/` rule added (was missing — asset mirroring silently failed since storage.ts was written)
- Full 01-audit.md protocol: 9-section audit produced, docs/current-state.md + docs/tasks.md + docs/handoff.md updated
- Build clean, deployed to https://pluribus.danielasiegbunam.com

### What Was Built

**Sprint 11 — Phase 2 Supabase Postgres (`app/lib/store.ts`, `App.tsx`, `pluribus-proxy/migrate.ts`):**
- store.ts rewritten with in-memory cache (`_cache`) populated synchronously from localStorage by `initStore()`; overwritten from Supabase by new async `hydrateStore(userId)` (6 parallel `Promise.allSettled()` queries)
- All mutations: update cache → localStorage → fire-and-forget Supabase upsert. All existing function signatures preserved.
- App.tsx: `getSession` callback made async; `hydrateStore` awaited before clearing `sessionLoading` — hydration covered by existing spinner
- Auto-migration: if Supabase tables are empty on first login, all localStorage data is pushed up (one-time, then Postgres wins)
- 6 Phase 2 tables live in Supabase: `subjects`, `subject_profiles`, `campaigns`, `recipes`, `campaign_outputs`, `campaign_runs`

**Sprint 12 — External review links:**
- `ReviewPage.tsx` (new, 268 lines) — public read-only gallery at `/review/{token}`; no auth; tab filter (All/Approved/Pending/Revision/Flagged); lightbox with keyboard nav; download on approved assets
- `CampaignSidebar.tsx` — "Share for review" button; creates token via `POST /api/review/create`; idempotent; shows copyable URL inline
- Proxy: `POST /review/create` (auth required) and `GET /review/:token` (public); service-role queries to `review_tokens` → `campaigns` → `campaign_outputs`
- `review_tokens` SQL table: `UNIQUE (campaign_id, user_id)` constraint; token = stripped UUID
- App.tsx: module-level `_reviewToken` IIFE routes to `ReviewPage` before auth check (hooks-order safe); `App` is thin shell over `AuthenticatedApp`
- nginx: `/storage/` and `/api/review/` location blocks added

**Security fixes (all in Sprint 12 commit):**
- SSRF: fal.ai CDN domain allowlist regex on `falUrl` in proxy `/storage/mirror`
- ID collision: `crypto.randomUUID().slice(0,8)` replaces `Date.now()` in CampaignWorkspace (5 occurrences) and Workspace
- Race condition: review token create uses insert-first; SELECT fallback on Postgres unique violation `23505`

### Audit Findings (Critical Gaps)

The 01-audit.md protocol was run. Most critical actionable gaps:

1. **Visual language tokens not injected** — `mood/cameraStyle/toneStyle` stored on `Recipe` but not passed to `buildCampaignPrompt` in `promptEnhancer.ts`. Zero creative effect. High trust gap — users set them and nothing changes.
2. **50-run cap** — `addRun` hard-caps at 50. With Supabase persistence this silently destroys history. Should be 500+.
3. **No rejection reason taxonomy** — "Reject" records no structured failure reason (CC§20: `FACE_DRIFT | AGE_DRIFT | SKIN_TONE | TATTOO_MISMATCH | WARDROBE | CONTEXT | QUALITY` not implemented).
4. **Signed URL expiry** — 1-year signed URLs; no refresh mechanism.
5. **No profile completeness signal** — users cannot tell how complete an identity profile is.

### Next Recommended Action

```
Read docs/prompts/02-plan-sprint.md and plan Sprint 13.
Top priority: visual language token injection into buildCampaignPrompt (highest trust gap, ~30 min fix).
Then: rejection reason taxonomy, 50-run cap raise, profile completeness %.
```

### Files Modified (Sprints 11–12 + fixes)
- `app/lib/store.ts` — full rewrite (in-memory cache, hydrateStore, Supabase write-through)
- `app/App.tsx` — hydrateStore, _reviewToken IIFE, AuthenticatedApp split
- `app/components/ReviewPage.tsx` — new file
- `app/components/CampaignSidebar.tsx` — share-for-review button + URL display
- `app/components/CampaignWorkspace.tsx` — Date.now → UUID (5 occurrences)
- `app/components/Workspace.tsx` — Date.now → UUID (1 occurrence)
- `pluribus-proxy/proxy.ts` — SSRF fix, /review/create, /review/:token
- `pluribus-proxy/migrate.ts` — Phase 2 + Phase 3 (review_tokens) SQL blocks
- `/etc/nginx/sites-available/pluribus` — /storage/ and /api/review/ location blocks

---

## Handoff — 2026-05-07 (Post-Sprint 10)

### Completed This Session
- Sprint 10: Campaign State Machine + Recipe Visual Language Tokens + Export Log
- Build clean, deployed

### What Was Built

**Campaign state machine (`data/projects.ts`, `CampaignWorkspace.tsx`, `store.ts`):**
- `CampaignStatus = "draft" | "in_review" | "approved" | "delivered"` replaces free-text `status?: string` on `Project`
- Seed project statuses migrated to valid values (`"In Progress"` → `"in_review"`, `"Complete"` → `"delivered"`, etc.)
- `<select>` dropdown in CampaignWorkspace header — shows current status with color-coded dot, persists immediately via `updateProject`

**Export log (`data/projects.ts`, `store.ts`, `CampaignWorkspace.tsx`):**
- `ExportLogEntry { exportedAt, exportedBy, assetCount }` added to `Project` (optional, backward compatible)
- `appendExportLog(id, entry)` store helper — prepends newest entry first
- `handleExport` now records an entry after every successful ZIP download
- Export log sidebar section shows newest 5 entries with asset count chip, reviewer email prefix, relative time

**Recipe visual language tokens (`data/recipes.ts`, `WorkflowLibrary.tsx`):**
- `mood?`, `cameraStyle?`, `toneStyle?` optional fields on `Recipe`
- "Visual Language" 4th tab in recipe editor modal — 3 structured `<select>` dropdowns from Creative Constitution §14 token sets (Mood: 6 options, Camera: 5 options, Tone: 6 options)
- `handleSave` converts empty string → `undefined` so unset tokens are cleanly absent
- `openEdit` and `openClone` both preserve all three fields
- Token chips rendered on recipe cards (accent-tinted, below tags row)

### Implementation Notes
- The `STATUS_COLOR` map in CampaignWorkspace was replaced entirely by `CAMPAIGN_STATUSES` array — single source of truth for value/label/dot color
- Visual language tokens store as readable strings (not slugs) — "Controlled Intensity" not "controlled_intensity" — so they display directly without transformation
- `emptyForm()` initializes `mood/cameraStyle/toneStyle` as `""` (not undefined) so the select inputs are controlled

### Next Recommended Action
```
Read docs/prompts/02-plan-sprint.md and plan Sprint 11.
Top candidates: batch multi-select gallery, recipe mood board images, rejection reason tags, profile completeness %.
```

### Files Modified (Sprint 10)
- `data/projects.ts` — CampaignStatus, ExportLogEntry, Project interface, seed status values
- `data/recipes.ts` — mood?, cameraStyle?, toneStyle? on Recipe interface
- `app/lib/store.ts` — export CampaignStatus + ExportLogEntry, appendExportLog helper
- `app/components/CampaignWorkspace.tsx` — status dropdown, export log sidebar, appendExportLog call
- `app/components/WorkflowLibrary.tsx` — Visual Language tab, token chips, openEdit/openClone/handleSave updated

---

## Handoff — 2026-05-07 (Post-Sprint 8 Audit + Bug Fix)

### Completed This Session
- Bug fix: `LibraryPage` now passes `onMarkRejectedLikeness` to `AssetDetailPanel` — the Reject button in the Library view is now functional
- Build clean, deployed

### Bug: LibraryPage onMarkRejectedLikeness not wired

**Root cause:** `LibraryPage` had `handleMarkLikeness` for approved likeness but no equivalent for rejected likeness. `onMarkRejectedLikeness` was never passed to `<AssetDetailPanel>`, so the ThumbsDown "Reject" button rendered (because `output.athleteId` was set) but calling it did nothing.

**Fix:** Added `handleMarkRejectedLikeness` handler in `LibraryPage.tsx` (mirrors `handleMarkLikeness`, calls `addRejectedLikeness` from store). Added `addRejectedLikeness` import. Passed `onMarkRejectedLikeness={handleMarkRejectedLikeness}` to `<AssetDetailPanel>`.

**Files changed:** `app/components/LibraryPage.tsx` only.

### Next Recommended Action
```
Read docs/prompts/02-plan-sprint.md and plan Sprint 9. Priority items: ComparePanel, multi-select + batch status actions, rejection reason tags, profile completeness %.
```

---

## Handoff — 2026-05-07 (Post-Sprint 8 Audit)

### Completed This Session
- Sprint 8 fully shipped: downloadUrl/downloadZip, per-asset download button, ZIP export, rejected likeness (data model + store + UI), review history timeline, Dashboard activity feed fix from getQueue → getCampaignOutputs
- Full product + technical re-audit (Post-Sprint 8)
- docs/current-state.md, docs/tasks.md, docs/handoff.md updated

### Audit Findings Summary

**Architecture unchanged:** React 18 SPA + Bun proxy + Supabase Auth only. All product data in localStorage. No cloud persistence.

**Sprint 8 closed 5 of the 5 Stage 1 audit gaps.** One bug introduced: `LibraryPage` does not pass `onMarkRejectedLikeness` to `AssetDetailPanel` — the Reject button is visible but non-functional in the Library view.

**New gaps identified:**
1. `LibraryPage` `onMarkRejectedLikeness` not wired — concrete bug, 1-line fix
2. No side-by-side comparison — still the single biggest reviewer UX gap
3. No batch multi-select / bulk status actions in the gallery
4. No rejection reason structured tags — "Reject" records no failure category
5. No profile completeness signal — users don't know how complete an identity profile is
6. Campaign state machine doesn't exist — status is cosmetic, never transitions
7. Recipe visual language tokens (Creative Constitution §14) not in the product
8. QueuePage/RenderQueue are legacy Studio features — create confusing dual-generation paradigm

**Top recommended Sprint 9 actions (in order):**
1. Fix LibraryPage onMarkRejectedLikeness (immediate bug)
2. ComparePanel — side-by-side asset comparison
3. Multi-select + batch status actions in gallery
4. Rejection reason dropdown on Reject path
5. Profile completeness % signal

**Monolith warning:** App.tsx (491), CampaignWorkspace.tsx (884), AthleteLibrary.tsx (928) — all three will cross 1000 lines within 2 sprints. Split before Sprint 11.

### Next Recommended Action

```
Read docs/prompts/02-plan-sprint.md and plan Sprint 9. Start with the LibraryPage bug fix, then ComparePanel + multi-select + rejection reason.
```

---

## Handoff — 2026-05-07 (Post-Audit) ← PREVIOUS

### Completed This Session
- Full product + technical audit against docs/prompts/01-audit.md
- 7 UI gap fixes (history tab, SPORTS ref, brand tab stub, dead button, edit attributes, delete subject, remove likeness)
- docs/tasks.md, docs/current-state.md, docs/handoff.md updated with audit findings

### Audit Summary

**Architecture:** React 18 SPA + Bun proxy + Supabase Auth only. All product data is localStorage. No cloud persistence for subjects, campaigns, outputs, or profiles.

**Critical risks identified:**
1. **No HTTPS** — credentials over plain HTTP; must fix before any real users
2. **fal.ai CDN URLs not downloaded** — approved assets can silently 404 when CDN expires
3. **localStorage-only** — clearing browser data destroys everything permanently; no backup
4. **Supabase schema not migrated** — auth flows may not work correctly

**Product capability:** Sprints 1–7 are fully built and working. The approval, identity, recipe, run lineage, and tagging systems are solid foundations. The UX is production-grade for a single user in a single browser.

**Biggest gap vs vision:** The product has no server-side memory. It cannot support teams, cannot recover from browser data loss, and cannot guarantee asset persistence. The vision ("system of record for synthetic identity media") requires Supabase persistence.

**Top recommended Sprint 8 choices (in priority order):**
1. Asset download / ZIP export — closes the CDN expiry risk immediately
2. Rejected likeness on identity profile — completes the identity memory model
3. Review history / audit trail — never lose reviewer attribution again
4. Dashboard activity feed fix — reads CampaignOutputs not Queue
5. Side-by-side comparison — biggest review UX gap

### Next Recommended Action

```
Read docs/prompts/02-plan-sprint.md and plan Sprint 8. Choose from the Stage 1 candidates in tasks.md. Do not code yet.
```

---

## Handoff — 2026-05-07 (Post-Sprint 7)

### Completed This Session
- Sprint 7: Creative Constitution UX ✓
- Post-review fixes ✓ (3 issues from review pass)

### Last Completed Work

**Sprint 7** — interactive quality checklist, per-campaign creative brief, recipe direction panel.

**`data/projects.ts`**:
- `brief?: string` added to `Project` interface (optional, backward compatible)

**`app/lib/store.ts`**:
- `updateProject(id, patch)` helper added — patches active projects list in localStorage

**`app/lib/promptEnhancer.ts`**:
- `brief?: string` added to `EnhanceOptions`
- `enhancePrompt` injects `"Campaign brief: …"` after identity constraints, before quality tail
- `buildCampaignPrompt` gains 4th param `brief?: string`

**`app/components/CampaignWorkspace.tsx`** additions:
- `brief` state — initialized from localStorage directly (`getProjects().find(...)`) to avoid stale prop
- `briefSavedTimerRef` — `useRef` for setTimeout cleanup on unmount
- `handleBriefBlur` — saves via `updateProject`, shows "saved" toast for 2 s, clears previous timer
- `directionOpen` state — recipe card is now a toggle button (collapsed by default)
- `checkedItems` state — `Set<number>`, new Set copy on each toggle (React immutability)
- Creative brief textarea in sidebar (280 char limit, auto-save on blur, char counter, "saved" indicator)
- Recipe card: click to expand/collapse; ChevronDown animates; shows style/lighting/composition/negative prompt bullet lists (each section gated on `.length > 0`)
- Quality checklist: `<button>` items toggle `checkedItems`, emerald checked state with Check icon + strikethrough, progress counter "N / M" in section header
- `runBatch` and `regenerateOutput` both pass `brief || undefined` as 4th arg to `buildCampaignPrompt`
- Sidebar section header + empty-state copy: "Athletes" → "Subjects" (Sprint 6 rename missed this)

### Post-Review Fixes Applied
1. **Medium** — Brief textarea was reading stale `project.brief` prop. Parent (`Projects.tsx`) holds `allProjects` in state initialized once from `getProjects()` and never re-read from localStorage. Fixed: `useState(() => getProjects().find(p => p.id === project.id)?.brief ?? project.brief ?? "")`.
2. **Low** — `setTimeout` in `handleBriefBlur` leaked on unmount. Fixed: timer stored in `briefSavedTimerRef`, cleared in cleanup `useEffect` and on each re-blur.
3. **Low** — Sidebar "Athletes" label and "No athletes assigned" empty-state copy not updated during Sprint 6 rename. Fixed: both changed to "Subjects".

### Current State

- Sprints 1–7 complete.
- No in-progress work.
- Build passes (Vite production build, 0 errors).

### Next Sprint: Sprint 8 — TBD

Candidates (user to choose):
- **Side-by-side asset comparison** — select 2–4 outputs and compare them in a split view
- **Export packs** — ZIP download with approved assets + metadata JSON
- **Contact sheet view** — printable/shareable grid layout for client review
- **Batch feedback / bulk status actions** — multi-select gallery cards, apply status to selection

### Next Recommended Action

```
Read docs/prompts/02-plan-sprint.md and plan Sprint 8. Do not code yet.
```

### Modified Files (Sprint 7)
- `data/projects.ts` — `brief?: string` added to Project interface
- `app/lib/store.ts` — `updateProject` helper added
- `app/lib/promptEnhancer.ts` — `brief` param in `EnhanceOptions` + `buildCampaignPrompt`
- `app/components/CampaignWorkspace.tsx` — creative brief, recipe direction panel, interactive checklist, Subjects rename, stale-prop fix, setTimeout cleanup

### Important Implementation Notes
- Brief injection is double-guarded: `brief || undefined` at the call site prevents empty-string from reaching `enhancePrompt`; `enhancePrompt` also guards with `if (brief && brief.trim())`.
- Checklist state is session-local and intentional — it resets on navigation. It is a review aid, not a persistent record.
- `updateProject` only patches active projects (not archived). This matches expected usage — archived campaigns should not receive new briefs.
- `briefSavedTimerRef` is always cleared before a new timer is set, so rapid blur events never stack multiple "saved" indicators.
- Recipe direction panel guards on `.length > 0` for each rules array — no empty section headers are rendered for recipes with partial content.

### Active Blockers (User Action Required)
- [ ] Run Supabase schema migration in SQL editor
- [ ] Create demo account: daniel@pluribus.ai / demo123 in Supabase Auth > Users
- [ ] Set Site URL: http://185.158.132.125 in Supabase Auth > URL Configuration

### Known Risks
- localStorage size limit active for base64 identity images (~2MB per athlete for full angle set)
- `buildCampaignPrompt` param named `doNotChange` but receives full constraints — minor rename (tech debt)
- Hover overlay 6 icons may clip on 2-column grid at narrow viewport widths

## Handoff — 2026-05-07 (Post-Sprint 6)

### Completed This Session
- Sprint 5: Asset Tagging + Cross-Campaign Search ✓
- Sprint 6: Organization Layer ✓
- Post-review fixes ✓ (5 issues from review pass)

### Last Completed Work

**Sprint 5 & 6** — asset tagging, global library, and organization layer.

**`app/lib/utils.ts`** (new):
- `relativeTime(iso)` — extracted from both AssetDetailPanel and CampaignWorkspace (duplication removed)

**`app/lib/store.ts`** additions:
- `tags?: string[]` added to `CampaignOutput` (optional, backward compatible)
- `addOutputTag(outputId, tag)` — idempotent add
- `removeOutputTag(outputId, tag)` — filter remove
- `addRun` now caps the stored list at 50 (oldest trimmed on overflow)

**`app/components/AssetDetailPanel.tsx`** additions:
- Imports `relativeTime` from `app/lib/utils` (local definition removed)
- `onTagAdded?` and `onTagRemoved?` optional props
- Tags section: chip list with remove buttons + inline tag input

**`app/components/CampaignWorkspace.tsx`** additions:
- Imports `relativeTime` from `app/lib/utils` (local definition removed)
- Imports `addOutputTag`/`removeOutputTag` from store
- `handleTagAdded`/`handleTagRemoved` — update store + optimistic state + detailOutput sync
- Passes `onTagAdded`/`onTagRemoved` to `AssetDetailPanel`

**`app/components/LibraryPage.tsx`** (new):
- Props: `reviewerEmail: string`
- Reads all outputs via `getCampaignOutputs()` (no campaignId filter)
- Filters: status tabs, subject dropdown, text search (matches subject name, campaign name, tags)
- Grid: thumbnail + subject/campaign/tags/time metadata
- Opens `AssetDetailPanel` with full review, comment, tag, likeness callbacks
- `onRegenerate` → toast "Open the campaign to regenerate" (no regen in library context)

**`app/App.tsx`** changes:
- ViewType: `athletes` → `subjects`, `library` added
- PAGE_TITLES: `subjects: "Subjects"`, `library: "Library"`
- Nav items: `subjects` (Users icon), `library` (Images icon) — 5 nav items total
- Routes: `subjects` → `<AthleteLibrary>`, `library` → `<LibraryPage>`
- `onAthleteClick` / command palette athlete action → navigate to `subjects`

**`data/athletes.ts`**:
- `sport: "Swimming" | "Track" | "Weightlifting"` → `sport: string`

**`app/components/AddAthleteModal.tsx`**:
- Removed `SPORTS` const, `EVENTS` map, `handleSportChange`
- Sport + Event now free-text inputs side by side

**`app/components/AthleteLibrary.tsx`**:
- Removed `SPORTS` const
- Sport filter: select dropdown → text input (partial match)
- Edit form sport field: select → text input
- Labels: "N athletes" → "N subjects", "Search athletes" → "Search subjects", "Add athlete" → "Add subject"

**`app/components/Dashboard.tsx`**:
- Removed `workflowTemplates` import (unused in code)

**`app/components/Projects.tsx`**:
- `getWorkflow()` now uses `getRecipes().find(r => r.id === p.workflowId)` — IDs match

**`app/components/Onboarding.tsx`**:
- Recipe grid uses `getRecipes()` — same field shape (id, name, description, thumbnail)

**`app/components/CommandPalette.tsx`**:
- ViewType updated to include `subjects`/`library`, remove `athletes`
- Nav item: `athletes` → `subjects`, label "Subjects"
- Library nav item added (Images icon)
- Item group: `"Athletes"` → `"Subjects"`

**`data/workflows.ts`**: deleted

### Current State

- Sprints 1–6 complete.
- No in-progress work.
- Build passes (Vite production build, 0 errors).

### Next Sprint: Sprint 7 — Creative Constitution UX

**Goal:** Bring quality guidance and creative direction into the review loop. Reviewers should see the recipe's standard while evaluating outputs. Art directors should be able to leave per-campaign creative briefs that influence generation.

Planned scope (acceptance criteria in `docs/tasks.md`):
- **S7-1** Quality checklist from recipe visible in `CampaignWorkspace` right sidebar (read-only)
- **S7-2** Per-campaign `brief?: string` field — text area, persists to localStorage, injected into prompt enhancement
- **S7-3** Recipe direction summary card in sidebar (style, lighting, composition, negative prompt)

Key file to understand before starting: `data/recipes.ts` — the `Recipe` interface already has `qualityChecklist?: string[]`, `lighting`, `composition`, `negativePrompt` fields. Sprint 7 is primarily a surfacing sprint, not a schema sprint.

### Next Recommended Action

```
Read docs/prompts/02-plan-sprint.md and plan Sprint 7: Creative Constitution UX. Do not code yet.
```

### Modified Files (Sprint 5 & 6)
- `app/lib/utils.ts` — new (relativeTime)
- `app/lib/store.ts` — tags field, addOutputTag, removeOutputTag, addRun cap
- `app/components/AssetDetailPanel.tsx` — tags UI, relativeTime import
- `app/components/CampaignWorkspace.tsx` — tag handlers, relativeTime import
- `app/components/LibraryPage.tsx` — new (global asset library)
- `app/App.tsx` — ViewType, nav, routes
- `data/athletes.ts` — sport: string
- `app/components/AddAthleteModal.tsx` — free-text sport + event
- `app/components/AthleteLibrary.tsx` — sport text filter, Subjects labels
- `app/components/Dashboard.tsx` — removed workflowTemplates import
- `app/components/Projects.tsx` — getRecipes() replaces workflowTemplates
- `app/components/Onboarding.tsx` — getRecipes() replaces workflowTemplates
- `app/components/CommandPalette.tsx` — Subjects rename, Library nav
- `data/workflows.ts` — deleted

### Post-Review Fixes Applied
1. `LibraryPage` — `projectMap` now includes `getArchivedProjects()` so archived campaign names resolve correctly.
2. `LibraryPage` — `getAthletes()`/`getProjects()` moved into `useState` initializers (one read on mount, not every render).
3. `AddAthleteModal` — toast ("Subject added"), modal title, and submit button updated from "athlete" → "subject".
4. `AthleteLibrary` — inline add panel heading updated from "Add athlete" → "Add subject".
5. `AthleteLibrary` — "Sport \*" asterisk removed from edit form (sport is optional, not enforced in submit condition).

### Important Implementation Notes
- `tags` is optional on `CampaignOutput` — old data without tags renders an empty chip list.
- `addOutputTag` is idempotent — calling it twice with the same tag has no effect. Tags are stored lowercase/trimmed.
- `LibraryPage` reads from localStorage on mount. It does not subscribe to store changes — navigating away and back refreshes the list. This is intentional given the single-user localStorage model.
- `onRegenerate` in LibraryPage shows a toast and closes the panel. Actual regen requires opening the campaign workspace.
- The sport field widening in `data/athletes.ts` is backward compatible — existing string values remain valid.
- Recipe IDs (`wf-noir-studio` etc.) match the old workflow IDs, so existing `Project.workflowId` values resolve correctly against `getRecipes()`.
- `CommandPalette` has its own local `ViewType` definition — must be kept in sync with `App.tsx` manually when new views are added.

### Active Blockers (User Action Required)
- [ ] Run Supabase schema migration in SQL editor
- [ ] Create demo account: daniel@pluribus.ai / demo123 in Supabase Auth > Users
- [ ] Set Site URL: http://185.158.132.125 in Supabase Auth > URL Configuration

### Known Risks
- localStorage size limit active for base64 identity images (~2MB per athlete for full angle set)
- `buildCampaignPrompt` param named `doNotChange` but receives full constraints — minor rename
- Hover overlay 6 icons may clip on 2-column grid at narrow viewport widths

## Handoff — 2026-05-07 (Post-Sprint 4)

### Completed This Session
- Sprint 1: Identity Profiles ✓
- Sprint 2: Creative Recipes ✓
- Sprint 3: Generation Run Records ✓
- Sprint 3 fixes ✓
- Sprint 4: Approval System Expansion ✓
- Sprint 4 fixes ✓

### Last Completed Work

**Sprint 4: Approval System Expansion** — full review workflow replacing the binary approve/reject model.

**`app/lib/store.ts`** additions:
- `OutputStatus` type: `"pending" | "approved" | "needs_revision" | "rejected" | "flagged"`
- `OutputComment` interface: `{ id, text, author, createdAt }`
- `CampaignOutput` extended with `comments?: OutputComment[]`, `reviewedBy?: string`, `reviewedAt?: string` — all optional, backward compatible with pre-Sprint-4 data
- `setOutputStatus(id, status, reviewedBy)` — updates status + reviewer + timestamp atomically
- `addOutputComment(outputId, comment)` — appends to comments array

**`app/components/AssetDetailPanel.tsx`** (new file — extracted from CampaignWorkspace):
- 5-button status selector row (Pending / Approve / Revision / Flag / Reject) with per-state colors
- Comment thread: author initial avatar, truncated email, relative timestamp, comment text
- Comment input + Post button (Enter to submit), disabled when empty
- Reviewer attribution line in header: "by user · time", shown only when `reviewedBy` is set
- Graceful "No comments yet" empty state
- "No run record" info message for pre-Sprint-3 outputs preserved

**`app/components/CampaignWorkspace.tsx`** changes:
- `reviewerEmail` loaded from `supabase.auth.getSession()` on mount
- `changeStatus(id, status)` replaces `approveOutput`/`rejectOutput` — updates store + both state slices
- `handleCommentAdded(outputId, comment)` updates store + both state slices optimistically
- 6 filter tabs: All | Approved | Pending | Revision | Flagged | Rejected (horizontally scrollable)
- Gallery card ring colors: blue (`needs_revision`), amber (`flagged`), green (approved), faded (rejected)
- Gallery card badges: PenLine (blue) for needs_revision, Flag (amber) for flagged
- Comment count badge on card thumbnails
- Hover overlay: 6 buttons — Approve, Revision, Flag, Reject, Regen, Bookmark
- Stats sidebar updated: Generated / Approved / Revision / Flagged
- Share button removed from campaign header
- `regenerateOutput` now sets `batchRunning` — concurrency gap closed
- `updateCampaignOutput` call restored in `regenerateOutput` — URL persists on refresh (post-review fix)

### Current State

- Sprints 1–4 complete, reviewed, and committed.
- No in-progress work.
- Codebase is clean and ready for Sprint 5.

### Next Sprint: Sprint 5 — Asset Tagging + Cross-Campaign Search

**Goal:** Make assets findable across campaigns. Every output should be retrievable by subject, recipe, tag, approval state, or campaign.

Likely scope:
- Tag field on `CampaignOutput` (free-form string array, user-editable in asset detail panel)
- Tag input in `AssetDetailPanel`
- Global asset search / browse view (new page: "Assets" or "Library")
- Filter by: athlete, campaign, recipe, status, tag
- Asset count badge on campaign cards

Alternative: defer full search to Sprint 6 and instead do **Organization Layer** (Sprint 6) next — first-class Subjects replacing the athlete primitive, cleaner nav hierarchy. This depends on whether the user wants "find my assets" or "restructure the data model" first.

### Next Recommended Action

```
Read docs/prompts/02-plan-sprint.md and plan Sprint 5: Asset Tagging + Cross-Campaign Search. Do not code yet.
```

### Modified Files (Sprint 4)
- `app/lib/store.ts` — OutputStatus, OutputComment, CampaignOutput extensions, setOutputStatus, addOutputComment
- `app/components/AssetDetailPanel.tsx` — new file (extracted + enhanced detail panel)
- `app/components/CampaignWorkspace.tsx` — review workflow, 6 tabs, card badges, session load, concurrency fix, URL persistence fix

### Important Implementation Notes
- `OutputStatus` widening is backward compatible — old data with `"pending"/"approved"/"rejected"` strings satisfies the new type.
- `reviewerEmail` falls back to `"unknown"` if Supabase session hasn't resolved when a comment is posted. This is a race window of < 1s on mount — acceptable.
- Comments are stored oldest-first in the `comments[]` array. The thread renders in insertion order (no sort needed).
- `setOutputStatus` and `updateCampaignOutput` both write to the same `outputs` localStorage key. They are not atomic — rapid concurrent calls could theoretically interleave. Not a real risk in single-user localStorage context.
- `AssetDetailPanel` owns only local `commentText` state. All other state lives in `CampaignWorkspace` and flows down as props + callbacks.
- `relativeTime()` is duplicated in `AssetDetailPanel` and `CampaignWorkspace`. Extract to `app/lib/utils.ts` in Sprint 5 or Sprint 6 cleanup.

### Active Blockers (User Action Required)
- [ ] Run Supabase schema migration in SQL editor
- [ ] Create demo account: daniel@pluribus.ai / demo123 in Supabase Auth > Users
- [ ] Set Site URL: http://185.158.132.125 in Supabase Auth > URL Configuration

### Known Risks
- Run records accumulate with no cleanup cap — consider 50-run limit in Sprint 5
- localStorage size limit active for base64 identity images (~2MB per athlete for full angle set)
- `relativeTime()` duplicated in two components — minor, clean up in Sprint 6
- `data/workflows.ts` superseded but not deleted — Sprint 6 cleanup
- `buildCampaignPrompt` param named `doNotChange` but receives full constraints — minor rename
- Sport enum hard-coded in Athlete: `"Swimming" | "Track" | "Weightlifting"` — Sprint 6
- Hover overlay 6 icons may clip on 2-column grid at narrow viewport widths — Sprint 5 UX pass
