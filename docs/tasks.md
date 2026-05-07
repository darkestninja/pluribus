# Tasks

## Immediate (P0 — User Action Required)

- [ ] Run Supabase schema migration in SQL editor
- [ ] Create demo account: daniel@pluribus.ai / demo123 in Supabase Auth > Users
- [ ] Set Site URL: http://185.158.132.125 in Supabase Auth > URL Configuration
- [ ] Add HTTPS — certbot/Let's Encrypt on the server (credentials currently sent over HTTP)

## Current Sprint — Sprint 8: TBD

Recommended candidates (audit-informed priority order):

**Stage 1 — Close acute data/security risks (highest leverage):**
- Asset download / export packs — protect against fal.ai CDN URL expiry; ZIP approved assets
- Rejected likeness examples on identity profile — complete the identity memory model
- Review history / audit trail — `reviewHistory[]` on CampaignOutput; never lose past reviewer data
- Dashboard activity feed — read from CampaignOutputs (not Queue); shows real campaign work

**Stage 2 — Close UX gaps that block real workflows:**
- Side-by-side asset comparison — single biggest review UX gap
- Batch status actions — multi-select + bulk approve/reject/flag
- Campaign status state machine — Draft → Review → Approved → Delivered transitions
- Profile completeness score — real signal based on fields, angles, constraints count

**Stage 3 — Sharpen the moat:**
- Recipe mood board / visual references — upload 1-3 reference images per recipe
- Project vs Campaign hierarchy — Project as parent container, Campaign as child
- Contact sheet view

## Backlog (Phase 2+)

- External review links (shareable stakeholder token, no login required)
- Supabase persistence (migrate CampaignOutput, Run, Athlete, AthleteProfile from localStorage)
- Supabase Storage for reference images (remove base64-in-localStorage)
- Version history on recipes and subjects
- AI-assisted tagging
- Identity confidence scoring (ML-based, not histogram)
- Export presets (named output formats: Instagram story, press image, etc.)
- Campaign boards / contact sheet
- Smart model routing
- Recipe performance analytics

## Deferred

- HTTPS certificate ← **moved to P0 — must do before launch**
- Stripe billing
- Analytics (Mixpanel/Sentry)
- Mobile app
- Custom LoRA training pipeline
- Video generation improvements
- Public API
- Full enterprise RBAC

## Done

- [x] Sprint 0: Full product + technical audit
- [x] Sprint 1: Identity Profiles — AthleteProfile schema, capture angles, tattoos, do-not-change constraints, approved likeness, blob URL fix
- [x] Sprint 2: Creative Recipes — recipe schema + 6 seeds, library CRUD, negative prompt injection, quality checklist
- [x] Sprint 3: Generation Run Records — Run interface, onSeed callback, run history sidebar, asset detail panel, seed replay
- [x] Sprint 3 fixes: model field, concurrency lock, regen disable, expandable run list
- [x] Sprint 4: Approval System Expansion — 5-state OutputStatus, comments, AssetDetailPanel extraction, 6 filter tabs, card badges, reviewer attribution, concurrency + URL persistence fixes
- [x] Sprint 5: Asset Tagging + Cross-Campaign Search — tags on CampaignOutput, tag chip UI, LibraryPage, relativeTime to utils, addRun capped at 50
- [x] Sprint 7: Creative Constitution UX — interactive quality checklist, per-campaign creative brief (prompt-injected), recipe direction summary panel; post-review: stale-prop brief fix, setTimeout cleanup, "Subjects" label fix
- [x] Sprint 6: Organization Layer — sport: string, free-text sport/event, Subjects rename, getRecipes() replaces workflowTemplates, data/workflows.ts deleted, Library nav

## Risks

| Risk | Severity | Status | Mitigation |
|------|----------|--------|-----------|
| All product data is localStorage-only | Critical | Active | Migrate to Supabase (Phase 2); short term: warn on quota |
| fal.ai CDN URLs expire → approved assets 404 | Critical | Active | Add asset download/ZIP export in Sprint 8 |
| No HTTPS — credentials over HTTP | Critical | Active | certbot on server; P0 user action |
| localStorage size limit (base64 images) | High | Active | Compress to 800px JPEG; Supabase Storage migration planned |
| Supabase schema not migrated | High | Blocking | Manual user action required |
| No server-side credit enforcement | Medium | Active | Credits are UI-only; bypass possible |
| Resemblance scorer accuracy | Known | Active | Phase 2: replace histogram with ML classifier |
| App.tsx / CampaignWorkspace.tsx monolith size | Medium | Active | Refactor as feature count grows |
| CommandPalette ViewType manual sync | Low | Active | Keep in sync when adding views |
