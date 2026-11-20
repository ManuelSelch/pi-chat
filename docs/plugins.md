# Plugin primitives

- Local, unpublished primitives live in [`src/plugins/sdk`](../src/plugins/sdk/index.ts); they do not change the installed Pi SDK or Server API.
- `definePlugin` declares an ID, provided/required remote contracts, and lazy host/web entry loaders. It requires at least one entry and never loads or activates it.
- `defineRemoteContract` declares a namespaced ID, positive integer revision, and methods with explicit input/output validators. Revisions are exact identifiers, not compatibility ranges.
- Validators implement synchronous `parse(unknown)`; existing Zod schemas satisfy this structural interface without a new dependency. Portable schema export and JSON-serializability checks are not implemented.
- `RemoteContractClient` and `RemoteContractImplementation` derive client/handler types from validator outputs. [The host runtime](plugin-runtime.md) binds local clients; network RPC is not implemented.
- Declarations copy/freeze their containers without freezing caller-owned validators or loading feature implementations.
- Provided contracts must use their plugin's namespace. Duplicate IDs within provided/required lists are rejected; the runtime also rejects duplicate plugin IDs and active providers.
- Host entries expose `setup(ctx)` with an activation signal, typed `provide` and `onCleanup`. Web activation, dependency sorting, transport, events and state replication are not implemented.
- [File opening](../src/plugins/file-opening/README.md) uses these declarations but remains inactive. Existing file-opening behavior and wire routing are unchanged.
