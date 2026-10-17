# Composer focus regression baseline — slices 1–2

This is an intentionally **red, tests-only** stage of [the focus plan](REQUIREMENTS.md). Production focus behavior has not been changed. Do not skip these tests or mark them as expected failures: slice 3 must make them green.

## Results against current production behavior

| Check | Result |
|---|---|
| Full Vitest suite | 945 passed, 8 failed (953 total) |
| New DOM focus file | 8 passed, 8 failed (16 total) |
| Full Playwright suite | 22 passed, 10 failed (32 total) |
| New browser focus file | 4 passed, 10 failed (14 total) |
| TypeScript / production build | Passed |
| Existing tests | All 937 Vitest tests and all 18 browser tests passed |

All remaining failures are assertions about the composer not receiving focus. Fixture/data errors and missing-control selectors found during test development were corrected before this baseline was recorded. The failing focus cases reproduced in both focused and full-suite runs.

## Slice 1: DOM integration coverage

`test/modules/web/app/composer-focus.dom.test.tsx` mounts the actual `App`, overlay controller, confirmation provider, composer, dialogs/drawers, portals, and Mantine focus handling. Only the controller/transport boundary is stubbed. Controlled timers advance entry/exit animations and extension-prompt handover; no real-time sleeps or calls to a proposed focus helper are used.

Red cases:
- Settings and Projects closed from their focused header triggers return focus to the trigger rather than the composer.
- Loading finishes while Settings owns focus; closing Settings still leaves focus outside the composer.
- Projects hands over to the folder picker correctly, but cancelling the picker strands focus on `body`.
- Quick open launched while a toolbar control is focused returns to that control.
- Nested restart confirmation cancellation and acceptance preserve Settings focus, but closing the outer drawer does not restore the composer.
- Consecutive extension prompts preserve focus through handover, but final prompt closure strands focus on `body`.

Passing protections:
- Session switching does not steal focus from an active extension prompt.
- Ready-session switching preserves separate drafts and focuses the composer.
- Failed session opening restores the existing draft and enabled composer focus.
- Background status/queue updates neither steal toolbar focus nor change composer selection/caret.
- Running-session close cancellation/acceptance restore focus in the simulated DOM.
- Returning Home removes the composer without refocusing a hidden input.

Existing loading, completion-acceptance, and prompt-containment tests remain enabled; they are not duplicated here.

## Slice 2: real Chromium coverage

`test/e2e/composer-focus.spec.ts` uses the real server, WebSocket transport, Pi sessions, production stylesheet stack, and Mantine transitions. Inline test extensions provide input prompts and a controllable slow startup. Only model replies and the OS restart service are test-owned; the restart confirmation is cancelled and must never invoke the service.

`BrowserFocusDriver` asserts the composer is focused **before** typing via `page.keyboard.type()`. It never repairs composer focus with `fill()`, a click, or `.focus()`. Filling a dialog answer is allowed; that is the control the user is interacting with. Overlay exit waits observe detachment, not a fixed delay or merely a hidden animation frame.

Red cases:
- Closing Settings, Projects, or the folder picker.
- Accepting the folder picker and opening a new session.
- Closing Settings after cancelling a nested confirmation.
- Closing a final extension prompt, including after consecutive questions.
- Cancelling a running-session close with either Escape or Keep open.
- Accepting close of a running session when another conversation remains.

Passing protections:
- Quick open cancellation restores the composer when launched from it.
- Closing the last running session returns Home.
- A deferred extension factory holds startup until the test releases it: input remains disabled, cannot receive typing, and is focused when ready.
- New sessions and tab switching preserve draft text and focus; keyboard Tab can leave the composer.

The DOM/browser difference is intentional evidence for keeping both layers: close-session restoration passes in jsdom but fails in Chromium; quick open differs by its original focus owner. Real browser focus behavior must not be inferred solely from jsdom timers.

## Reproduce

```sh
npm test -- test/modules/web/app/composer-focus.dom.test.tsx
npm run build
npx playwright test test/e2e/composer-focus.spec.ts

# Includes the intentionally red cases above:
npm test
npx playwright test
```

Playwright retains screenshots and traces for failures under `test-results/`. Logs for this run were saved as `/tmp/pi-chat-focus-full.log` and `/tmp/pi-chat-focus-browser-full.log`; those temporary files are not required to reproduce the failures.
