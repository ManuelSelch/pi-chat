# Composer Focus Restoration — Post-commit Exit Design

## Approach

Replace the shared hook's one-shot animation-frame restoration with an exit notification committed through React state, followed by a guarded `useLayoutEffect`. Keep Mantine transitions, initial autofocus, focus traps and `returnFocus: false` at the existing managed boundaries.

Confirmed ordering risk: Mantine's transition implementation invokes `onExited` before requesting its own exited-state update. An animation frame is not a React commit guarantee. The reported CI failure left the enabled composer unfocused for five seconds after closing Settings. Ten local browser repeats and five CPU-throttled, coverage-enabled probes passed; the precise CI interleaving remains unconfirmed. This change addresses the identified ordering risk, not a proven reproduction of that exact CI execution.

Existing composer-focus requirements remain applicable. No transport, session, subprocess or layout changes are needed.

## Components & Data Flow

- **Changed:** `src/web/ui/focus/composer-focus.ts`. `onExitTransitionEnd` increments a local exit revision; React batches that notification with the transition's exited-state update. A layout effect runs after the commit's DOM mutations, then applies the existing guarded restoration decision.
- **Reused:** `focusComposer`, previous-focus capture and all existing overlay consumers. Settings, Projects, folder picker, quick open, confirmations and extension prompts keep their current props and lifecycle wiring.
- **Changed tests:** `test/modules/web/app/composer-focus.dom.test.tsx` exercises real App/Mantine boundaries with controlled timer batching. Browser assertions and the browser driver continue to verify focus before keyboard typing, never repair it.

## Key Implementation Details

Use a numeric exit revision initialized to zero and a ref recording the consumed revision. The stable exit callback only increments the revision. In the layout effect:

1. Ignore the initial revision and already-consumed revisions.
2. Consume a new revision before attempting restoration, including when restoration is deliberately skipped. This prevents Strict Mode effect replay or later unrelated renders from refocusing.
3. If the overlay has reopened, do nothing.
4. Preserve existing ownership rules: with no dialogs, try the eligible composer and then the still-connected enabled previous trigger; with one remaining parent dialog, restore its previous trigger only when focus is outside that parent and the trigger belongs to it. Never steal from a newer/nested dialog.

Keep opening-time previous-focus capture. Remove the animation-frame ref, scheduling and cancellation; there is no queued browser callback to survive unmount. Keep the hook's public return shape unchanged. The revision is an exit notification, not global focus state or a request to focus on every render.

## Complexity Guardrails

No sleeps, polling, MutationObserver, global overlay manager, retry loop, blanket refocusing, disabled transitions, test retries or larger timeouts. Do not weaken the enabled/focused assertions. Preserve loading, Home, nested ownership, prompt handover and intentional Tab navigation.

## Verification

First add a regression that opens actual Settings, settles entry, closes it and advances the exit timer plus the former animation-frame window within one React `act`, delaying the commit. Demonstrate failure on the original hook before changing it. Require restoration after the resulting commit, without another frame or manual focus.

Add protective cases for reopening/newer-dialog ownership and unrelated renders after a consumed exit. Run existing app focus, prompt and confirmation DOM suites, the full Vitest suite, typecheck/build, repeated coverage-enabled Settings browser tests and all browser tests. Record actual results and distinguish local verification from subsequent Linux CI confirmation. Commit verified changes without pushing.

## Decisions for Approval

Approved by the user before implementation: replace the frame with a consumed exit revision and post-commit layout effect, retaining existing ownership guards. Implementation and verification evidence are recorded in [REGRESSIONS.md](REGRESSIONS.md). No remaining design decisions.
