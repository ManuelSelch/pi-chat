# Host plugins and RPC

## Getting started

- Await `createPiServer({ plugins })` before listening. Plugins activate once per server, before HTTP and WebSocket construction; no feature plugins are enabled by default.
- Import the runtime from `@manuelselch/pi-server/plugins`; feature factories and contracts belong to separate plugin packages. Shared declaration/contract primitives come from `@manuelselch/pi-sdk/plugins`.
- Plugin activation alone does not expose a contract remotely. Add its contract to `pluginRpcContracts` to opt in.
- Server plugins are independent of agent sessions. The server ignores web entries; browser activation and UI slots belong to the embedding application. Pi extensions remain session-scoped.

## Lifecycle and local calls

- [`createPluginRuntime(plugins)`](../src/plugins/runtime.ts) creates an isolated registry. `start()` loads host entries sequentially in caller order; concurrent starts share one attempt. A failed or disposed runtime cannot restart.
- `setup(ctx)` receives `signal`, `provide(contract, implementation)` and `onCleanup(callback)`. Register cleanup before asynchronous work and honor the signal after each await.
- Providers must match a declared contract ID and revision, implement every declared method, and be unique. Undeclared methods are not exposed. Required contracts are checked after all setups, not used to sort dependencies.
- `runtime.client(contract)` creates typed async methods. Calls require completed startup and a matching provider; the provider's validators check inputs and outputs. Change the revision when shapes change: matching IDs and revisions does not compare schemas.
- Local calls preserve handler errors. Results completing after disposal are rejected, but side effects cannot be undone.
- `dispose()` withdraws providers, aborts activations, waits for pending loading and setup, then runs cleanups in reverse order. Repeated disposal shares one promise. Late registrations throw.
- Startup failure rolls back partial and earlier activations. All cleanups are attempted; `AggregateError` preserves combined failures. Cleanups must not register resources or await their own runtime's disposal.
- Cancellation is cooperative: unresponsive loading, setup, handlers or cleanup cannot be forcibly stopped. There are no deadlines, per-call cancellation, hot reload or sandboxing.
- Server close releases the extension binding, transport, HTTP listener, plugins and sessions in that order, attempting every step. Bootstrap failure also rolls back owned resources. Injected loggers remain caller-owned.
- [Runtime tests](../test/modules/server/plugins/runtime.test.ts) and [bootstrap tests](../test/modules/server/bootstrap/plugins.test.ts) cover lifecycle, validation, rollback and disposal races.

## WebSocket RPC

- `plugin.call` uses the existing initialized `/ws` connection and negotiated capability. Its server-scoped parameters are `contractId`, `contractVersion`, `method` and JSON `input`; successful responses contain `{ value }`.
- The [dispatcher](../src/transport/plugin-rpc.ts) checks the allowlisted ID, exact revision and method, then uses the local runtime client. Provider validation remains authoritative, non-JSON output is rejected, and handler/validator errors become sanitized `operationFailed` responses.
- SDK clients use `client.plugin(contract)` to call contract methods. Existing connection limits and request timeouts apply. Disconnect, stop, disposal or timeout leaves pending outcomes unknown; there is no replay, rollback or remote cancellation.
- [Socket scenarios](../test/integration/plugin-rpc.test.ts) cover shared and independent server state, reconnect, shutdown, initialization and restricted dispatch. [Dispatcher tests](../test/modules/server/transport/plugin-rpc.test.ts) cover validation, sanitization and JSON boundaries.
- No browser rendering, subscriptions, contract discovery or per-user authorization is added. Existing private-endpoint authentication and origin policy are unchanged.

## Folder browsing

- Import `folderOpeningPlugin` and `folderOpeningContract` from `@manuelselch/pi-plugin-folder-opening`. Opt in with `plugins: [folderOpeningPlugin]` and allowlist that contract. Server loads only the host entry; browser peers are not required.
- `/host` exports `createFolderOpeningHost(directories)` for injected browsing services. It returns a host entry; override the canonical declaration's host loader for custom dependencies rather than defining a second identity.
- The plugin owns filesystem browsing without creating a session. Server owns independent core project-path validation; it does not import the browser service. The original `directory.browse` wire operation is removed. Classified safe failures are preserved; unexpected exceptions are sanitized. Optional listing fields are omitted instead of returned as non-JSON `undefined`.
- [Folder scenarios](../test/integration/folder-opening-plugin.test.ts) cover real SDK/WebSocket calls, navigation, safe failures and explicit exposure. Session creation remains separate.

## File opening

- Import `createFileOpeningPlugin` from `@manuelselch/pi-plugin-file-opening/host` and `fileOpeningContract` from `@manuelselch/pi-plugin-file-opening`. Opt in with `plugins: services => [createFileOpeningPlugin(services)]` and allowlist the contract. Server actions are usable after readiness, not during setup.
- The provider accepts `{ sessionId, path }`. The session ID is the public runtime incarnation ID; raw adapter IDs, closed or replaced IDs, and unknown sessions cannot select a runtime.
- The plugin owns `FileService`, filesystem validation and OS opening; Server supplies only `getSession(publicSessionId): Promise<{ projectPath }>` after readiness. The plugin constructs its service (or accepts an injected service as the factory’s second argument) and classifies lookup failures as `sessionUnavailable`.
- Results are `{ ok: true }` or `{ ok: false, error }`. Existing canonicalization, readable-regular-file validation, bounded macOS opening and no-retry semantics apply. Files open on the server, not the browser; this does not reveal in Finder or browse folders.
- [File scenarios](../test/integration/file-opening-plugin.test.ts) cover named sessions, failures and explicit exposure with real temporary files and a fake OS opener. The original `file.open` wire operation and SDK convenience method are removed; there is no fallback. Omitting the plugin removes the capability.
