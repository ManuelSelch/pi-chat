# Shared Session Actions — Requirements

## Goal
Keep the quickswitcher's Actions scope and share parameter-free local session/application actions with the composer's slash menu. Eliminate duplicate labels, availability rules, and execution callbacks without introducing a general command framework.

## Scope
### In Scope
- One shared source for New session, Close tab, Archive session, Restart server, Open folder…, and Open settings definitions, availability, and execution.
- Both the composer slash menu and quickswitcher consume that source.
- Keep the quickswitcher's `/ Actions` scope, fuzzy search, Tab cycling, icons, and neutral styling.
- Retain Open folder… and Open settings in the quickswitcher and include them in the shared local action source.
- Share Restart server between both menus, preserving capability checks and the existing confirmation dialog.
- Use the existing composer error display for archive failures originating from either menu.

### Out of Scope
- Implementation during this planning task.
- Extension slash commands in the quickswitcher, argument entry, and argument completion there.
- Copying or replacing Pi's extension-command catalogue or execution path.
- A general action registry, plugin API, new server protocol, or changes to the session lifecycle.
- Changes to composer extension-command discovery, completion, insertion, or submission behavior.

## Requirements
- Define each shared local action's stable identifier, label, description, availability, and execution once. Both menus render projections of these same definitions rather than maintaining independent callback maps or action lists.
- Use existing application-controller operations: newSession, closeTab, archiveSession, and restartServer, plus existing folder-picker/settings overlay operations. Do not duplicate their transport or server implementations.
- Open folder… and Open settings retain their current behavior. Their shared definitions are available to both menus, including on Home.
- Restart server is offered only when the existing app.restart capability is available. Both menus use the same confirmation text and handler; cancelling must not restart the server.
- New session opens in the current project's folder when a session is active. On Home, preserve existing default-folder new-session behavior.
- Close tab is available only with an active session. It uses the existing close-tab behavior, not a separate palette-specific lifecycle.
- Archive session is available only when the active session has a session path and is not running or aborting, preserving the existing composer rule. Execution archives that session through the existing controller.
- Menu activation targets the active session represented by the current menu state; a tab change or session closure refreshes availability and must not leave an executable stale result targeting a different session.
- Connection and busy-state guards relevant to each operation are shared, not implemented separately by each menu. Do not unnecessarily disable New session or Close tab merely because an independent session is running.
- Shared execution exposes failures consistently through the existing composer error display. Share the underlying session-scoped archive error state so failures from the quickswitcher remain visible after it closes; do not create a separate toast or archival error-handling implementation.
- The composer's local action selection continues to clear its input and run the action. Its literal /archive shortcut must reuse the same archive execution path.
- The quickswitcher closes on activation and invokes the selected shared session action. Selecting it does not insert command text or initiate argument completion.
- Menu-specific presentation and dismissal remain local: composer input clearing and quickswitcher closure are not part of the session operation itself.
- Remove the quickswitcher-only fixed action identifier union, duplicated built-in labels, and separate New session / Open folder / Settings callback wiring where superseded by shared definitions.
- Keep extension commands and their argument completions unchanged in the composer. No extension command handlers are executed through the shared local-session-action source.
- Preserve `/` as the Actions filter and Tab/Shift+Tab wraparound. Keep action results discoverable in nonempty unscoped search and preserve recent sessions for an empty unscoped query.
- Verify shared definitions and availability with unit tests; both menu integrations must demonstrate equivalent execution and appropriate input/dismissal behavior. Browser coverage must retain scope sizing, visible keyboard selection, Tab cycling, and Home shortcut access.

## Assumptions
- “Session commands/actions” means the composer's parameter-free local New session, Close tab, and Archive session actions, not extension commands that happen to accept no arguments.
- Restart server, Open folder…, and Open settings are local application actions, not extension slash commands; they are explicitly included in the shared source.
- New session remains available on Home; Close tab and Archive session do not.
- A small shared session-action module/hook is sufficient. It should sit outside either menu's UI folder and accept/use existing application state and operations; no new generic registry is needed.
- This follow-up expands the quickswitcher plan's original three built-in actions with Close tab, Archive session, and Restart server; it preserves Open folder and Settings and does not change navigation/search behavior.

## Implementation Plan
### 1. Extract Shared Session Actions
Description: Extract New session, Close tab, Archive session, and Restart server definitions and execution from ComposerContainer into one small shared source; include Open folder… and Open settings using existing overlay operations. Share archive error state while retaining the existing composer error display. Make the composer and its /archive shortcut consume it without changing extension-command behavior. Verify labels, identifiers, availability on Home/active/running sessions, restart capability/confirmation, overlay operations, and controller calls with unit and composer integration tests.

### 2. Consume Session Actions in the Quickswitcher
Description: After slice 1, replace the quickswitcher's hard-coded three-action list and optional callback props with the shared session actions. Keep action search and rendering generic enough to project those definitions, not to register arbitrary commands. Retain Open folder and Settings results alongside the shared session actions and capability-gated Restart server. Verify action parity, active-session changes, Home availability, failure visibility, and palette dismissal with focused integration tests.

### 3. Verify Shared Behavior and Navigation
Description: After both consumers use the shared source, add regression coverage for all six shared actions from each menu, including busy/missing-session guards, restart confirmation/cancellation, overlay transitions, and failed archive handling in the existing composer error display. Retain browser coverage of Cmd+O, scope cycling, and visible keyboard selection. Run typecheck/build, web tests, and browser tests; separately document any unrelated full-suite baseline failures.

## Open Questions
None.
