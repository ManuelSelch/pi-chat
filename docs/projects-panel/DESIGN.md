# Projects Sidebar — Design

## Overview
Replace the desktop-only modal presentation with the approved responsive sidebar, reusing the existing project list and actions. Phones retain a Mantine modal drawer. Preserve production styling and the current 45rem transcript/composer column, rather than copying the mockup's sample chat.

## Components
| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| Web shell | [App](../../src/web/app/App.tsx) | Changed | Own shared responsive workspace geometry and widget-placement decisions; apply matching bounds to main content and fixed composer. |
| Navigation state | [OverlayController](../../src/web/app/overlays/OverlayController.tsx) | Changed | Retain in-memory Projects visibility across session/tab changes; expose blocking-overlay state separately from non-modal visibility. |
| Projects | [ProjectSessionContainer](../../src/web/sessions/projects/ProjectSessionContainer.tsx) / [ProjectSessionDrawer](../../src/web/sessions/projects/ProjectSessionDrawer.tsx) | Changed | Container wires presentation mode and actions; view reuses one list in a desktop navigation region or phone Drawer. Preserve local expansion state. |
| Shell controls | [HeaderContainer](../../src/web/app/shell/HeaderContainer.tsx) / [HeaderView](../../src/web/app/shell/HeaderView.tsx) | Changed | Toggle Projects, expose expanded state, and supply the stable fallback focus target. |
| Composer/keyboard | [ComposerContainer](../../src/web/chat/composer/ComposerContainer.tsx) / [GlobalKeyboardController](../../src/web/app/keyboard/GlobalKeyboardController.tsx) | Changed | Gate focus, completions, and shortcuts on blocking overlays, not the desktop sidebar. |
| Widgets | [WidgetDock](../../src/web/extensions/widgets/WidgetDock.tsx) / [placeWidgets](../../src/web/extensions/widgets/widget-placement.ts) | Changed | Use remaining workspace width consistently for right-gutter docking versus composer placement. |
| Focus | [composer-focus](../../src/web/ui/focus/composer-focus.ts) | Reused | Guard composer focus against real dialogs, including exiting phone drawers. |

## Runtime flow
1. Header toggles the existing Projects visibility state. Below 640px, render the modal Drawer; from 640px, render navigation below the 96px header.
2. From 640–1399px, an open sidebar reserves 288px on the left. From 1400px, fit its width into the unused left gutter, capped at 340px; keep the chat centered in the full window. Closed navigation reserves no space.
3. Shell applies the same workspace bounds to transcript, Home, and fixed composer. Widget docking requires at least 1200px of remaining workspace; otherwise widgets stay around the composer. Dock width uses that workspace's gutter, not the full viewport.
4. Selecting/creating a session keeps Projects open at every size. Existing loading guards, draft ownership, session actions, and error behavior remain unchanged.
5. Resizing preserves visibility while switching presentation; no duplicate list or orphaned focus trap. Opening a real modal still blocks the session. Open folder keeps its existing handover: close Projects and open the folder picker.

## Contracts & API changes
| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| OverlayController → composer/keyboard | Any visible overlay blocks → only modal overlays block | Internal behavioral change; phone Projects still blocks. |
| Shell → composer/widgets | Viewport-wide positioning → shared workspace bounds and docking decision | Internal props/layout contract; no duplicate media-query decisions. |
| Projects → session actions | Select/create also closes → select/create leaves visibility unchanged | Intentional UX change; callbacks and server contracts unchanged. |

No server, SDK, wire schema, dependency, or persisted-preference changes.

## Decisions & Trade-offs
- Keep current components and state owner; no new navigation framework or production React Grab.
- Desktop navigation has no dialog role, backdrop, focus trap, scroll lock, or outside-click dismissal.
- Opening desktop Projects preserves composer typing ownership; keyboard users can Tab into navigation. Selecting a ready session focuses its composer as today. Ordinary catalogue/stream updates must not steal navigation focus.
- Closing desktop Projects returns focus only when needed: removed sidebar focus returns to the ready composer or header toggle at Home; a real dialog always wins. Phone exit uses existing post-commit focus restoration.
- Desktop Escape inside navigation closes it without aborting a run. From the composer, existing completion-menu/abort behavior remains available; real modals retain priority.
- Phones retain modal semantics, including Escape/outside-click dismissal. Selecting a session leaves the drawer open until dismissed.
- Compact layouts trade chat width for simultaneous navigation; widgets fall back to composer placement rather than overlapping the chat. No resizing controls or reload persistence.

## Verification
Planned checks, not results:
- DOM tests: non-modal navigation versus phone dialog, retained visibility after select/create, drafts/loading, completions, Escape ownership, focus on close, modal handover, and responsive focus transfer.
- Preserve project ordering/grouping/archive tests and phone delayed-exit focus regressions; update driver assumptions that Projects is always a dialog.
- Driven browser tests at 1680, 1024, and 390px: typing/submission with desktop sidebar open, selection and tab changes, scrolling, resize, modal priority, and non-overlapping transcript/composer/widgets. Assert wide chat bounds unchanged on toggle.
- Run focused Vitest and Playwright suites, TypeScript checks, and production build; report baseline failures separately.

## Open Questions
None.
