# Compact session items — Design

## Overview
Keep the existing Inbox model and row component responsible for labels and rendering. Reduce single-session linked-worktree items to project metadata plus branch; retain the actual conversation title for search, accessible action names and a native hover title. No navigation, persistence, SDK or server changes.

## Decisions & Trade-offs
- Named linked worktrees with one unarchived conversation hide the conversation subtitle. Main checkouts, unnamed/detached worktrees and ordinary projects retain their current title presentation.
- Preserve subtitles when multiple distinct conversations share the same linked checkout. Count unarchived saved conversations (including Later) plus unsaved live conversations, deduplicating saved paths against runtimes. Search/status/Later filtering must not change whether a subtitle is needed. History rows must account for live siblings when assembled for Later.
- Keep the existing secondaryLabel field for disambiguation. Expose the full conversation title on the row's selection button, without replacing its accessible name.
- Format recency compactly only inside InboxRowView: remove the trailing ` ago` from the existing formatter result. Preserve `just now`, rounding and untimed Later. Palette/Home formatting is unchanged.
- Reuse existing components and domain helpers without new dependencies or state ownership.

## Verification
- Proposed browser scenario: [inbox-worktree-labels.spec.ts](../../test/e2e/inbox-worktree-labels.spec.ts). Assert compact live/history/Later rows, desktop/phone, title search and existing lifecycle actions. The new assertion method is explicitly throwing scaffolding, not a reproduced production failure.
- Update existing branch-label scenarios to assert two lines for single-session checkouts; preserve three-line assertions in a dedicated multiple-session case. Keep title/branch search and all lifecycle assertions.
- Add model cases for one/multiple saved and unsaved conversations and stable disambiguation across status/search/Later. Add component checks for hidden title hover/accessibility, suffix-free minute/hour/day labels and unchanged `just now`/Later.
- Run relevant model/component/browser tests and typecheck/build; capture the implemented panel using authorized browser automation. Tests and screenshot are not yet run.
- Update the affected row-label description in docs/usage.md and docs/architecture.md alongside implementation.

## Open Questions
None.
