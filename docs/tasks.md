# Tasks

## Immediate (P0 — User Action Required)

- [x] Add HTTPS — certbot/Let's Encrypt — **done**, site is at https://pluribus.danielasiegbunam.com
- [ ] Run Supabase schema migration in SQL editor — paste SQL from `cd /opt/pluribus-proxy && bun run migrate.ts`
- [ ] Run Storage RLS policies in SQL editor — printed by `bun run setup.ts` (run from proxy dir)
- [x] Create demo account: daniel@pluribus.ai — already exists in Supabase Auth
- [ ] Set Site URL + redirect URL in Supabase Auth > URL Configuration (https://pluribus.danielasiegbunam.com)

## Current Sprint — Sprint 11 (TBD)

Candidates from backlog (choose next):
- Keyboard navigation in gallery (arrow keys, J/K approve/reject)
- Recipe mood board: 1-3 reference image uploads per recipe
- Batch multi-select + bulk status actions in CampaignWorkspace gallery
- Rejection reason structured tags on rejected outputs
- Profile completeness % signal on athlete card

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
- External review links (shareable stakeholder token, no login required)
- Supabase persistence (migrate CampaignOutput, Run, Athlete, AthleteProfile from localStorage)
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
| All product data is localStorage-only | Critical | Active | Migrate to Supabase (Phase 2) |
| fal.ai CDN URLs expire → approved assets 404 | High | Active | downloadZip mitigates; Supabase Storage is permanent fix |
| No HTTPS — credentials over HTTP | Critical | Active | certbot on server; P0 user action |
| localStorage size limit (base64 images) | High | Active | Supabase Storage migration planned |
| Supabase schema not migrated | High | Blocking | Manual user action required |
| LibraryPage onMarkRejectedLikeness not wired | Medium | Known bug | Sprint 9 fix |
| App.tsx / CampaignWorkspace.tsx / AthleteLibrary.tsx monolith size | Medium | Mitigated | CampaignWorkspace split into CampaignGallery + CampaignSidebar; AthleteLibrary has CaptureTab + IdentityTab sub-components |
| CommandPalette ViewType manual sync | Low | Active | Keep in sync when adding views |
| No server-side credit enforcement | Medium | Active | Credits are UI-only; bypass possible |
| Resemblance scorer accuracy | Known | Active | Phase 2: replace histogram with ML classifier |
