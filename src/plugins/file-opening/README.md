# File-opening plugin scaffold

- `index.ts` identifies the built-in and lazily exposes host/web entries.
- No per-plugin package or separate manifest; `index.ts` uses the local `definePlugin` primitive.
- `contract.ts` uses `defineRemoteContract` and installed SDK validators; no plugin transport exists.
- Host and web setup deliberately throw until implementation; nothing registers or activates them.
- Existing file opening is unchanged: server-local paths, explicit runtime identity, server OS opener.
- This colocated scaffold is not the final implementation ownership: host code belongs to Pi Server, web code to Pi Chat, and the contract needs a shared public export.
- Tests check declarations, schema validation and explicit non-implementation, not a working plugin or browser bundle isolation.
- See [plugin primitives](../../../docs/plugins.md) for the implemented declaration API and its limits.
