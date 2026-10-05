# Remove Pi Chat's session rename feature

Status: implemented.

## Implementation notes

- Added `test/session-title.dom.test.tsx` and verified it passed on the original implementation before refactoring. It covers server snapshot projection, protocol parsing, browser reduction, rendered title refresh during a run, and clearing an old title.
- Browser title display now uses optional snapshot `sessionName`; the custom rename UI, dialog, overlay state, protocol action, runtime API, and fake-runtime plumbing are removed.
- Regression coverage also checks removed rename requests are rejected, snapshots no longer advertise rename, Settings/menu omit custom rename controls, and delete confirmation uses the current Pi title.
- The existing metadata-change event/publisher pipeline is unchanged.
- Verification: full Vitest suite passed (68 files / 484 tests), TypeScript and production build passed, and `git diff --check` passed. Build retains its bundle-size warning. No separate live-browser smoke was run; title display and controls were exercised in DOM regression tests.

## Goal

Remove Pi Chat's custom rename controls and action plumbing now that Pi session-title changes refresh automatically. Pi remains responsible for session naming; Pi Chat displays the current name.

## Findings

- Title refresh was added in `1f9414a`: Pi `session_info_changed` maps to `sessionMetadataChanged`, and the publisher refreshes the affected snapshot, tabs, and catalogue.
- `src/server/runtime/pi/snapshot.ts` already emits optional `sessionName` in `RuntimeSnapshot`.
- The WebSocket snapshot schema in `src/shared/protocol.ts` and `ChatState` in `src/web/app/state/chat-state.ts` do not declare/retain that field.
- `HeaderContainer.tsx` and `ComposerContainer.tsx` currently derive the title from the `session.rename` feature state. Simply deleting the feature would lose header and delete-confirmation names.
- Rename is offered both in Settings and as a local composer command-menu action, with its own overlay/dialog.

## Requirements

1. Remove the Settings session-name input/save control and the local **Rename session** command-menu action.
2. Remove the rename dialog, overlay state/actions, client callback, protocol feature/request variants, application dispatch branch, runtime contract/implementation, and fake-runtime equivalents.
3. Make optional snapshot `sessionName` the browser's authoritative session name. Retain it through protocol parsing and snapshot reduction; an absent name in a newer snapshot must clear an older name.
4. Use that field for the header and delete confirmation, preserving existing unnamed/home/connecting fallbacks.
5. Preserve automatic/manual Pi title refresh in active and background sessions, including during streaming, tab switching, and reconnect/reload. Metadata updates must not change run status, draft streaming content, or errors unintentionally.
6. Preserve existing names and manual/auto/none classification. Do not rewrite session files or change naming/cleanup policies.
7. Preserve generic Pi/extension slash-command discovery and execution. This removes only Pi Chat's custom rename feature, not naming capabilities exposed by Pi or installed extensions.
8. Preserve other Settings controls, local session actions, overlays, and generic `runFeature` infrastructure.

## Implementation slices

### 1. Decouple displayed names from rename

- Add `sessionName?: string` to the snapshot schema in `src/shared/protocol.ts` and to `ChatState`.
- Project it in the snapshot reducer in `src/web/app/state/chat-state.ts`.
- Update `src/web/app/shell/HeaderContainer.tsx` and `src/web/chat/composer/ComposerContainer.tsx` to read the snapshot name.
- Add parsing/reducer/display tests, including title changes and clearing a previously named session.
- Keep server snapshot projection and the metadata refresh pipeline intact.

Acceptance: titles display and refresh without consulting a rename feature.

### 2. Remove browser rename controls

- Remove rename UI/state/imports/props from `src/web/settings/SettingsDrawer.tsx` and `SettingsContainer.tsx`.
- Remove the local rename menu action from `ComposerContainer.tsx`.
- Remove `RenameSessionDialog.tsx` and its wiring in `src/web/app/overlays/AppOverlays.tsx`.
- Remove `renamingSession` and `requestRename` from `OverlayController.tsx`, simplifying overlay open/close handling.
- Remove `renameSession` from `src/web/app/use-pi-chat.ts`.
- Update Settings and overlay DOM tests; add coverage that no custom rename control/action remains while unrelated controls still work.

Acceptance: no Pi Chat rename affordance remains, and overlay focus/closing behavior is unchanged.

### 3. Remove server/protocol rename action

- Remove `session.rename` from `webFeatureSchema` and the `runFeature` request union in `src/shared/protocol.ts`.
- Remove its advertisement from `src/server/runtime/pi/snapshot.ts`.
- Remove dispatch from `src/server/application/feature-actions.ts`.
- Remove `renameSession` from `src/server/runtime/contracts.ts`, `src/server/runtime/pi/pi-runtime-adapter.ts`, and `test/support/fake-runtime-adapter.ts`.
- Replace the protocol's positive rename-request test with rejection coverage. Verify snapshots no longer advertise the feature.
- Do not add a deprecated alias or compatibility shim. Assume client/server deployment together; stale browser clients must reload.

Acceptance: removed rename requests are rejected by validation; other feature actions still work.

### 4. Update docs and verify

- Remove rename from the README's command-menu shortcut description.
- Update the future Tabs driver contract in `docs/integration-tests/REQUIREMENTS.md` to remove the planned `Rename(name)` capability.
- Keep historical organization notes as history; remove misleading current references where appropriate.
- Replace rename-labelled generic menu-test fixtures with another local action where useful; retain generic filtering/ordering coverage.
- Run focused protocol, reducer, Settings, overlays, composer, and `test/session-name-refresh.test.ts` tests.
- Run `npm test`, `npx tsc --noEmit`, `npm run build`, and `git diff --check`.
- Search source/tests for remaining `session.rename`, `renameSession`, `requestRename`, and `renamingSession`; only intentional rejection tests may remain.
- Browser smoke: confirm Settings/menu have no custom rename action, trigger a Pi-owned title change, and verify header/tabs/project list/delete confirmation. Include a background session and reload.

Acceptance: full verification passes and title refresh remains intact without rename plumbing.

## Non-goals

- Replacing rename with another custom naming UI or command.
- Removing the action registry, session metadata events, or generic extension commands.
- Changing title generation, session persistence, title-source badges, or session deletion/cleanup.
- Refactoring unrelated UI/server organization.

## Assumptions

- Implementation was authorized after the plan, with an explicit request to add and run a title-display regression first.
- Client and server are updated together; no backwards-compatible rename endpoint is required.
- No session-data migration is needed.
