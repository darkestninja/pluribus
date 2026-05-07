# Handoff

## Handoff — 2026-05-07 (Post-Sprint 8 Audit + Bug Fix) ← CURRENT

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
