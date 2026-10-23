# Pi Server (S2 package preparation)

Independent compiled v2 host prepared inside Pi Chat. Repository extraction and Chat cutover remain S3/S4. Do not edit the separate SDK repositories here. Source attribution and pinned SDK artifact checksum are in [SOURCE.json](SOURCE.json). No Pi Chat license grant existed at the source revision; resolve licensing before publication.

## Build and verify

Requires Node >=22.19 (CI: Node 24).

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run verify:package
npm pack
```

The package uses its own lockfile, not the Chat workspace. `verify:package` installs compiled tarballs in a private temporary consumer, checks SDK initialization/public declarations and runs CLI/restart/fixture scenarios without Chat sources, frontend dependencies or tsx. All test agent/history/metadata storage is private. The SDK tarball is vendored with its original revision/hash; npm bundles the installed SDK and its dependency closure so the server tarball never resolves a developer-local SDK path.

Pi 1.0.2 uses broad internal ranges. Pinning its working dependency family (agent-core/AI 1.0.2; codemode/MCP/TUI/telemetry/chord 1.0.3) prevents incompatible upgrades in consumers where package overrides would be ignored. Keep these pins until a separately verified Pi update.

## CLI

```sh
pi-server --host 127.0.0.1 --port 8788 --project /path/to/project
pi-server --static-directory /path/to/assets --pid-file /path/to/server.pid --log-directory /path/to/logs
```

Headless by default: `/health` and `/ws`, no session creation or browser launch. Explicit static hosting supplies SPA fallback. Relative flags resolve against the invocation directory; `--project` selects process cwd, while session create/open still use protocol paths and existing default home-folder behavior. Port 0 selects an ephemeral port. `--no-restart` disables restart for external supervisors. Standalone restart re-executes compiled JS without a build; the current waiter uses POSIX `/bin/sh`. SIGINT/SIGTERM dispose listeners/runtimes and flush logs. PID record is `{ pid, port, cwd }`; log filename remains `pi-chat.log` for compatibility. No CLI read of `PI_CHAT_HOST/PORT/CWD/PID_FILE`; the Chat adapter remains responsible for those settings.

This is a private local backend, not an authenticated public service. Keep loopback defaults; auth/TLS belong to a trusted proxy. Existing Origin checks and v2 controller semantics remain unchanged.

## Public API ownership

- Root: `createPiServer(options)`, `createPiRuntimeAdapter(runtime)`, `createRestartService(options)`, `createFileLogger(options)` and their structural contracts.
- Server options: runtime/factory, optional static directory, restart, extensions, structural file-open service, logger and catalogue configuration (lister, session directory, discovery, metadata file, home directory; null suppresses home).
- Handle: `httpServer` for listen/address/error ownership; idempotent async `close()`. Close disposes transport and runtimes; callers flush/close injected loggers. Runtime creation stays lazy.
- `/extensions`: existing registration types and registry functions, retaining `Symbol.for("pi-chat.extension-registry")`. Test reset is not exported here.
- `/testing`: compiled fake runtime, fixture data and registry reset; no test-framework runtime dependency.
- `/testing/loopback`: `runLoopbackFixture()`. A plain-Node launcher imports and awaits it, with no arguments. It creates a private canonical workspace, binds ephemeral loopback, rejects other project paths, prints `PI_FIXTURE_READY { directory, endpoint }`, and on SIGTERM explicitly closes retained runtimes and exclusively writes `cleanup.json`. The test driver removes successful artifacts.
- No exports for concrete transport/application/catalogue/mapping internals. SDK `/protocol` remains authoritative.

## Transitional ownership

The staged server/helper/fake/fixture sources derive from the recorded Chat revision. Chat's current sources and launcher stay untouched until S4, so it continues to run its existing build-before-restart policy. The new generic restart accepts an explicit build callback; failure must keep the old process serving. Server tests here cover package seams; existing server-internal tests remain in Chat until S3/S4 ownership migration. Any intervening backend fix must be reconciled before extraction; this directory is temporary preparation, not a second long-term implementation authority.
