# Pi Server

A local HTTP/WebSocket host for Pi coding-agent sessions, with a compiled CLI, embedding API, extension integration and Pi v2 protocol support. Extracted from [Pi Chat](https://github.com/ManuelSelch/pi-chat).

## Install

Requires Node >=22.19; Node 24 is used in CI. Standalone restart currently requires POSIX `/bin/sh`.

```sh
npm install --global @manuelselch/pi-server
pi-server --host 127.0.0.1 --port 8788 --project /path/to/project
```

For embedding, install locally with `npm install @manuelselch/pi-server`. Configure Pi providers and credentials through your existing Pi installation; the server does not include provider credentials or a web UI. See [configuration](docs/CONFIGURATION.md).

**Security:** the server can execute tools and access local files with your user permissions. It has no built-in authentication. Keep it on loopback; remote access requires a trusted authenticated TLS proxy that prevents direct backend access.

## Build and verify

Requires Node >=22.19 (CI: Node 24).

```sh
npm ci --ignore-scripts
npm test
npm run test:coverage
npm run typecheck
npm run verify:package
npm pack
```

The package uses its own lockfile, not the Chat workspace. `verify:package` installs compiled tarballs in a private temporary consumer, checks SDK initialization/public declarations and runs CLI/restart/fixture scenarios without Chat sources, frontend dependencies or tsx. All test agent/history/metadata storage is private. This branch consumes an unpublished SDK candidate: the manifest pins its exact version and the lockfile resolves the integrity-pinned archive under `vendor/`. `npm ci` needs no sibling checkout. `verify:package` supplies both candidate tarballs explicitly to an isolated consumer and verifies shared SDK resolution without bundling. Installing the server candidate elsewhere requires supplying the matching SDK candidate too; no publication is implied.

Pi 1.0.2 uses broad internal ranges. Pinning its working dependency family (agent-core/AI 1.0.2; codemode/MCP/TUI/telemetry/chord 1.0.3) prevents incompatible upgrades in consumers where package overrides would be ignored. Keep these pins until a separately verified Pi update.

## SonarCloud

The Tests workflow scans only after server verification succeeds, reuses its Vitest coverage artifact, and waits up to 300 seconds for the quality gate. Fork pull requests are skipped. Scope is exclusion-based in [sonar-project.properties](sonar-project.properties); production CLI and testing helpers remain included even though compiled package tests do not contribute coverage.

To enable analysis:

1. Import `ManuelSelch/pi-server` into SonarCloud organization `manuelselch` and select CI-based analysis (disable automatic analysis).
2. Set GitHub Actions repository variables `SONAR_ORGANIZATION=manuelselch` and `SONAR_PROJECT_KEY=ManuelSelch_pi-server` (use the actual project key if different).
3. Add an authorized analysis token as the repository secret `SONAR_TOKEN`. Never commit it.
4. Push the workflow and check the scan/quality gate. Variables left unset disable the job; configured variables without a valid token cause analysis to fail. Required merge checks must be configured separately in GitHub branch protection.

## CLI

```sh
pi-server --host 127.0.0.1 --port 8788 --project /path/to/project
pi-server --static-directory /path/to/assets --pid-file /path/to/server.pid --log-directory /path/to/logs
```

Headless by default: `/health` and `/ws`, no session creation or browser launch. Explicit static hosting supplies SPA fallback. Relative flags resolve against the invocation directory; `--project` selects process cwd, while session create/open still use protocol paths and existing default home-folder behavior. Port 0 selects an ephemeral port. `--no-restart` disables restart for external supervisors. Standalone restart re-executes compiled JS without a build; the current waiter uses POSIX `/bin/sh`. SIGINT/SIGTERM dispose listeners/runtimes and flush logs. PID record is `{ pid, port, cwd }`; log filename remains `pi-chat.log` for compatibility. No CLI read of `PI_CHAT_HOST/PORT/CWD/PID_FILE`; the Chat adapter remains responsible for those settings.

## Public API ownership

- Root: async `createPiServer(options)` (await before listening), `createPiRuntimeAdapter(runtime)`, `createRestartService(options)`, `createFileLogger(options)` and their structural contracts.
- Server options: explicit host `plugins`, optional `pluginRpcContracts` allowlist ([RPC guide](docs/PLUGINS.md)), runtime/factory, optional static directory, restart, extensions, structural file-open service, logger and catalogue configuration (lister, session directory, discovery, metadata file, home directory; null suppresses home).
- Handle: `httpServer` for listen/address/error ownership; idempotent async `close()`. Close disposes transport, plugins and runtimes; callers flush/close injected loggers. Runtime creation stays lazy.
- `/plugins`: isolated host runtime and opt-in `createFileOpeningPlugin` factory; [plugin lifecycle](docs/PLUGINS.md) documents startup readiness, rollback and cleanup.
- `/extensions`: existing registration types and registry functions, retaining `Symbol.for("pi-chat.extension-registry")`, plus the `PiChatSessionHost` that a running server binds for in-process extensions. Test reset is not exported here.
- `/testing`: compiled fake runtime, fixture data and registry reset; no test-framework runtime dependency.
- `/testing/loopback`: `runLoopbackFixture()`. A plain-Node launcher imports and awaits it, with no arguments. It creates a private canonical workspace, binds ephemeral loopback, rejects other project paths, prints `PI_FIXTURE_READY { directory, endpoint }`, and on SIGTERM explicitly closes retained runtimes and exclusively writes `cleanup.json`. The test driver removes successful artifacts.
- No exports for concrete transport/application/catalogue/mapping internals. SDK `/protocol` remains authoritative.

## Architecture

See the [architecture guide](docs/ARCHITECTURE.md) and [editable Draw.io module diagram](docs/architecture.drawio), with a pi-verify-compatible dependency check.

## Source and test ownership

This repository owns the server implementation, internal regression tests, compiled fixture, diagnostics and independent CI. Pi Chat consumes the standalone package and retains its frontend, web/Node application tests and build-before-restart launcher policy, not Swift validation. The independent Swift SDK owns its unit tests and real-transport compatibility suite against its own locked published server dependency. See [test ownership and independent verification](docs/TEST-OWNERSHIP.md) for package boundaries, commands and version-specific results. Generic restart accepts an explicit build callback; failure keeps the old process serving.

See [configuration](docs/CONFIGURATION.md), [extension embedding](docs/EXTENSIONS.md) and the [server protocol reference](docs/PROTOCOL.md). TypeScript SDK schemas remain authoritative; no protocol source is copied here. Maintainers: see the [release checklist](https://github.com/ManuelSelch/pi-server/blob/main/docs/RELEASING.md).

## License

[MIT](LICENSE), copyright 2026 Manuel Selch. Dependencies are distributed separately under their own licenses; this license does not relicense third-party packages.
