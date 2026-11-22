# Folder-opening architecture

- Package entries: root = runtime-selected plugin declaration + shared contract/types, `/web` = web plugin definition + browser contributions/client/picker, `/host` = host plugin definition + provider/filesystem service.
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

- Root conditional exports select `browser` → `web/index.ts` or `node` → `host/index.ts`, each statically importing only its own implementation. Both share `contract.ts`, the plugin ID and contract exports; their loaders return entries synchronously. Importing a definition does not activate its host or mount its UI.
- Vite selects `browser`; browser TypeScript consumers use `customConditions: ["browser"]`. Node uses the host definition without loading browser peers. Implementations import the shared contract directly, never the runtime-selected root.
- Public `host/index.ts` and `web/index.ts` keep each plugin definition beside its host factory or UI contribution object and re-export shared contracts/types. The host factory remains injectable; filesystem services and UI components/state stay in their existing modules.
- `/host` also exports `createFolderOpeningHost(directories)` returning an injectable host entry, not a second plugin. Tests inject a browsing service directly; an embedding can override the canonical declaration's host loader with that entry when needed.
- `createFolderClient(request)` is a browser RPC helper, not a plugin definition. Node imports and Server activation do not load React; packed headless verification runs without browser peers installed.

## Browsing over RPC

- Plugin client → host request boundary → current `PiClient.plugin(folderOpeningContract).browse` → existing WebSocket `plugin.call`.
- Server checks the allowlist, contract version and method, validates input, dispatches to the folder host provider and validates output.
- The host filesystem service canonicalizes paths, lists/paginates directories and returns a listing or classified safe folder error.
- The SDK validates output; the browser client turns safe failures into `SDKError` for the picker to display.
- Unexpected filesystem exceptions become a generic `operationFailed` result; dispatcher/validation failures reject the RPC.
- Contract and [named schemas](../src/schemas.ts) are shared by browser and host. Absent optional fields are omitted for JSON safety.
- Server separately reuses the directory service for existing `directory.browse` and session-path validation; these paths do not activate or call the plugin RPC.
