# Plugin boundaries

- Shared declarations come from `@manuelselch/pi-sdk/plugins`; Chat owns no copy of the primitives or host runtime.
- The SDK's `/plugins/file-opening` entry owns the built-in contract and inferred request/client types.
- Pi Server owns `createPluginRuntime` under `@manuelselch/pi-server/plugins` and manages it through async server creation/close.
- Chat explicitly activates and allowlists Server's file-opening host provider. Typed `plugin.call` RPC uses the existing WebSocket.
- The [file-opening entry](../src/plugins/file-opening/index.ts) composes browser actions in `AppControllerProvider`; `usePiChat` owns only the generic SDK connection/request boundary. Feature-specific duplicate-click and runtime-removal policies are not required plugin boilerplate.
- [Host integration](plugin-runtime.md) covers Chat's startup boundary; detailed contracts/lifecycle live in the installed [SDK guide](../node_modules/@manuelselch/pi-sdk/docs/PLUGINS.md) and [Server guide](../node_modules/@manuelselch/pi-server/docs/PLUGINS.md) after `npm ci`.
- Candidate sources/integrity are recorded in [dependency provenance](../vendor/README.md).
- Web plugin activation and dynamic installation remain unimplemented. File actions are app-composed; the folder picker is unchanged.
