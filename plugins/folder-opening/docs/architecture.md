# Folder-opening architecture

- Package entries: root = contract/types, `/web` = browser contributions/client/picker, `/host` = provider/filesystem service.
- [General boundaries](../../../docs/plugins.md) and [host lifecycle](../../../docs/plugin-runtime.md) describe shared infrastructure.

## Browser ownership

- Chat registers `folderOpeningWebPlugin` once in its browser plugin list. It supplies only the generic SDK request, connection/project context, session creation/navigation and modal-focus capabilities.
- The plugin's `useFolderContributions` owns open state and contributes `folder-opening.open` to menus/Projects plus its picker overlay.
- Plugin-owned `FolderPickerContainer` constructs the browsing client, applies host focus handling and binds `FolderPicker`; its hook owns listing/navigation, errors and cancellation. The view receives values/callbacks.
- Chat's generic outlet renders the overlay. No picker import, feature overlay field or browsing method is required in Chat's controller.
- Picking a folder calls host session creation/navigation, not the browsing RPC. Success closes the picker; failure stays inline.
- Connection/project updates preserve plugin state. Disconnect disables browsing/creation; reconnect refreshes through the current client.
- Close/unmount aborts outdated local waits and ignores stale results; this does not cancel filesystem work remotely.

## Browsing over RPC

- Plugin client → host request boundary → current `PiClient.plugin(folderOpeningContract).browse` → existing WebSocket `plugin.call`.
- Server checks the allowlist, contract version and method, validates input, dispatches to the folder host provider and validates output.
- The host filesystem service canonicalizes paths, lists/paginates directories and returns a listing or classified safe folder error.
- The SDK validates output; the browser client turns safe failures into `SDKError` for the picker to display.
- Unexpected filesystem exceptions become a generic `operationFailed` result; dispatcher/validation failures reject the RPC.
- Contract and [named schemas](../src/schemas.ts) are shared by browser and host. Absent optional fields are omitted for JSON safety.
- Server separately reuses the directory service for existing `directory.browse` and session-path validation; these paths do not activate or call the plugin RPC.
