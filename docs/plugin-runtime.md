# Plugin host integration

- [Chat's Node host](../src/host/index.ts) awaits `createPiServer` before installing routes or listening.
- Pi Server accepts explicit `plugins`, activates host entries once per server instance and resolves after readiness. It activates no defaults; Chat registers the file-opening provider.
- Startup precedes HTTP/WebSocket construction; failure rolls back rather than exposing a partially ready server. Server actions are available after readiness, not during setup.
- Server close owns transport, plugin and session teardown; Chat owns its injected logger, signals and PID records.
- Session-level Pi extensions remain distinct from server-scoped plugin activation.
- Host runtime implementation/tests belong to [Pi Server](https://github.com/ManuelSelch/pi-server), not Chat. See its installed [lifecycle guide](../node_modules/@manuelselch/pi-server/docs/PLUGINS.md) after `npm ci`.
- Chat passes `fileOpeningContract` in `pluginRpcContracts`. Negotiated, server-scoped `plugin.call` uses `/ws`; only allowlisted contracts/revisions/methods are callable. Provider validation and sanitized RPC errors remain Server-owned.
- `AppControllerProvider` composes the browser [file-opening entry](../src/plugins/file-opening/index.ts) with the generic request boundary from `usePiChat`. File policies and OS behavior are documented [with the feature](../src/plugins/file-opening/README.md).
- No web plugin loader, push subscriptions or dynamic installation is wired into Chat.
