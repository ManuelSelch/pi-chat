# Plugin boundaries

- Shared declarations come from `@manuelselch/pi-sdk/plugins`; Chat no longer owns a copy of the primitives or host runtime.
- The SDK's separate `/plugins/file-opening` entry owns the built-in file-opening contract and inferred request/client types.
- Pi Server owns `createPluginRuntime` under `@manuelselch/pi-server/plugins` and manages it through async server creation/close.
- Chat's [file-opening entry](../src/plugins/file-opening/index.ts) declares a web entry and required host contract. It carries no host implementation and remains inactive.
- [Host integration](plugin-runtime.md) describes Chat's startup boundary; detailed contracts/lifecycle live in the installed [SDK guide](../node_modules/@manuelselch/pi-sdk/docs/PLUGINS.md) and [Server guide](../node_modules/@manuelselch/pi-server/docs/PLUGINS.md) after `npm ci`.
- Candidate artifacts, source revisions and integrity are recorded in [dependency provenance](../vendor/README.md).
- The [counter demo](counter-demo.md) registers a Chat-owned host plugin/contract and a normal Chat header panel. Typed `plugin.call` RPC runs over the existing WebSocket, restricted by the host's explicit contract allowlist.
- Web plugin activation, dynamic installation and new file-opening behavior remain unimplemented; the counter panel is app-composed, not a web plugin loader.
