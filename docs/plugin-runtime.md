# Plugin host integration

- [Chat's Node host](../src/host/index.ts) awaits `createPiServer` before installing routes or listening.
- Pi Server accepts explicit `plugins`, activates host entries once per server instance, and resolves only after readiness. Pi Server activates no defaults; Chat explicitly registers the counter and file-opening plugins.
- Plugin startup precedes HTTP/WebSocket construction; failed startup rolls back instead of exposing a partially ready server.
- Server close owns transport, plugin and session teardown; Chat still owns its injected logger, signals and PID records.
- Session-level Pi extensions remain distinct from server-scoped plugin activation.
- Host runtime implementation/tests are owned by [Pi Server](https://github.com/ManuelSelch/pi-server), not copied into Chat. See its installed [lifecycle guide](../node_modules/@manuelselch/pi-server/docs/PLUGINS.md) after `npm ci`.
- Chat's host passes the demo's `counterContract` in `pluginRpcContracts`. The SDK's negotiated, server-scoped `plugin.call` operation uses `/ws`; only allowlisted contracts/revisions/methods are callable. Provider validation and sanitized errors remain Server-owned.
- The browser obtains typed clients through the single `usePiChat` SDK owner. The [counter demo](counter-demo.md) owns its panel read/pending/error state, not the count; count belongs to each host activation.
- File opening uses `plugins: services => [createFileOpeningPlugin({ open: services.openFile }), ...]` and an explicit `fileOpeningContract` allowlist entry. Server actions are available only after readiness, not during setup; startup still precedes HTTP/WebSocket resources.
- Server translates public runtime incarnation IDs through its publisher before resolving the named session project path. The provider returns structured file results; Chat maps failures into its existing ephemeral notices. The browser adapter owns duplicate-click coalescing and local wait cancellation on runtime removal.
- No web plugin loader, push subscriptions or dynamic installation is wired into Chat. File opening has no fallback to the separate `file.open` operation.
