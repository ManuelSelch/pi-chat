# Plugin host integration

- [Chat's Node host](../packages/pi-chat/src/host/index.ts) awaits `createPiServer` before installing routes or listening.
- Pi Server accepts explicit `plugins`, activates host entries once per server instance and resolves after readiness. It activates no defaults; Chat registers the file-opening and folder-opening providers.
- Startup precedes HTTP/WebSocket construction; failure rolls back rather than exposing a partially ready server. Server actions are available after readiness, not during setup.
- Server close owns transport, plugin and session teardown; Chat owns its injected logger, signals and PID records.
- Session-level Pi extensions remain distinct from server-scoped plugin activation.
- Host runtime implementation/tests belong to [Pi Server](../packages/pi-server/README.md), not Chat. See its [lifecycle guide](../packages/pi-server/docs/PLUGINS.md).
- Chat passes `fileOpeningContract` and `folderOpeningContract` in `pluginRpcContracts`. Negotiated, server-scoped `plugin.call` uses `/ws`; only allowlisted contracts/revisions/methods are callable. Provider validation and sanitized RPC errors remain Server-owned.
- `AppControllerProvider` composes the browser [file-opening entry](../packages/pi-chat/src/plugins/file-opening/index.ts) with the generic request boundary from `usePiChat`. File policies and OS behavior are documented [with the feature](../packages/pi-chat/src/plugins/file-opening/README.md).
- Folder browsing uses the [folder-opening entry](../plugins/folder-opening/src/web/index.ts) and its standalone allowlisted host provider; Chat owns session creation and picker overlay state. Browsing errors remain actionable and requests can be cancelled locally.
- No web plugin loader, push subscriptions or dynamic installation is wired into Chat.
