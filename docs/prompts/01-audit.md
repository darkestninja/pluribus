# Audit Prompt

You are acting as my senior product team, technical architect, design systems lead, creative operations strategist, and startup CTO for Pluribus.

Read:

- docs/vision.md
- docs/product-principles.md
- docs/creative-constitution.md
- docs/current-state.md
- docs/tasks.md
- docs/decisions.md
- docs/constraints.md
- docs/roadmap.md
- docs/handoff.md

Then audit the current codebase.

Do not code.

Inspect the project and produce:

## 1. Current State Audit

Cover:

- frontend framework
- backend framework
- database/schema
- auth/session logic
- storage/media handling
- AI workflow integration points
- file upload handling
- asset rendering/display
- routing/page structure
- state management
- existing API routes
- existing data models
- existing admin/team features
- deployment assumptions

## 2. Current Product Capabilities

Identify whether Pluribus can currently:

- upload references
- generate images
- save outputs
- organize assets
- create projects/campaigns
- manage athletes/subjects
- manage workflows
- leave feedback
- approve/reject outputs
- export assets
- search assets
- reuse prompts/settings
- support teams or workspaces

## 3. Critical Gaps

Evaluate against:

1. Workflow orchestration
2. Approval systems
3. Identity consistency
4. Art-direction tooling
5. Asset memory
6. Organizational workflows

For each:

- what exists now?
- what is missing?
- what is weak?
- what is risky?
- what should be built first?
- what can be improved without overbuilding?

## 4. UX Audit

Review:

- core journey clarity
- visual hierarchy
- asset comparison
- production states
- empty states
- error states
- loading states
- whether it feels production-grade
- whether it feels too generic or too technical

## 5. Technical Risk Audit

Identify:

- fragile code
- missing abstractions
- poor naming
- scaling risks
- security risks
- storage risks
- data loss risks
- AI provider coupling
- missing validation
- missing permissions
- missing logging
- missing audit trails
- launch blockers

## 6. Recommended Product Architecture

Recommend how the product should support:

- Workspace
- Project
- Campaign
- Subject
- Identity Profile
- Creative Recipe
- Generation Run
- Asset
- Review
- Approval State
- Export Preset
- Roles

## 7. Phase 1 Implementation Plan

Give a practical staged plan.

Do not implement yet.

## 8. Risks / Assumptions

List risks and assumptions.

## 9. Files Likely To Modify

List likely files, but do not change them yet.

Finally, update:

- docs/current-state.md
- docs/tasks.md
- docs/handoff.md

Do not code.