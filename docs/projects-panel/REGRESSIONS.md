# Projects sidebar — Verification

- Approved scope: mockup revision 1 wide/compact sidebar; phone option B (modal drawer). Selecting/creating a session keeps Projects open. Technical design approved by the user's “looks good. implement”.
- Production keeps the existing 45rem transcript/composer width, project/session styling, grouping, ordering, and actions. The mockup's placeholder chat styling was not copied.
- Desktop Projects is navigation, not a dialog. Compact layouts reserve 288px; wide layouts use the left gutter. Phones retain modal focus/scroll behavior.

## Regression coverage
- Pure shell geometry tests cover phone/desktop/wide boundaries, sidebar offsets, and workspace-dependent widget docking.
- Project DOM tests cover non-modal semantics and retained visibility after session selection/creation in both presentations.
- App DOM tests cover submission/completions with navigation open, explicit toggling/closure, Escape versus abort ownership, real-modal priority, background-focus preservation, Home fallback focus, and phone-to-desktop focus transfer. Existing phone delayed-exit regressions remain intact.
- Browser workflows exercise 1680px, 1024px, 1280px, and 390px; assert unchanged wide chat bounds, no sidebar/transcript/composer/widget overlap, per-session drafts, navigation retention, typing/submission, wheel scrolling, phone modal ownership, and resizing without duplicate navigation or orphaned scroll locks.
- Existing browser drivers now address either the Projects navigation region or phone dialog, rather than assuming every Projects panel is modal.

## Executed checks

Concurrent prompt/dependency implementation changed the main checkout during verification. Its uncommitted changes were left untouched. A clean temporary export of base commit `3d7f562` plus only the sidebar changes was installed with `npm ci` and verified independently:

- `npm run build`: passed, including dependency API verification and both TypeScript checks. Existing bundle-size warning remains.
- `npx vitest run`: **97 files passed; 823 tests passed**.
- `npx playwright test`: **48 passed; 1 skipped** (coverage-specific test without instrumentation).

The isolated checks establish the sidebar change independently; they do not claim that the concurrent prompt work or the combined uncommitted checkout is green. No dependency changes are included in the sidebar task.
