# Tasks

## Immediate (P0 — User Action Required)

- [ ] Run Supabase schema migration in SQL editor
- [ ] Create demo account: daniel@pluribus.ai / demo123 in Supabase Auth > Users
- [ ] Set Site URL: http://185.158.132.125 in Supabase Auth > URL Configuration

## Current Sprint — Sprint 7: Creative Constitution UX

### [S7-1] Interactive Quality Checklist ✓
Reviewers can check off quality items while reviewing a campaign's outputs.

**Acceptance:**
- [x] Checklist items are interactive buttons — toggle on click
- [x] Checked state: filled emerald indicator + strikethrough text
- [x] Progress counter visible in section header (e.g. "2 / 5")
- [x] State is session-local — resets on navigation (intentional, review aid not record)

### [S7-2] Per-Campaign Creative Brief ✓
Art directors can write a campaign-specific brief that feeds into generation.

**Acceptance:**
- [x] `brief?: string` added to `Project` (optional, backward compatible)
- [x] `updateProject(id, patch)` helper added to store
- [x] Brief textarea in campaign workspace right sidebar (280 char limit)
- [x] Auto-saves on blur via `updateProject`, "saved" confirmation shown for 2s
- [x] Brief injected into `enhancePrompt` as "Campaign brief: …" after identity constraints

### [S7-3] Creative Direction Summary ✓
Recipe's style, lighting, and composition rules are accessible in the workspace.

**Acceptance:**
- [x] Recipe card is now a toggle button — click to expand/collapse direction detail
- [x] Shows: Style rules, Lighting rules, Composition rules, Negative prompt (truncated)
- [x] Collapsed by default; ChevronDown animates on toggle
- [x] Gracefully absent if recipe has no rules for a given category

## Backlog

## Phase 2 (Post-Sprint 7)

- Side-by-side asset comparison
- Contact sheet view
- Batch feedback
- Export packs (ZIP with metadata)
- External review links
- Version history
- AI-assisted tagging
- Identity confidence scoring

## Deferred

- HTTPS certificate
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
- [x] Sprint 7: Creative Constitution UX — interactive quality checklist, per-campaign creative brief (prompt-injected), recipe direction summary panel
- [x] Sprint 6: Organization Layer — sport: string, free-text sport/event, Subjects rename, getRecipes() replaces workflowTemplates, data/workflows.ts deleted, Library nav

## Risks

| Risk | Status | Mitigation |
|------|--------|-----------|
| localStorage size limit (base64 images) | Active | Compress to 800px JPEG; add warning if near limit |
| Resemblance scorer accuracy | Known | Phase 2: replace histogram with ML classifier |
| Supabase schema not migrated | Blocking | Manual user action required |
