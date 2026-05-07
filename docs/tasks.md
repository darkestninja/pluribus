# Tasks

## Immediate (P0 — User Action Required)

- [ ] Run Supabase schema migration in SQL editor
- [ ] Create demo account: daniel@pluribus.ai / demo123 in Supabase Auth > Users
- [ ] Set Site URL: http://185.158.132.125 in Supabase Auth > URL Configuration

## Current Sprint — Sprint 7: Creative Constitution UX

## Backlog

- [S8] Side-by-side asset comparison
- [S9] Export packs (ZIP with metadata)

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
- [x] Sprint 5: Asset Tagging + Cross-Campaign Search
  - tags?: string[] on CampaignOutput + addOutputTag/removeOutputTag store helpers
  - Tag chip UI in AssetDetailPanel
  - relativeTime() extracted to app/lib/utils.ts
  - Run records capped at 50 per campaign
  - LibraryPage: global asset grid with subject/status/search filters
  - Library nav entry (Images icon)
- [x] Sprint 6: Organization Layer
  - Athlete sport field widened from enum → string
  - AddAthleteModal: free-text sport + event fields
  - AthleteLibrary: sport filter as text input, "Athletes" → "Subjects" labels
  - workflowTemplates replaced with getRecipes() in Projects + Onboarding
  - data/workflows.ts deleted
  - CommandPalette: Athletes → Subjects group, Library nav item added
  - App.tsx: ViewType athletes→subjects, library added
  - AthleteProfile schema + persistence
  - Capture angles (base64, compressed)
  - Tattoos + marks
  - Do-not-change constraints (injected into prompts)
  - Identity notes
  - Approved likeness (save from campaign workspace)
  - Blob URL bug fixed in AddAthleteModal
- [x] Sprint 2: Creative Recipes
  - Recipe schema + 6 seed recipes
  - Recipe library (browse, create, edit, clone, delete)
  - Negative prompt injected in all generation paths
  - Quality checklist in campaign review sidebar
- [x] Sprint 3: Generation Run Records
  - Run interface + CRUD in store.ts
  - onSeed callback in generate.ts
  - Run history sidebar in CampaignWorkspace
  - Asset detail panel with full lineage
  - Re-run from history with seed replay
- [x] Sprint 3 fixes: model field, concurrency lock, regen disable, expandable run list
- [x] Sprint 4: Approval System Expansion
  - OutputStatus (5 states) + OutputComment interface
  - setOutputStatus + addOutputComment store helpers
  - AssetDetailPanel extracted as standalone component
  - 5-state status selector, comment thread + input, reviewer attribution
  - 6 filter tabs, gallery card badges for all states
  - Share button removed
  - regenerateOutput concurrency + URL persistence fixed

## Risks

| Risk | Status | Mitigation |
|------|--------|-----------|
| localStorage size limit (base64 images) | Active | Compress to 800px JPEG; add warning if near limit |
| Resemblance scorer accuracy | Known | Phase 2: replace histogram with ML classifier |
| Fake Share link | Resolved (Sprint 4) | Removed from campaign header |
| Supabase schema not migrated | Blocking | Manual user action required |
| Sport enum hard-coded | Known | Change to free-form string in Sprint 6 |
