# Decisions

## Product Decisions

- Pluribus is not positioned as an AI image generator.
- Pluribus is positioned as AI-native creative infrastructure.
- The first vertical wedge is sports, athletes, entertainment, and brand/media teams.
- Workflow, identity, approval, and memory are more important than raw generation.

## Architecture Decisions

- Existing architecture must be audited before major changes.
- Existing generation flow should be preserved unless explicitly changed.
- New features should extend the current architecture where possible.
- Destructive migrations should be avoided unless explicitly approved.
- `data/workflows.ts` was a legacy file superseded by the recipe system — deleted in Sprint 6. All consumers now use `getRecipes()` from `store.ts`.
- `Athlete.sport` is a free-form `string` — the original enum (`"Swimming" | "Track" | "Weightlifting"`) was too restrictive for a platform serving multiple sports verticals.
- `app/lib/utils.ts` is the shared home for non-component utility functions (e.g. `relativeTime`).
- All new fields added to `CampaignOutput` (`runId`, `comments`, `reviewedBy`, `reviewedAt`, `tags`) are optional — no data migration ever required.
- `LibraryPage` reads from localStorage on mount and does not subscribe to store changes. Navigating away and back refreshes the list. This is acceptable given the single-user localStorage model.
- Tag strings are stored lowercase and trimmed. `addOutputTag` is idempotent.
- `brief` state in `CampaignWorkspace` is initialized directly from `getProjects()` (localStorage), not from the `project` prop passed by the parent. The parent holds stale state after `updateProject` writes to localStorage — reading from the store directly at init avoids this without restructuring the parent.
- Quality checklist checked state is session-local (`Set<number>` in component state). It resets on navigation. This is intentional — checklist is a review aid, not a persistent approval record.
- `briefSavedTimerRef` pattern (useRef + clearTimeout before each new setTimeout) is the project standard for transient UI feedback timers that must not stack or leak on unmount.

## UX Decisions

- The interface should feel production-grade.
- Avoid generic SaaS dashboard sprawl.
- Avoid toy-like AI interface patterns.
- Prioritize large asset previews, clear states, and fast review.