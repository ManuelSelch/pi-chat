# Local host plugin runtime

- [`createPluginRuntime(plugins)`](../src/plugins/runtime.ts), exported from `@manuelselch/pi-server/plugins`, creates an isolated registry. Shared declarations come from `@manuelselch/pi-sdk/plugins`.
- `start()` loads host entries sequentially in caller order; web entries are ignored. Repeated/concurrent starts share one attempt. Failed/disposed runtimes cannot restart.
- `setup(ctx)` receives `signal`, `provide(contract, implementation)` and `onCleanup(callback)`. Register cleanup before asynchronous work and honor the signal after each await.
- A provider must match a declared contract ID/revision and implement all its methods. Duplicate providers are rejected; undeclared methods are not exposed.
- Required contracts on host entries are checked for exact revisions after all setups, before readiness. This does not sort dependencies or allow client calls during setup.
- `runtime.client(contract)` creates typed async methods without activating anything. Calls require completed startup and a matching active provider revision.
- Calls use the provider's canonical input/output validators. Contract authors must change the revision when changing shapes; ID/revision matching is not schema-equivalence checking.
- Calls preserve handler errors; no network error sanitization or serialization boundary is claimed. A result finishing after disposal is rejected, but side effects cannot be undone.
- `dispose()` immediately withdraws providers and aborts activations, waits for pending loading/setup, then runs cleanups in reverse registration/activation order. Concurrent/repeated disposal shares one promise.
- Startup failure performs the same withdrawal/cleanup for partial and earlier activations. Every cleanup is attempted; failures are reported with `AggregateError`, preserving startup errors when both fail.
- Late provider/cleanup registrations throw after activation ends. Cleanups must not register new resources or await their own runtime's disposal.
- Cancellation is cooperative: unresponsive loading, setup, handlers or cleanup cannot be forcibly stopped. There are no deadlines, per-call cancellation, hot reload or sandboxing.
- [Unit tests](../test/modules/server/plugins/runtime.test.ts) cover local lifecycle, validation, rollback and disposal races. They do not verify network or UI integration.
- `await createPiServer({ plugins })` starts explicit host plugins before constructing HTTP/WebSocket resources and returns an unbound server only after readiness. CLI/embedders must await it before listening. No default feature plugins are activated.
- Server close releases the extension binding, terminates transport, closes HTTP, disposes plugins, then sessions. Every teardown is attempted even after failure; injected loggers remain caller-owned.
- Plugin startup failure constructs no network/session resources. Later bootstrap failure tears down already-owned resources and active plugins; combined startup/cleanup errors are preserved.
- This activation is per server instance, not per agent session. Pi extensions retain session-scoped behavior. File opening remains an inactive host scaffold; plugin network RPC and browser activation are not implemented.
