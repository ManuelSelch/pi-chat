# Plugin boundaries

- Shared declarations come from `@manuelselch/pi-sdk/plugins`; Chat no longer owns a copy of the primitives or host runtime.
- The SDK's separate `/plugins/file-opening` entry owns the built-in file-opening contract and inferred request/client types.
- Pi Server owns `createPluginRuntime` under `@manuelselch/pi-server/plugins` and manages it through async server creation/close.
- Chat's [file-opening adapter](../src/plugins/file-opening/README.md) calls the SDK contract through the existing connection. Server's opt-in `createFileOpeningPlugin` owns the host provider; Chat explicitly activates and allowlists it.
- [Host integration](plugin-runtime.md) describes Chat's startup boundary; detailed contracts/lifecycle live in the installed [SDK guide](../node_modules/@manuelselch/pi-sdk/docs/PLUGINS.md) and [Server guide](../node_modules/@manuelselch/pi-server/docs/PLUGINS.md) after `npm ci`.
- Candidate artifacts, source revisions and integrity are recorded in [dependency provenance](../vendor/README.md).
- The [counter demo](counter-demo.md) registers a Chat-owned host plugin/contract and a normal Chat header panel. Typed `plugin.call` RPC runs over the existing WebSocket, restricted by the host's explicit contract allowlist.
- Web plugin activation and dynamic installation remain unimplemented. The counter panel and file-link actions are app-composed; existing file-opening behavior and the folder picker are unchanged.
