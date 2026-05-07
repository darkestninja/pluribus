# Implement Sprint Prompt

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

Implement only the current approved sprint.

Before coding:

1. Restate the sprint goal
2. List files you will modify
3. Identify protected systems you will avoid
4. Identify risks
5. Explain implementation sequence

Then implement.

Rules:

- Preserve existing functionality
- Avoid breaking existing generation flows
- Use existing design/component patterns where possible
- Improve naming if current naming is weak
- Add types/interfaces
- Add validation where appropriate
- Add graceful empty states
- Add loading and error states
- Add tests if the project already has a test framework
- Do not introduce heavy dependencies unless necessary
- Avoid destructive migrations
- Keep architecture clean and extensible

After implementation, output:

1. Summary of changes made
2. Files changed
3. New product capabilities
4. How to test manually
5. Remaining gaps
6. Recommended next sprint

Then update:

- docs/current-state.md
- docs/tasks.md
- docs/decisions.md
- docs/handoff.md