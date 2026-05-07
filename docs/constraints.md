# Constraints

## Protected Systems

Do not modify aggressively without explicit approval:

- Existing generation pipeline
- Existing AI provider integrations
- Existing auth/session logic
- Existing upload/storage flow
- Existing deployment configuration
- Existing environment variable setup
- Existing production data schema

## Implementation Constraints

- Audit before coding
- Preserve existing functionality
- Avoid destructive migrations
- Avoid heavy dependencies unless clearly justified
- Use existing design/component patterns where possible
- Add types/interfaces where appropriate
- Add validation where appropriate
- Add loading, empty, and error states
- Keep architecture extensible
- Do not overbuild enterprise permissions too early
- Do not create generic AI chat features unless directly tied to workflows

## Product Constraints

Do not prioritize:

- cosmetic dashboards
- generic AI chat
- consumer prompt toys
- model marketplaces
- excessive settings
- features unrelated to identity, workflow, approval, memory, or production readiness



Rule 1: Audit before implementation

Claude must inspect the app before touching anything.

Rule 2: Never build everything at once

Work in small sprints.

Rule 3: Always list files before changing them

No invisible bulldozers.

Rule 4: Preserve generation flow unless explicitly changing it

Generation is likely the fragile crown jewel.

Rule 5: Update docs after every sprint

Mandatory files to update:

* docs/current-state.md
* docs/tasks.md
* docs/decisions.md
* docs/handoff.md

Rule 6: Commit often

After each sprint:
git add .
git commit -m "describe completed sprint"

Rule 7: Prefer product moat over cosmetic polish

Build memory, identity, workflows, approvals, lineage.

Not shiny dashboard confetti.

