# Remove archive notice — Design

## Overview
Remove the persistent “Session archived. Undo archive” notice and its page-lifetime Undo action. Keep successful archive behavior, error reporting, and existing archived-history restoration outside Inbox. This proposed change supersedes the parent session-inbox design's Undo behavior only after approval.

## Components
| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| Inbox application | [useInboxLifecycle](../../../src/web/sessions/inbox/app/use-inbox-lifecycle.ts) | Changed | Remove Undo record/operation and its Undo-only catalogue barrier; retain archive confirmation, Later cleanup and failure handling |
| Inbox presentation | InboxNotice / InboxNoticeContainer | Changed | Render dismissible errors only; remove success notice and Undo props |
| Tests / documentation | session-inbox browser scenarios, lifecycle tests, usage and architecture | Changed | Replace Undo-specific expectations with notice-free archive outcomes; retain unrelated regressions |

## Runtime flow
1. User archives a current, parked or unloaded saved conversation using existing controls.
2. The lifecycle controller sends the existing server archive operation.
3. Confirmed success removes Later membership as before. No Undo state or success notice is created. An unloaded or parked conversation is not opened.
4. Failure retains recoverable state and the existing dismissible error message.

## Contracts & API changes
| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| Inbox lifecycle → views | `canUndo` and `undo` plus errors → errors only | Internal contract removal |
| UI → user | Persistent success notice with Undo → no notice or immediate Undo | Intentional behavior removal |
| SDK/server → browser | Existing archive / history restore → unchanged | No protocol, dependency or storage changes |

## Decisions & Trade-offs
- Remove the unused Undo machinery rather than hiding a live action permanently.
- Do not replace the notice with a toast, timer, confirmation dialog or new UI; no mockup is needed for this control removal.
- Existing archive history remains the restoration route. Draft restoration via immediate Undo is intentionally removed; normal draft behavior is unchanged.
- Preserve the parent approved design; do not rewrite it to conceal the changed contract.

## Verification
- Prepared executable scenarios in [session-inbox.spec.ts](../../../test/e2e/session-inbox.spec.ts) cover current, Later and unloaded Ready archive without notice/Undo, preserving membership removal and Home behavior.
- Existing driver archive methods currently wait for Undo to appear. After approval replace that completion signal with disappearance of the archived row/current header control; keep the new no-notice assertion strict.
- Replace Undo-only lifecycle tests with archive success/failure checks; add error-only notice component coverage. Run focused tests, browser regressions and typecheck/build.

## Open Questions
None. User explicitly approved the scenario outcomes and supporting design, including the mechanical rename to `shouldShowHome()`, before implementation.
