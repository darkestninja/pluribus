# Tasks

## Immediate (P0 — User Action Required)

- [ ] Run Supabase schema migration in SQL editor
- [ ] Create demo account: daniel@pluribus.ai / demo123 in Supabase Auth > Users
- [ ] Set Site URL: http://185.158.132.125 in Supabase Auth > URL Configuration

## Current Sprint — Sprint 2: Creative Recipes

### [S2-1] Recipe Schema
Upgrade `Workflow` interface to `Recipe` with negativePrompt, qualityChecklist, styleRules, aspectRatioLocked, seedLocked.

**Acceptance:**
- [ ] Recipe interface defined in `data/recipes.ts`
- [ ] Seed recipes created (Athlete Announcement, Editorial Portrait, Match Day Graphic, etc.)
- [ ] `getRecipes` / `saveRecipe` / `deleteRecipe` in store.ts

### [S2-2] Recipe Library UI
Browse, create, edit, clone recipes.

**Acceptance:**
- [ ] Recipe list in WorkflowLibrary (replaces or extends current)
- [ ] Create recipe modal (all fields: prompt, negative, checklist, style rules, etc.)
- [ ] Edit existing recipe
- [ ] Clone recipe
- [ ] Recipe persists on refresh

### [S2-3] Recipe in Campaign
Connect recipes to campaign creation and generation.

**Acceptance:**
- [ ] NewCampaignModal shows recipes instead of workflow templates
- [ ] CampaignWorkspace shows recipe name + quality checklist in sidebar
- [ ] Negative prompt injected at generation time (batch + single regenerate)
- [ ] Quality checklist visible during review in campaign

## Backlog

- [S3] Generation Run Records (lineage: prompt, seed, model, inputs → outputs)
- [S4] Approval System expansion (comments, reviewer, full state machine, review history)
- [S5] Asset Tagging + Cross-Campaign Search
- [S6] Organization Layer (workspace, subjects as first-class, navigation hierarchy)
- [S7] Creative Constitution UX (quality checklist in review, creative direction fields)

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
- [x] Sprint 1: Identity Profiles
  - AthleteProfile schema + persistence
  - Capture angles (base64, compressed)
  - Tattoos + marks
  - Do-not-change constraints (injected into prompts)
  - Identity notes
  - Approved likeness (save from campaign workspace)
  - Blob URL bug fixed in AddAthleteModal

## Risks

| Risk | Status | Mitigation |
|------|--------|-----------|
| localStorage size limit (base64 images) | Active | Compress to 800px JPEG; add warning if near limit |
| Resemblance scorer accuracy | Known | Phase 2: replace histogram with ML classifier |
| Fake Share link | Known | Remove or implement before launch |
| Supabase schema not migrated | Blocking | Manual user action required |
| Sport enum hard-coded | Known | Change to free-form string in Sprint 6 |
