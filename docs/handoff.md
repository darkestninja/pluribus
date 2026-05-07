# Handoff

## Handoff — 2025-05-07 (Sprint 3)

### Completed This Session
- Sprint 1: Identity Profiles ✓
- Sprint 2: Creative Recipes ✓
- Sprint 3: Generation Run Records ✓

### Sprint 3 — What Was Built

**`app/lib/store.ts`** additions:
- `Run` interface: id, campaignId, athleteId, athleteName, recipeId, recipeName, prompt, negativePrompt, seed, model, aspectRatio, status ("running" | "complete" | "failed"), startedAt, completedAt, assetIds[], errorMessage
- `getRuns(campaignId)` → `Run[]`
- `addRun(run)` → void
- `updateRun(campaignId, id, patch)` → void
- Storage key: `plb_{userId}_runs_{campaignId}`
- `CampaignOutput.runId?: string` — added optional field (backward compatible)

**`app/lib/generate.ts`** additions:
- `onSeed?: (seed: number) => void` added to `GenerateImageParams`
- Calls `onSeed(data.seed)` after fal.ai returns, before returning images
- Zero breaking changes to existing callers

**`app/components/CampaignWorkspace.tsx`** — full rewrite:
- `runs` state, loaded via `getRuns(project.id)`
- `refreshRuns()` callback alongside `refreshOutputs()`
- `activeRunFilter` state — click a run to filter gallery to its outputs
- `detailOutput` state — click image to open asset detail modal
- `runBatch`: creates Run before generation, captures seed via `onSeed`, links `outId` to run, updates run to `complete` or `failed`
- `regenerateOutput`: creates Run, captures seed, updates output with `runId`
- `rerunFromRun(run)`: creates new Run using stored prompt + seed from a previous run
- Run history section in right sidebar: status dot, relative time, output count, seed, re-run button, click to filter
- Asset detail panel: full image, subject, generation lineage table (recipe, model, seed, aspect ratio, time), full prompt, full negative prompt, approve/reject/regen actions
- Pre-Sprint-3 outputs (no runId) show info message in detail panel
- Stop propagation on action buttons so clicking image doesn't trigger actions

### Immediate Next Action

Sprint 4: Approval System Expansion.

1. Extend `CampaignOutput.status` to `"pending" | "approved" | "rejected" | "flagged" | "needs_revision"`
2. Add `comments: { text, author, createdAt }[]` to `CampaignOutput`
3. Add reviewer attribution (from Supabase session user name)
4. Add comment input + history in asset detail panel
5. Remove or implement the fake "Share" button

### Modified Files (Sprint 3)
- `app/lib/store.ts` — Run interface, CRUD, runId on CampaignOutput
- `app/lib/generate.ts` — onSeed callback
- `app/components/CampaignWorkspace.tsx` — run tracking, history sidebar, asset detail panel

### Important Notes
- Run records are stored per campaign: `plb_{userId}_runs_{campaignId}`. If campaignId changes this data is separate.
- Seed capture depends on fal.ai returning a `seed` field. Some models may not return it — seed shows "random" in that case.
- The `rerunFromRun` function passes the captured seed back to fal.ai via `generateImage({ seed: run.seed })`. FLUX models should produce similar (not identical) output with the same seed — consistency depends on model version.
- Pre-existing outputs (before this sprint) have no `runId`. The asset detail panel handles this with a graceful info message.
- `relativeTime()` helper formats ISO timestamps as "just now", "5m ago", etc. — no external dependency.

### Active Blockers (User Action Required)
- Supabase schema migration not run
- Demo account not created in Supabase
- Site URL not set in Supabase

### Risks Introduced
- CampaignWorkspace is now ~400 lines. Asset detail panel adds complexity but is self-contained.
- Run records per campaign could accumulate. No cleanup mechanism yet. Consider capping at 50 runs per campaign in Sprint 5.
