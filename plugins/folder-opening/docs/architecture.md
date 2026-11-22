# Folder-opening architecture

- Package entries: root = canonical plugin declaration + contract/types, `/web` = browser contributions/client/picker, `/host` = provider/filesystem service.
- [General boundaries](../../../docs/plugins.md) and [host lifecycle](../../../docs/plugin-runtime.md) describe shared infrastructure.

## Browser ownership

- Chat registers `folderOpeningPlugin` in both runtimes. Server loads its host entry; browser startup loads `folderOpeningUI` through its web entry before rendering. UI has no separate ID. It supplies only the generic SDK request, connection/project context, session creation/navigation and modal-focus capabilities.
- `FolderOpeningProvider` owns open state and host capabilities in a private React context. The static `folder-opening.open` command binds its action from that context; the Overlay component reads the same state.
- Plugin-owned `FolderPickerContainer` reads its provider context, constructs the browsing client, applies host focus handling and binds `FolderPicker`; its hook owns listing/navigation, errors and cancellation. The view receives values/callbacks.
- Chat's generic outlet renders the overlay. No picker import, feature overlay field or browsing method is required in Chat's controller.
- Picking a folder calls host session creation/navigation, not the browsing RPC. Success closes the picker; failure stays inline.
- Connection/project updates preserve plugin state. Disconnect disables browsing/creation; reconnect refreshes through the current client.
- Close/unmount aborts outdated local waits and ignores stale results; this does not cancel filesystem work remotely.

## Loading and injection

- The root declaration lazily imports both entries. Its host import uses `@vite-ignore` so Vite never traverses Node-only dependencies into browser chunks; it is only invoked on Node.
- `/host` exports `createFolderOpeningHost(directories)` returning a host entry, not a second plugin. Tests inject a browsing service directly; an embedding can override the canonical declaration's host loader with that entry when needed.
- `createFolderClient(request)` is a browser RPC helper, not a plugin definition. Server activation does not load React; packed headless verification runs without browser peers installed.

## Browsing over RPC

- Plugin client → host request boundary → current `PiClient.plugin(folderOpeningContract).browse` → existing WebSocket `plugin.call`.
- Server checks the allowlist, contract version and method, validates input, dispatches to the folder host provider and validates output.
- The host filesystem service canonicalizes paths, lists/paginates directories and returns a listing or classified safe folder error.
- The SDK validates output; the browser client turns safe failures into `SDKError` for the picker to display.
- Unexpected filesystem exceptions become a generic `operationFailed` result; dispatcher/validation failures reject the RPC.
- Contract and [named schemas](../src/schemas.ts) are shared by browser and host. Absent optional fields are omitted for JSON safety.
- Server separately reuses the directory service for existing `directory.browse` and session-path validation; these paths do not activate or call the plugin RPC.
