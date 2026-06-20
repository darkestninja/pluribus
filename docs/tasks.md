# Tasks

## Immediate (P0 — Blocking)

- [x] Fix CampaignSidebar.tsx crash — resolved (NB scene fields now shown instead of styleRules)
- [x] Run Supabase schema migration in SQL editor — Phase 1–6 all applied (Phase 4–6 applied 2026-05-17)
- [x] Run Storage RLS policies in SQL editor — done
- [x] Create demo account: daniel@pluribus.ai — done
- [x] Set Site URL in Supabase Auth > URL Configuration — done

## Immediate (P1 — High Priority)

- [x] **Wire Subject Portal proxy routes** — done in Sprint 13b; all 5 routes live in `proxy.ts` + nginx `/api/subject/` block added; token resolved via `subject_profiles.portal_token` (no separate table needed)
- [ ] **Source style reference images** — upload 3–5 editorial style images to fal CDN; add URLs to `ACTIVE_HOUSE_STYLE.styleReferenceUrls` in `app/lib/houseStyle.ts` to activate house style conditioning

---

## Done (Sprint 13 — Production Hardening + Consent Moat — 2026-06-20)

### 13a — Ship-Blockers
1. **`VITE_BYPASS_AUTH`** — auth bypass now env-var gated (`import.meta.env.VITE_BYPASS_AUTH === "true"`); not active in production
2. **`clearStore()`** — called on SIGNED_OUT in `onAuthStateChange`; wipes in-memory cache on logout
3. **`setWriteErrorHandler`** — registered in App.tsx; critical DB write failures show "Saved locally" toast
4. **429 backoff** — `rateRetryAfter` on `GenerationJob`; 30s skip on 429; clears automatically
5. **NSFW filter** — outputs with `nsfw: true` stripped before display
6. **SLA progress pill** — header shows `42% · ~20s` or `2/4 ready` during generation
7. **TOKEN_REFRESHED skip** — `onAuthStateChange` no longer calls `initStore` on token refresh; prevents unnecessary Realtime channel teardown

### 13b — Consent Moat
8. **5 Subject Portal proxy routes** — GET portal data, POST consent, POST references, POST approve, POST reject; all in `proxy.ts`
9. **`resolvePortalToken()`** — resolves `subject_profiles.portal_token` via service-role; no talent auth required
10. **Consent scope allowlist** — `VALID_CONSENT_SCOPES` set; unknown scopes → 400
11. **`htmlEscape()`** — applied to all user content before email HTML interpolation (prevents stored XSS via Resend)
12. **`athlete_id` anchor** — approve/reject queries now constrain on both `user_id` and `athlete_id`; prevents cross-subject forgery
13. **Reference upload hardened** — MIME allowlist, 20MB cap, `frameIndex` bounded to [0,8]
14. **`sanitizePromptField()`** — strips injection phrases and control chars from talent-sourced text before prompt assembly
15. **`revokePortalToken` retry** — 3-retry (0/2/4s); restores in-memory token + fires write-error toast on total failure
16. **Realtime subscription to `initStore`** — channel tracked in `_realtimeChannel`; removed on `clearStore`; no leak on re-auth
17. **`can()` guards** — `outputs:approve` + `outputs:export` in CampaignWorkspace; `members:manage` in Settings
18. **SubjectPortal polish** — `capture="user"` removed; 3-step progress bar; "Share approved" copies receipt text not portal URL
19. **Campaign readiness scores** — inline enrollment + approval progress bars on Dashboard campaign cards
20. **nginx `/api/subject/` block** — `client_max_body_size 20m`, `proxy_read_timeout 60s`

### 13c — Observability + Polish
21. **Sentry** — `Sentry.init()` gated on `VITE_SENTRY_DSN`; `captureException` in ErrorBoundary
22. **Playwright E2E** — 6 tests; all passing against production URL

---

## Done (Sprint 20 — Collaboration Model)

1. **`app/lib/permissions.ts`** — 8-role model (admin/editor/viewer/reviewer/subject/subject_manager/legal/guest); 29 permissions; `can()` / `canAll()` / `canAny()` / `getPermissions()` API
2. **`SubjectPortal.tsx`** at `/subject/<token>` — consent gate (scope selector + agreement) → likeness approve/reject → 9-frame reference upload; no auth required
3. **`CampaignOutput`** extended — `subjectApprovalStatus`, `subjectApprovalBy`, `subjectApprovalAt`, `subjectRejectionNote`
4. **`canExportOutput`** + **`exportBlockReason`** — blocks on rejected/pending subject approval before score gate
5. **`AssetDetailPanel`** — approval status notices (amber pending / red rejected / emerald approved)
6. **`CampaignWorkspace`** export — toasts now surface specific block reason text
7. **`AthleteLibrary`** "Collab" tab — portal invite link, consent status, task checklist, likeness approval summary
8. **`data/athletes.ts`** — `UsageConsent`, `UsageScope`, `CollabTask` types; portal + consent fields on `AthleteProfile`
9. **Store helpers** — `saveUsageConsent`, `getCollabTasks`, `addCollabTask`, `updateCollabTask`, `savePortalInvite`, `getPortalToken`, `defaultCollabTasksForSubject`, `USAGE_SCOPE_LABELS`
10. **Settings "Members" tab** — invite form with role selector, member list with role-change + remove (UI stub; backend pending)

## Done (Sprint 19 — Campaign Pack Generator)

1. **`data/campaignPacks.ts`** — 4 pack types with slot definitions, credit calculations
2. **Workspace.tsx pack UI** — pack tab in right rail: card grid, slot breakdown, credit estimate, generate CTA
3. **`handlePackGenerate`** — one job per image slot, credits deducted per job, `packId`/`packName` on each job
4. **`QueuePage`** — violet pack-name chip on jobs with a `packId`

## Done (Sprint 18 — Identity Scoring Tiers + Durable Scoring)

1. **`identityMatchTier.ts`** — 5-tier system (Hero ≥92 / Campaign ≥88 / Internal ≥80 / Exploration ≥70 / Weak <70)
2. **Durable scoring** — `identityScoringStatus` + retry with exponential backoff; state survives page refresh
3. **Auto-flag / auto-tag** per tier; `canExportOutput` gates on score ≥88
4. **Tier badges** in AssetDetailPanel, CampaignGallery, ComparePanel, ReviewPage, Workspace

## Done (Sprint 17 — Infrastructure)

1. **Structured proxy logging** — `log(level, route, data)` helper; all `/fal/*`, `/storage/mirror`, `/canonical/validate` routes log JSON with `reqId`, `userId`, `model`, `durationMs`, `falStatus`
2. **Server-side credit enforcement** — proxy reads `users.credits` before forwarding NB generation; deducts 4 credits atomically; returns 402 on zero balance. `refreshCredits()` in store.ts re-syncs after generation. `hydrateStore` reads `credits` column.
3. **Hash-based URL routing** — `VIEW_HASH`/`HASH_VIEW` maps; `useEffect` writes hash on view change; `hashchange` listener handles back/forward; initial view restored from hash on load. Studio encodes `?c=campaignId` in hash.
4. **`Project.workflowId` → `recipeId` rename** — all 33 references updated across `data/projects.ts`, `app/`, and `components/`

---

## Done (Sprint 18 — Architecture)

1. **Studio/Campaign unification** — Workspace reads `workspaceId` prop; `campaignContext` seeds `targetCampaignId`; header shows "← Back to [Campaign Name]"; `onBack` returns to `projects` view if opened from a campaign.
2. **Workspace.tsx refactor** — deferred (JSX split requires UI testing with dev server); `buildPrompt` already isolated as `useCallback`.
3. **Canonical validation cleanup** — removed `CANONICAL_COMBOS` (10 combo × frame-1-9 logic); now uses `V3_REF_PRIORITY` order; runs 3 quality test prompts against all available refs; requires ≥3 captures (was exactly 9 frame-N); reports `houseStyleVersion: "v3"`.

---

## Done (Sprint 16 — Data Integrity)

1. **Recipe snapshot on Run records** — `Run.recipeSnapshot` field; all `addRun` call sites pass full recipe JSON
2. **Supabase write-through retry** — `_upsert` retries 3× with 1s/2s/4s exponential backoff on 5xx/network errors
3. **Base64 → Supabase Storage migration** — `_migrateBase64References(userId)` runs non-blocking on login; uploads base64 capture angles to Storage, updates profile with signed URLs

---

## Done (Sprint 15 — Review UX)

1. **ComparePanel** — side-by-side asset comparison (2-4 assets); toggle from campaign gallery
2. **Keyboard navigation** — Arrow keys navigate gallery; J=approve, K=reject, Esc closes detail panel
3. **Signed URL refresh** — `useRefreshableUrl` hook auto-refreshes expired signed URLs on `img` load error; persists new URL to store

---

## Done (Sprint 14 — UX Overhaul + Nano Banana Pipeline)

### UX / Dashboard
1. **Dashboard cleanup** — removed greeting/stats header, removed Activity section, renamed "Add athlete" → "Add subject"
2. **Campaign creation wizard** — `NewCampaignModal` rewritten as 4-step flow (Details → Subjects → Recipe → Moodboard); step indicator with checkmarks
3. **Subject search in campaign creation** — search box + scrollable row list with checkboxes; handles 40+ subjects
4. **Moodboard in campaign creation** — image/PDF upload + link input with `/fetch/preview` OG extraction; 4-col preview grid
5. **Campaigns not appearing after creation** — fixed `Projects.tsx` lazy-init bug; `handleCampaignCreated` now calls `addProject` before navigating
6. **Bundle splitting** — Vite `manualChunks` for vendor chunks; `React.lazy` + `Suspense` for 9 heavy page components; main chunk 1,035 kB → 416 kB

### Identity Capture
7. **v3 9-frame capture protocol** — `AngleKey` updated to semantic keys (`front-passport`, `front-body`, `left-passport`, `left-body`, `right-passport`, `right-body`, `back-passport`, `back-body`, `face-close`); legacy frame keys kept for backward compat
8. **AthleteLibrary capture UI** — `CAPTURE_FRAMES` array replaces old `FACE_ANGLES`/`BODY_ANGLES`; face close-up solo slot, then 4 angle pairs (passport + body 2-col); `captureReadiness()` updated for v3 frames

### Nano Banana Pipeline
9. **generate.ts — NB exclusively** — removed two-stage pipeline (NB → FLUX img2img), LoRA path, standard FLUX path, `IMAGE_MODELS` registry, `DEFAULT_IMAGE_MODEL`; single NB call; refs uploaded concurrently; `reference_image_url` (primary) + `reference_image_urls` (all) passed
10. **promptEnhancer.ts rewrite** — `buildNanaBananaPrompt(recipe)` joins 7 scene fields into ≤60-word prompt; `QUALITY_NEGATIVE = ""`; legacy `recipe.prompt` fallback preserved; `buildCampaignPrompt` is alias for NB compat
11. **recipes.ts — NB schema** — new `Recipe` interface with `shot`, `action`, `environment`, `lighting`, `mood`, `style`, `colorStyle`; 6 seed recipes rewritten as structured scene descriptions; `prompt`/`negativePrompt`/`styleRules`/`lightingRules`/`compositionRules` kept optional for backward compat
12. **WorkflowLibrary.tsx — recipe form rebuild** — 3 tabs: Basic / Scene / Checklist; Scene tab has 7 NB field inputs; removed old Creative Direction + Visual Language tabs; recipe card chips updated to show `shot`/`mood`/`colorStyle`
13. **CampaignWorkspace.tsx + Workspace.tsx call sites** — all generate paths updated; removed `loraUrl`, `loraTriggerPhrase`, `negativePrompt` from generateImage calls; `referenceImageDataUrls` always passed unconditionally; `buildNanaBananaPrompt(wf)` replaces old `buildCampaignPrompt(basePrompt, athlete, ...)`
14. **store.ts getCanonicalReferences** — simplified to return all captures in NB priority order (face-close first, then passport frames, then body frames, then legacy keys); no canonical combo selection logic

---

## Done (Sprint 13 — Visual Language Injection + Rejection Taxonomy + Profile Completeness)

1. Visual language token injection (`mood`, `cameraStyle`, `toneStyle` from Recipe — since superseded by NB scene fields in Sprint 14)
2. Rejection reason taxonomy (CC§20): FACE_DRIFT | AGE_DRIFT | SKIN_TONE | TATTOO_MISMATCH | WARDROBE | CONTEXT | QUALITY
3. 50-run cap raised to 500
4. Profile completeness % — `getProfileCompleteness()` helper; progress bar on subject cards + campaign sidebar

---

## Done (Sprint 12 — External Review Links)

1. ReviewPage at /review/{token} — public read-only gallery, no auth
2. "Share for review" button in CampaignSidebar — creates token, shows copyable URL
3. Proxy /review/create and /review/:token endpoints
4. review_tokens SQL table
5. nginx /storage/ and /api/review/ rules
6. SSRF fix, ID collision fix (crypto.randomUUID), review token race condition fix

---

## Done (Sprint 11 — Phase 2 Supabase Postgres)

1. Phase 2 SQL tables — subjects, subject_profiles, campaigns, recipes, campaign_outputs, campaign_runs
2. store.ts rewrite — in-memory cache + hydrateStore() + fire-and-forget Supabase write-through
3. App.tsx — hydrateStore awaited before session loads
4. Auto-migration — first login pushes localStorage data to Supabase

---

## Sprint 15 Candidates

Priority ordered:

1. **Fix CampaignSidebar crash** ← P0, must do first
   - Guard `styleRules?.length ?? 0 > 0` or replace direction panel with NB scene fields display
   - Show `shot`, `environment`, `lighting`, `mood`, `style`, `colorStyle` in the panel instead

2. **Resemblance score display** — score computed and stored (`resemblanceScore` on CampaignOutput) but not shown anywhere in review UI; surface in asset card badge and detail panel

3. **ComparePanel** — side-by-side 2–4 asset comparison; biggest remaining reviewer UX gap

4. **Keyboard navigation in gallery** — arrow keys, J/K to approve/reject, Esc to close detail panel

5. **Style reference images** — source 3–5 editorial style images, upload to fal CDN, add to `ACTIVE_HOUSE_STYLE.styleReferenceUrls`; activates house style conditioning in all NB generation

6. **`doNotChange` constraints in NB prompts** — reinstate injection of subject-level constraints as brief appended scene notes (e.g., "visible tattoo sleeve, prosthetic left arm"); NB can use these as scene direction even if identity comes from refs

---

## Backlog (Phase 2+)

- `Project.workflowId` rename to `recipeId` throughout
- Signed URL refresh mechanism (1-year expiry; no refresh; assets break at year 1)
- Supabase write-through retry queue (fire-and-forget failures silently lost)
- Recipe snapshot on Run records (recipe edits break lineage)
- Structured proxy logging (console.warn only; blind to production errors)
- Supabase Storage for reference images (remove base64-in-JSONB; ~9MB/subject)
- URL routing — back button broken; shareable deep links not possible
- Studio/Campaign generation paradigm unification
- Server-side credit enforcement
- Workspace.tsx refactor (split into feature modules; ~1,200 lines)
- "What worked" signal per recipe (approval rate, avg resemblance score)
- Version history on recipes and subjects
- AI-assisted failure tagging
- Identity confidence scoring (ML-based, not histogram)
- Export presets (named output formats: Instagram story, press image, etc.)
- Campaign boards / contact sheet view
- Smart model routing
- Recipe performance analytics

## Deferred

- Stripe billing
- Analytics (Mixpanel/Sentry)
- Mobile app
- Custom LoRA training pipeline (removed from NB path; may return as supplemental)
- Video generation improvements
- Public API
- Full enterprise RBAC
