# Tasks

## Immediate (P0 — User Action Required)

- [x] Add HTTPS — certbot/Let's Encrypt — **done**, site is at https://pluribus.danielasiegbunam.com
- [ ] Run Supabase schema migration in SQL editor — paste SQL from `cd /opt/pluribus-proxy && bun run migrate.ts`
- [ ] Run Storage RLS policies in SQL editor — printed by `bun run setup.ts` (run from proxy dir)
- [x] Create demo account: daniel@pluribus.ai — already exists in Supabase Auth
- [x] Set Site URL in Supabase Auth > URL Configuration — done (https://pluribus.danielasiegbunam.com)

## Current Sprint — Sprint 13 (TBD)

Candidates from backlog (choose next):
- Keyboard navigation in gallery (arrow keys, J/K approve/reject)
- Recipe mood board: 1-3 reference image uploads per recipe
- Batch multi-select + bulk status actions in CampaignWorkspace gallery
- Rejection reason structured tags on rejected outputs
- Profile completeness % signal on athlete card

## Done (Sprint 12 — External review links)

1. **ReviewPage** (`app/components/ReviewPage.tsx`) — public read-only gallery at `/review/{token}`; no login required; tab bar (All / Approved / Pending / Revision / Flagged); status badges; lightbox with ←→ Esc keyboard nav; per-image download on approved assets; clean error state for invalid/expired tokens
2. **"Share for review" button** in `CampaignSidebar` — creates a token via `POST /api/review/create` (idempotent, same link on repeat clicks); shows copyable URL inline with 2s copy confirmation
3. **Proxy endpoints** — `POST /review/create` (auth required) and `GET /review/:token` (public); both route through nginx `/api/review/`
4. **`review_tokens` SQL table** — `(user_id, campaign_id)` unique constraint; service-role RLS for proxy reads; added to `migrate.ts` Phase 3 block
5. **nginx** — added `/storage/` proxy rule (was missing — asset mirroring was silently failing) and `/api/review/` rule
6. **App.tsx** — module-level `_reviewToken` IIFE routes before auth; `App` is now a thin shell routing to `ReviewPage` or `AuthenticatedApp`

## Done (Sprint 11 — Phase 2 Supabase Postgres)

1. **Phase 2 SQL tables** — `subjects`, `subject_profiles`, `campaigns`, `recipes`, `campaign_outputs`, `campaign_runs` added to `migrate.ts`; composite `(user_id, id)` PKs, RLS policies, indexes; all 6 tables confirmed live in Supabase
2. **store.ts rewrite** — in-memory cache backed by Supabase; `initStore()` populates cache from localStorage synchronously; new `hydrateStore(userId)` async function hydrates from Supabase on login (6 parallel queries); all mutations write cache → localStorage → fire-and-forget Supabase upsert; all existing function signatures unchanged
3. **App.tsx** — `hydrateStore` awaited inside `getSession` callback before clearing `sessionLoading`; existing loading spinner covers hydration
4. **Auto-migration** — first login after Phase 2 pushes all localStorage data to Supabase automatically (one-time); subsequent sessions load from Postgres

## Done (Sprint 10)

**Stage 1 — Immediate bugs + review UX gaps:**
1. `LibraryPage.tsx`: wire `onMarkRejectedLikeness` (prop accepted by AssetDetailPanel but not passed in Library)
2. `ComparePanel.tsx` (new): side-by-side comparison for 2–4 selected assets
3. Multi-select in `CampaignWorkspace` gallery + batch status action bar (approve/reject/flag all selected)
4. Rejection reason dropdown on Reject path in `AssetDetailPanel` (structured tags from Creative Constitution §20)
5. Profile completeness % in `AthleteLibrary` athlete card + campaign sidebar subject panel

**Stage 2 — Campaign workflow + art direction:**
6. Campaign state machine: status dropdown in workspace header (Draft / In Review / Approved / Delivered); auto-set to "In Review" on first generation
7. Recipe visual language profile: mood/lighting/camera dropdowns (Creative Constitution §14 tokens)
8. Export log per campaign: record what was ZIP-exported and when

## Backlog (Phase 2+)

- Keyboard navigation in gallery (arrow keys, J/K approve/reject)
- Recipe mood board: 1-3 reference image uploads per recipe
- "What worked" signal per recipe (approval rate, avg resemblance score)
- ~~External review links (shareable stakeholder token, no login required)~~ ✓ done (Sprint 12)
- ~~Supabase persistence (migrate CampaignOutput, Run, Athlete, AthleteProfile from localStorage)~~ ✓ done (Sprint 11)
- Supabase Storage for reference images (remove base64-in-localStorage) + auto-download approved assets
- Version history on recipes and subjects
- AI-assisted failure tagging
- Identity confidence scoring (ML-based, not histogram)
- Export presets (named output formats: Instagram story, press image, etc.)
- Campaign boards / contact sheet view
- Smart model routing
- Recipe performance analytics
- App.tsx / CampaignWorkspace.tsx / AthleteLibrary.tsx refactor (split into feature modules)

## Deferred

- HTTPS certificate ← **moved to P0 — user action required**
- Stripe billing
- Analytics (Mixpanel/Sentry)
- Mobile app
- Custom LoRA training pipeline
- Video generation improvements
- Public API
- Full enterprise RBAC

## Done

- [x] Sprint 0: Full product + technical audit
- [x] Sprint 1: Identity Profiles — AthleteProfile schema, capture angles, tattoos, do-not-change constraints, approved likeness
- [x] Sprint 2: Creative Recipes — recipe schema + 6 seeds, library CRUD, negative prompt injection, quality checklist
- [x] Sprint 3: Generation Run Records — Run interface, onSeed callback, run history sidebar, asset detail panel, seed replay
- [x] Sprint 4: Approval System Expansion — 5-state OutputStatus, comments, AssetDetailPanel extraction, 6 filter tabs, card badges, reviewer attribution
- [x] Sprint 5: Asset Tagging + Cross-Campaign Search — tags on CampaignOutput, tag chip UI, LibraryPage, relativeTime to utils, addRun capped at 50
- [x] Sprint 6: Organization Layer — sport: string, free-text sport/event, Subjects rename, getRecipes() replaces workflowTemplates, Library nav
- [x] Sprint 7: Creative Constitution UX — interactive quality checklist, per-campaign creative brief (prompt-injected), recipe direction panel; stale-prop fix, setTimeout cleanup
- [x] Sprint 8: Asset Export + Identity Memory — downloadUrl/downloadZip, per-asset download, ZIP export, rejected likeness (data model + store + UI), review history timeline, Dashboard activity feed fix
- [x] Sprint 9 (bug fix): LibraryPage onMarkRejectedLikeness wired — Reject button now functional in Library view
- [x] Sprint 10: Campaign State Machine + Visual Language Tokens + Export Log — CampaignStatus type, status dropdown in workspace header, ExportLogEntry + appendExportLog, export log sidebar, mood/cameraStyle/toneStyle on Recipe, Visual Language tab in editor, token chips on recipe cards

## Risks

| Risk | Severity | Status | Mitigation |
|---|---|---|---|
| All product data is localStorage-only | Critical | Mitigated | Phase 2 complete — Supabase write-through live; localStorage kept as offline fallback |
| fal.ai CDN URLs expire → approved assets 404 | High | Mitigated | Assets now mirrored to Supabase Storage non-blocking post-generation; originalFalUrl kept as debug field |
| No HTTPS — credentials over HTTP | Critical | Resolved | certbot/Let's Encrypt live |
| localStorage size limit (base64 images) | High | Mitigated | Reference images uploaded to Supabase Storage on capture; base64 kept as offline fallback |
| Supabase schema not migrated | High | Resolved | All Phase 1–3 tables created |
| /storage/ nginx rule missing → silent mirror failures | High | Fixed | Sprint 12 — nginx rule added |
| SSRF via /storage/mirror falUrl parameter | High | Fixed | Sprint 12 — fal.ai CDN domain allowlist enforced in proxy |
| Date.now() IDs — collision in same-millisecond batch | High | Fixed | Sprint 12 — replaced with crypto.randomUUID() slice |
| Review token race condition — duplicate insert | Medium | Fixed | Sprint 12 — insert-first, SELECT on 23505 unique violation |
| Supabase write-through fire-and-forget — no retry on failure | Medium | Active | Failed writes logged to console; retry queue not yet implemented |
| stale reviewerUserId in CampaignWorkspace | Medium | Active | userId read once on mount; session changes not tracked |
| ReviewPage fetch has no AbortController | Low | Active | Orphaned request if component unmounts; no data loss |
| App.tsx / CampaignWorkspace.tsx / AthleteLibrary.tsx monolith size | Medium | Mitigated | CampaignWorkspace split into CampaignGallery + CampaignSidebar; AthleteLibrary has CaptureTab + IdentityTab sub-components |
| CommandPalette ViewType manual sync | Low | Active | Keep in sync when adding views |
| No server-side credit enforcement | Medium | Active | Credits are UI-only; bypass possible |
| Resemblance scorer accuracy | Known | Active | Phase 2: replace histogram with ML classifier |
| No structured logging / error tracking in proxy | Medium | Active | Console.warn only; no visibility into production errors |
