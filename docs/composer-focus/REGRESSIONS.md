# Composer focus regressions — completed slices 1–4

All slices of [the focus plan](REQUIREMENTS.md) are complete. The regressions were first committed red, then made green by the production focus fix. All assertions remain enabled; no tests are skipped or marked as expected failures.

## Verified red → green

| Check | Before focus fix | After focus fix |
|---|---|---|
| Full Vitest suite | 945 passed, 8 failed | 953 passed |
| DOM focus file | 8 passed, 8 failed | 16 passed |
| Full Playwright suite | 22 passed, 10 failed | 32 passed |
| Browser focus file | 4 passed, 10 failed | 14 passed |
| Browser focus file repeated three times | Not run | 42 passed |
| TypeScript / production build | Passed | Passed |
| Existing tests | 937 Vitest and 18 browser tests passed | Still passing |

The original failures were composer-focus assertions, not fixture/selector errors. They reproduced in focused and full-suite runs. After correcting the simulated-clock helper to commit React between lifecycle phases, temporarily reversing only the production fix still reproduced the same 8 DOM failures. No focus assertions were weakened.

## Slice 3: guarded restoration

`src/web/ui/focus/composer-focus.ts` owns the guarded composer focus operation and a shared overlay lifecycle hook. Ready-session/tab changes and completion acceptance reuse the guarded operation. Managed dialogs/drawers disable Mantine's early trigger restoration. `onExitTransitionEnd` increments an exit revision; a layout effect restores focus after React commits the transition's DOM removal. Each revision is consumed once, even if restoration is skipped because the overlay reopened or another dialog owns focus. There is no polling or animation-duration timeout.

A remaining dialog keeps ownership; a nested confirmation can restore its still-connected parent trigger without focusing the composer or overriding a newer dialog. Home and disabled/hidden composers are protected. Extension prompts retain the existing handover interval, then run a real Mantine exit transition instead of unmounting immediately. Stream/snapshot updates do not become focus triggers.

`test/infra/ui/finish-ui-transitions.ts` drains controlled timers one lifecycle phase at a time to exercise ordinary transition sequencing. Additional delayed-commit regressions deliberately batch a complete exit and the former animation-frame window inside one React `act`. The old frame-based implementation checked stale DOM and lost restoration; the post-commit implementation passes both sequencing modes.

## Slice 1: DOM integration coverage

`test/modules/web/app/composer-focus.dom.test.tsx` mounts the actual `App`, overlay controller, confirmation provider, composer, dialogs/drawers, portals, and Mantine focus handling. Only the controller/transport boundary is stubbed. Controlled timers advance entry/exit animations and extension-prompt handover; no real-time sleeps or calls to a proposed focus helper are used.

Cases that failed before the fix:
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

Cases that failed before the fix:
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

The baseline DOM/browser difference demonstrates why both layers are retained: close-session restoration originally passed in jsdom but failed in Chromium; quick open differed by its original focus owner. Real browser focus behavior must not be inferred solely from jsdom timers. All of these cases now pass in both layers.

## Follow-up: post-commit exit restoration

The [approved follow-up design](DESIGN.md) replaces the original one-shot animation frame. Mantine invokes its exit callback before requesting its exited-state update; a frame does not guarantee that React has committed that update.

Before changing the hook, two new real-App/Mantine regressions (Settings and Projects) failed with the dialog removed but `body` still focused; the existing 16 focus cases passed. Both new cases pass after the change. Three additional protections cover reopening Settings before the exit commit, a newer prompt taking ownership before Settings exits, and avoiding replay on background updates or the next close. Existing nested confirmation and prompt-handover cases remain green. Browser assertions, timeouts and retries are unchanged.

Local verification:
- Focus, prompt and confirmation DOM suites: **51 passed**.
- Full Vitest suite: **1,262 passed / 149 files**.
- Typecheck and production build: **passed**, including a coverage/source-map build.
- Settings browser test repeated ten times with two workers and browser/Node coverage: **10 passed**; report generation passed after rebuilding with `PI_CHAT_COVERAGE=1` (the initial normal build lacked source maps).
- Full coverage-enabled Chromium suite, two workers: **33 passed**; coverage report generation passed.
- `git diff --check`: **passed**.

The deterministic regression establishes the stale-DOM ordering risk, not the exact interleaving of the earlier Linux CI failure. Local pre-fix browser repetitions also passed; a fresh Linux CI run remains necessary. Temporary verification logs use the `/tmp/pi-chat-focus-post-commit-` prefix; the original red run is `/tmp/pi-chat-focus-delayed-commit-red.log`.

## Reproduce

```sh
npm test -- test/modules/web/app/composer-focus.dom.test.tsx
npm run build
npx playwright test test/e2e/composer-focus.spec.ts
npx playwright test test/e2e/composer-focus.spec.ts --repeat-each=3

# CI-like coverage verification (requires browser source maps):
PI_CHAT_COVERAGE=1 npm run build
node scripts/run-playwright-coverage.mjs test/e2e/composer-focus.spec.ts --grep 'after closing settings' --repeat-each=10 --workers=2
node scripts/run-playwright-coverage.mjs --workers=2

# Full verification, including all focus regressions:
npm test
npx playwright test
```

Playwright is configured to retain screenshots and traces for failures under `test-results/`. Final green-suite logs were saved as `/tmp/pi-chat-focus-final-tests.log` and `/tmp/pi-chat-focus-final-browser.log`; these temporary files are not required to rerun verification.
