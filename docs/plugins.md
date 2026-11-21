# Plugin boundaries

- Shared declarations come from `@manuelselch/pi-sdk/plugins`; Chat owns no copy of the primitives or host runtime.
- The SDK's `/plugins/file-opening` and `/plugins/folder-opening` entries own the built-in contracts and inferred request/client types.
- Pi Server owns `createPluginRuntime` under `@manuelselch/pi-server/plugins` and manages it through async server creation/close.
- Chat explicitly activates and allowlists Server's file-opening and folder-opening host providers. Typed `plugin.call` RPC uses the existing WebSocket.
- The [file-opening entry](../packages/pi-chat/src/plugins/file-opening/index.ts) composes browser actions in `AppControllerProvider`; `usePiChat` owns only the generic SDK connection/request boundary. Feature-specific duplicate-click and runtime-removal policies are not required plugin boilerplate.
- [Host integration](plugin-runtime.md) covers Chat's startup boundary; detailed contracts/lifecycle live in the [SDK guide](../packages/pi-sdk-typescript/docs/PLUGINS.md) and [Server guide](../packages/pi-server/docs/PLUGINS.md).
- Package ownership, local linking and imported history are recorded in the [monorepo guide](monorepo.md).
- The [folder-opening entry](../packages/pi-chat/src/plugins/folder-opening/index.ts) owns the picker and browsing client; Chat supplies the session-creation action and overlay state. The picker retains its existing layout and behavior.
- Web plugin activation and dynamic installation remain unimplemented; browser entries are app-composed.
