# Handoff

## Handoff — 2026-05-07 (Post-Sprint 6) ← CURRENT

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
