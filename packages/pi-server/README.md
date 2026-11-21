# Pi Server

- Local HTTP/WebSocket host for Pi coding-agent sessions, with a compiled CLI, embedding API, extension integration and v2 protocol support.
- Source lives in the [Pi Chat monorepo](../../docs/monorepo.md), with independent public exports and packability.
- Requires Node >=22.19 (CI: Node 24). Standalone restart requires POSIX `/bin/sh`.
- No built-in authentication: keep it on loopback or behind a trusted authenticated TLS proxy. Tools run with the host user's permissions.

## Build and verify

Run from the monorepo root:

```sh
npm ci --ignore-scripts
npm run build:packages
npm run typecheck -w @manuelselch/pi-server
npm test -w @manuelselch/pi-server
npm run verify:packages
```

- One root lockfile links the local SDK. No candidate archives or sibling checkouts are needed.
- `verify:packages` installs both compiled tarballs in a private temporary consumer, checks shared SDK resolution and declarations, and runs CLI/restart/fixture scenarios without Chat, frontend dependencies or tsx.
- Runtime dependency pins are in [package.json](package.json). Do not change the Pi dependency family without verification.
- CI, coverage and Sonar analysis belong to the root [workflow](../../.github/workflows/tests.yml), not a separate package workflow.
- See the [release checklist](docs/RELEASING.md). No publication is implied; installation elsewhere needs published matching versions or both explicit tarballs.

## CLI and embedding

```sh
node packages/pi-server/dist/cli.js --host 127.0.0.1 --port 8788 --project /path/to/project
```

- Headless by default: `/health` and `/ws`, no session creation or browser launch. Static assets are explicitly supplied.
- Standalone restart re-executes compiled JS without a build. `--no-restart` supports external supervisors; SIGINT/SIGTERM dispose listeners/runtimes and flush logs.
- The Chat host owns `PI_CHAT_*` configuration and build-before-restart behavior. See [configuration](docs/CONFIGURATION.md).
- Await root `createPiServer(options)` before listening; the handle exposes `httpServer` and idempotent async `close()`. Callers own injected logger flush/close.
- `/plugins` exports the host runtime and opt-in feature factories; `/extensions` exports in-process registration contracts.
- `/testing` exports compiled fakes; `/testing/loopback` exports the isolated fixture. Concrete application/transport internals are not public APIs.
- SDK `/protocol` remains authoritative; no copied protocol source lives here.

## Guides

- [Architecture and module diagram](docs/ARCHITECTURE.md)
- [Host plugins and RPC](docs/PLUGINS.md)
- [Protocol reference](docs/PROTOCOL.md)
- [Extension embedding](docs/EXTENSIONS.md)
- [Test ownership](docs/TEST-OWNERSHIP.md): package-local tests, Chat acceptance and separate Swift compatibility.
- [MIT license](LICENSE) and [third-party notices](THIRD-PARTY-NOTICES.md). Dependencies retain their own licenses.
