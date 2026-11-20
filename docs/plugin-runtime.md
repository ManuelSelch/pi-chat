# Local host plugin runtime

- [`createPluginRuntime(plugins)`](../src/plugins/sdk/runtime.ts) creates an isolated registry; there is no global state or installed SDK/Server change.
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
- [Unit tests](../src/plugins/sdk/__test__/runtime.test.ts) cover local lifecycle, validation, rollback and disposal races. They do not verify network or UI integration.
- File opening remains inactive; neither the application host nor browser starts this runtime yet.
