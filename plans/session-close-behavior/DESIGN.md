# Session close navigation — Design

## Overview
The browser app reducer currently selects `tabs[0]` when its selected runtime disappears. Snooze (Move to Later) and archive close that runtime, so another conversation opens despite the Inbox navigation model. Explicit close-view already clears selection correctly.

Change live selected-runtime removal to reuse the reducer's deliberate Home state (`activeSessionId: ""`, `viewClosed: true`). State ownership remains in [app-state.ts](../../src/web/app/state/app-state.ts); no new navigation abstraction, server/SDK changes or dependencies are needed.

## Decisions & Trade-offs
- Detect removal of an existing selected runtime during an established ready connection; set deliberate deselection before the generic remaining-runtime fallback. Subsequent SDK updates must keep Home until explicit selection or creation.
- Preserve atomic `session.replaced` selection transfer (worktree switching is not closing a conversation).
- Preserve startup and reconnect selection behavior. This fix concerns live closing, not restoring a connection.
- Preserve background-session actions: closing, parking or archiving a different session must not change the current view.
- Preserve operation failure handling and existing empty-session cleanup. Do not navigate optimistically on a close request; authoritative runtime removal triggers Home. No changes to Later persistence, archive notices, drafts or retained background work.
- Apply this selected-runtime removal rule in shared application state, including explicitly opted-out legacy tabs mode, rather than introducing mode-specific navigation behavior.
- Existing Home UI is reused unchanged; no mockup or layout changes are required.

## Verification
- [Application reducer scenarios](../../test/modules/web/app/state/app-state.test.ts): selected removal, persistent Home across background updates, background removal, existing failed-close rollback, reconnect and runtime-replacement coverage.
- [Inbox browser scenarios](../../test/e2e/session-inbox.spec.ts): close/snooze/archive with two saved open sessions; explicit subsequent selection; background snooze/archive leave the current conversation visible. Existing single-session, drafts, background work and unloaded history scenarios remain.
- Existing BrowserInboxDriver assertions verify the real Home actions and retained Ready rows; no driver semantics or scaffolding changes.
- Browser fixtures use a real server with scripted assistant responses. They test navigation, not model behavior.
- Proposed tests have not been run: this fresh worktree has no installed dependencies. Production implementation waits for combined scenario/design approval.

## Open Questions
None.
