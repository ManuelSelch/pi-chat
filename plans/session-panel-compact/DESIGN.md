# Compact session panel — Design

## Overview
Apply visually approved revision 2 of [the mockup](../../mockups/session-panel-compact/DESIGN.md) to the existing Inbox only. Keep catalogue/runtime membership, Later storage, lifecycle actions, Home search and Quick Switcher unchanged. This supersedes only the Inbox-search and always-visible empty-heading assumptions in [the original design](../session-inbox/DESIGN.md).

## Decisions & Trade-offs
- InboxContainer continues deriving rows but removes its query state and filtering. InboxView drops query props, search input/imports, and search-specific empty messages. Remove the now-unused Inbox-only matchingRows helper and its search assertions; retain unrelated row/model coverage.
- InboxView omits an empty status section and the entire empty Later wrapper, including its border/spacing. No new state, dependencies, storage or server changes. Existing Working/Later collapse state remains container-owned, including across disappearance/reappearance.
- Preserve Inbox clear, errors, Close and Settings, row order and actions, and existing sidebar/drawer geometry. Drawer-to-sidebar focus falls through the existing first-button focus target after removing the input.
- Browser test driver gains explicit no-search/no-Later assertions. Existing zero-Ready checks must assert the section itself is absent. Geometry helpers must explicitly assert empty Working/Later controls are absent rather than evaluate nonexistent controls; test populated controls in their existing lifecycle states. Do not silently skip geometry checks.
- Sidebar title-search journeys and no-match counts are intentionally removed; original Home/Quick Switcher discovery stays available. Worktree title-based actions and hover labels remain.

## Verification
- [Component scenarios](../../test/modules/web/sessions/inbox/ui/components/inbox-view.dom.test.tsx) cover empty → populated → Ready-only rendering in both sidebar and drawer, with real InboxView and supplied rows/callbacks. They do not exercise backend persistence.
- [Browser lifecycle scenarios](../../test/e2e/session-inbox.spec.ts) retain real saved-session park/reload/resume/archive and draft preservation, replacing search actions with absence assertions and zero-Later expectations with absence.
- [Worktree scenarios](../../test/e2e/inbox-worktree-labels.spec.ts) retain label/action/restart coverage, removing only Inbox search.
- Planned: focused component/model suites, affected browser suites, typecheck/build. None run yet; assertions are real, not throwing scaffolds.

## Open Questions
None.
