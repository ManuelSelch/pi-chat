# Later and close session commands — Design

## Overview
Restore an explicit close action lost when the tabs action was renamed to Move to Later in Inbox mode, and split the single context-dependent `close-tab` entry in [session-actions.ts](../../src/web/sessions/actions/session-actions.ts) into three stable session actions: **Close Session**, **Later**, and **Archive Session**. Keep the composer ⌘K menu, Quick Switcher and Inbox mouse controls on the same underlying operations.

## Decisions & Trade-offs
- Replace the context-renamed `close-tab` action with two ids: `close-session` (close the runtime, no Later membership) and `later-session` (park into Later). `archive-session` is retained. Labels are plain `Close Session`, `Later`, `Archive Session`; the leading `/` stays composer filtering behavior, not part of the name.
- Separate the overloaded provider `closeTab` operation (today it parks in Inbox and closes in tabs) into `closeSession` and `parkSession`. `closeSession` closes immediately via `chat.closeTab`, with **no confirmation dialog**, in any status (matching the direct close intent); `parkSession` uses `chat.inbox.park`. Archive error ownership is unchanged. The separate header tab-close button keeps its existing confirmation and is out of scope.
- Inbox off (tabs mode): show `Close Session` and `Archive Session`; **hide `Later`** because no Later list exists there.
- Always-list behavior: while a session is selected and connected, actions are present. `Close Session` is never disabled and closes without confirmation in any status. `Later` and `Archive Session` are present but **disabled** while the session is running/blocked/aborting or has no persisted path; they enable on completion. This replaces today's silent omission.
- Add disabled support to the composer command menu (`MenuItem`/`LocalAction`), matching the palette which already renders `QuickOpenItem.disabled` and skips disabled rows. Disabled rows render dimmed and non-selectable; ArrowUp/Down skip them.
- Recognize exact `/close`, `/later`, `/archive` submissions after the menu is dismissed, mirroring the existing `/archive` special case, but only run the action when not disabled.
- Preserve run-time staleness guards in each action and all SDK/server/storage contracts. No dependency or protocol changes.
- No separate mockup: this is a stable-label/eligibility change to an existing list plus a disabled state, not a new layout or interaction redesign.

## Verification
- [Session action builder scenarios](../../test/modules/web/sessions/actions/session-actions.test.ts): three actions with ids/labels, Inbox hides `later-session` when off, disabled while busy/unsaved, close routes to `closeSession`, Later to `parkSession`, archive unchanged, Home/disconnected/stale guards retained.
- [Shared menu DOM scenarios](../../test/modules/web/sessions/actions/shared-menus.dom.test.tsx): composer and palette run Close Session/Later/Archive Session; disabled rows are non-selectable; archive error display and Restart exclusion retained.
- [Composer completion scenarios](../../test/modules/web/chat/composer/composer-completion.dom.test.tsx): `/close`, `/later`, `/archive` exact submissions; running-session Later disabled.
- [Quick Switcher browser scenario](../../test/e2e/quick-open.spec.ts): tabs mode lists Close Session/Archive Session without Later; Inbox mode lists all three.

## Open Questions
None.
