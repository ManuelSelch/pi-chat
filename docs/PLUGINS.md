# Plugin contracts and declarations

- Public entry `@manuelselch/pi-sdk/plugins` exports `definePlugin`, `defineRemoteContract` and their types. It contains no host runtime, React, Pi or Node implementation.
- `definePlugin` declares an ID, provided/required contracts and lazy host/web loaders; it does not activate anything. Declarations copy/freeze containers without freezing validators.
- IDs are namespaced; provided contracts must belong to the plugin. Duplicate IDs within provided/required lists are rejected.
- `defineRemoteContract` declares an ID, positive integer revision and methods with explicit synchronous input/output `parse(unknown)` validators. Existing Zod schemas work; JSON Schema export/JSON-serializability checks are not implemented.
- `RemoteContractClient` derives async method types; `RemoteContractImplementation` derives sync/async handlers. Contract revisions match exactly, independently of package/wire versions.
- `HostPluginContext` defines typed `provide`, `onCleanup` and a structural `CancellationSignal`; declarations compile without DOM or Node types.
- Pi Server owns host activation, instance registries, validation dispatch and cleanup. Web activation and plugin network RPC are not implemented.
- Separate entry `@manuelselch/pi-sdk/plugins/file-opening` owns the built-in file-opening contract and inferred types. It reuses current protocol validators and requires an explicit runtime ID plus server-local path.
- The file-opening contract is declarative only: existing `file.open` wire behavior is unchanged and the plugin scaffold is not activated.
- [Declaration tests](../test/plugins/definitions.test.ts), [file-opening tests](../test/plugins/file-opening.test.ts) and the packed ES-only consumer protect inference, validation and package isolation.
