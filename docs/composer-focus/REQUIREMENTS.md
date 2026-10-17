# Composer Focus Restoration — Requirements

## Goal
Reliably restore keyboard focus to the ready composer after session loading, tab changes, and completed dialog/drawer workflows. Add regression tests before changing production focus behavior, including real Mantine exit transitions that component-only tests can miss.

## Scope
### In Scope
- Audit and retain existing loading, completion, prompt containment, and prompt-handover focus tests.
- Add integration-level DOM and real-browser focus regressions before implementation.
- Consolidate composer focus requests and use Mantine overlay exit lifecycle callbacks where needed.
- Cover app overlays and dialogs: projects, folder picker, settings, quick open, close-session confirmation, generic confirmations, and extension prompts.
- Preserve loading-input protection, per-session drafts, native steering, and accessible keyboard navigation.

### Out of Scope
- Startup performance optimization or runtime/resource caching.
- Composer layout redesign, a composer focus trap, or global refocusing on every blur/click.
- Changing extension command, queue, dialog-answer, or session execution semantics.
- Automatically focusing the composer whenever any background snapshot or stream event arrives.

## Requirements
- Tests must be added and run against existing behavior first. Demonstrate the focus regression in at least one deterministic failing test before production changes. Already-passing cases remain protective coverage.
- Existing coverage is insufficient for restoration: `steering.dom.test.tsx` asserts loading completion focus; `composer-completion.dom.test.tsx` checks completion focus; `prompt-modal.dom.test.tsx` covers initial focus, containment, and prompt handover; quick-open browser tests assert search-field focus. None establishes automatic composer restoration after real overlay exit animations. The prompt-modal close test manually focuses a separate textarea, so it does not prove restoration.
- The disabled loading composer must not receive focus or accept edits/submission. Once the session is ready, focus must reach the enabled composer when no dialog owns it.
- Switching to a ready session must focus its composer without changing its draft. Opening another session and a failed opening that returns to the existing session must not lose the existing draft or leave focus stranded.
- When an app dialog or drawer finishes closing and the conversation remains available, focus must return to the enabled composer. Cover Escape/cancel and acceptance workflows where applicable.
- Restoration must work when an overlay was opened from a header button as well as from the composer; restoring the former trigger alone does not satisfy the composer workflow.
- Closing the last session returns Home and must not attempt to focus a hidden or unmounted composer.
- An open or exiting overlay retains focus ownership. Session readiness, tab changes, and background events must not pull focus out of it.
- During consecutive extension prompts, keep focus in the prompt workflow until the final prompt and its exit transition have completed. Only then restore composer focus.
- If another overlay opens before an old exit callback runs, the old callback must not steal focus from the newer overlay. Cover nested confirmation workflows as well.
- Ordinary snapshots, model streaming, and status/queue updates must not steal focus from another interactive control or disturb the composer's caret/selection. Do not force focus back after an intentional click elsewhere or block text selection and Tab navigation.
- Use one guarded composer-focus operation rather than scattered unconditional focus calls. Apply Mantine exit callbacks to restoration after transitions, and disable automatic `returnFocus` only where explicit composer restoration replaces it. Retain dialog initial autofocus, focus trapping, and existing prompt-containment protections.
- DOM tests must use actual overlay components in the relevant integration boundary rather than mocking the modal away or calling the restoration helper directly. Test delayed closing/handover explicitly; use controlled timers or lifecycle boundaries instead of arbitrary sleeps.
- Browser regressions must exercise the actual application and production styles with real Mantine transitions. Assert `toBeFocused()` after the overlay has closed and then type through the keyboard without a preceding click, `fill()`, or explicit `.focus()` on the composer. Those operations would conceal missing automatic restoration.

## Assumptions
- The agreed default destination after completing an overlay workflow is the ready composer, even when the workflow began from a toolbar button.
- Existing app overlay state and component lifecycle callbacks can represent focus ownership without a new third-party focus manager. Verify that assumption for generic confirmations and extension-prompt handover during implementation.
- Browser window activation and mobile virtual-keyboard policies are outside the automatic-restoration guarantee; verify desktop in-page focus behavior.

## Implementation Plan
### 1. DOM Focus Regressions
Description: Add tests before production changes for readiness, tab changes, preservation of drafts, and restoration after actual modal/drawer closure. Cover the delayed-exit race, prompt handover, nested/newer-overlay ownership, loading/hidden composers, and non-stealing behavior during background updates. Reuse the existing loading/completion/prompt tests instead of duplicating them. Run focused tests against baseline and record which new cases fail and why. Do not change production focus logic in this slice; failing regression tests are an intentional intermediate state, not completed verification.

### 2. Browser Focus Regressions
Description: Before production changes, extend the existing browser driver with focus assertions that do not themselves focus the composer. Add real-transition workflows for settings/projects/folder picker/quick open, confirmation cancellation and acceptance, final extension-prompt closure, and session creation/tab switching. Include a header-button entry path and keyboard-only typing after focus restoration. Use isolated real-Pi fixtures with scripted model responses and observable lifecycle waits. Demonstrate the reported regression without hard-coded sleeps; retain explicit checks that an active or newer dialog keeps focus.

### 3. Guarded Mantine Focus Restoration
Description: Depends on slices 1–2. Introduce the smallest shared guarded focus operation, invoke it for session readiness/tab changes, and connect overlay restoration to Mantine exit completion. Avoid competing `returnFocus` behavior only at explicitly managed boundaries. Preserve prompt containment/handover and avoid global blur refocusing, DOM polling, or a composer focus trap. Make the regression tests pass without weakening focus assertions or disabling transitions.

### 4. Full Verification
Description: Depends on slice 3. Run focused DOM tests, the full Vitest suite, typechecking/production build, all Playwright tests, and whitespace checks. Confirm existing steering, draft preservation, loading protection, prompt handover, and keyboard navigation still work. Commit verified implementation without pushing. Do not declare the focus fix complete while its regression tests fail.

## Open Questions
None.
