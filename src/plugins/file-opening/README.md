# File-opening web plugin scaffold

- `index.ts` uses `definePlugin` from `@manuelselch/pi-sdk/plugins`; no per-plugin package or separate manifest.
- The entry requires the SDK-owned `/plugins/file-opening` contract and lazily exposes only `web.tsx`.
- Host scaffold/runtime ownership moved to Pi Server; Chat carries no backend entry or copied shared contract.
- Web setup deliberately throws until implementation; this plugin is not activated.
- Existing file opening is unchanged: explicit runtime identity, server-local paths and the existing server OS opener.
- Tests check the installed declaration boundary and explicit non-implementation, not a working web plugin.
- See [plugin boundaries](../../../docs/plugins.md).
