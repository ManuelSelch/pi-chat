# Architecture

[Open the editable Draw.io diagram](architecture.drawio) in diagrams.net or a Draw.io editor.
It describes the current high-level module dependencies inside a **single Node.js server process**, not separate services.
Every arrow means “source imports target”, including type-only imports; it does not describe request or event direction.

## Responsibilities and boundaries

| Slice under `src/` | Responsibility |
| --- | --- |
| `transport` | WebSocket v2 initialization, request validation/dispatch, operation outcomes, snapshots and event publication; connection-local state and backpressure. |
| `application` | Session commands and lifecycle coordination, mutation guards, extension hooks and shared live-runtime registry. |
| `runtime` | Runtime contracts and the Pi adapter: lazy agent creation, transcript/tool/event mapping, headless theme and web extension UI context. |
| `projects` | Persisted-session catalogue, project metadata, directory browsing and Git worktree discovery. |
| `plugins` | Per-server host plugin activation, local validated contracts and rollback/cleanup; shared declarations belong to the SDK. The transport's explicit [RPC allowlist](PLUGINS.md) exposes selected contracts over the existing WebSocket. |
| `extensions` | In-process extension registrations, session-host binding and UI prompt/status/widget registries. |
| `bootstrap` | Process restart planning/execution and PID-file publication. |
| `files` | File-open validation and delegation to the system opener. |
| `logging` | Buffered file logging and explicit flush/close. |
| `testing` | Exported fake runtime, protocol fixtures and isolated loopback host; not the test suite itself. |

The composition roots are [`src/index.ts`](../src/index.ts) (embedding API) and
[`src/cli.ts`](../src/cli.ts) (standalone launcher). They wire modules together but live directly under `src/`, so pi-verify does not assign them a slice.

External boundaries, intentionally not diagram boxes:

- Clients (including Pi Chat and native SDK consumers) connect to HTTP `/health` and WebSocket `/ws`. Optional static assets and SPA fallback are supplied explicitly; the package contains no frontend.
- `@manuelselch/pi-sdk/protocol` owns wire schemas. It is a package dependency, not copied server protocol source.
- `@earendil-works/pi-coding-agent` supplies agent runtimes, session persistence, providers and extension loading; the runtime factory enables codemode, tool search and MCP.
- Local disk holds Pi session histories and separate project metadata (by default `getAgentDir()/pi-chat/projects.json`). Catalogue reads do not turn metadata operations into rewrites of original Pi histories.
- Git discovery, system file opening and standalone restart cross into OS processes. Provider/tool/MCP access is performed through Pi, not a separate server-side service drawn here.

## State and runtime flow

1. The CLI or embedding caller awaits `createPiServer({ plugins })`. Host plugins activate once per server before HTTP/WebSocket construction; readiness returns an unbound server without creating an agent runtime by default.
2. A WebSocket client initializes v2 and negotiates capabilities. Transport dispatches validated operations to the application service.
3. Open/create operations lazily obtain a Pi adapter through the runtime factory. The application registry owns live adapters and subscriptions; duplicate open paths are coordinated.
4. Runtime events reach the application and then the transport publisher. Ready clients receive snapshots/events filtered by negotiated capabilities. UI tab order and focus remain client-owned.
5. Disconnect disposes connection-local state, **not** live agent sessions. A reconnect resynchronizes from current state; explicit session close or host shutdown disposes retained runtimes.

Host `close()` is idempotent: release the extension session-host binding, terminate transport connections, close HTTP, dispose host plugins, then application runtimes. All teardown steps are attempted even if one fails. Startup failure rolls back owned resources; see [plugin lifecycle](PLUGINS.md).
Embedding callers own flushing/closing injected loggers. The CLI owns signals, PID/log setup and standalone restart; embedding may inject restart behavior, including an explicit build callback.
A failed explicit restart build leaves the existing process serving.

The endpoint has no built-in authentication. Browser Origin validation is not authentication.
Use loopback or a trusted authenticated TLS proxy that prevents direct backend access; Pi tools run with the host user's permissions.
See [configuration](CONFIGURATION.md), [protocol](PROTOCOL.md), [extension integration](EXTENSIONS.md) and [test ownership](TEST-OWNERSHIP.md).

## Diagram contract and verification

[`.pi/pi-verify.json`](../.pi/pi-verify.json) selects each immediate folder under `src/` as a slice.
The diagram is uncompressed, single-page Draw.io XML:

- Each box has `concept="<folder>"` and the same folder label.
- Each dependency arrow has `assoc="<source>-><target>"` and matching endpoints.
- `strict: true` rejects unused allowed arrows as well as missing dependencies/boxes.
- `transitive: true` permits imports reachable through a chain of arrows: `A → B → C` also allows `A → C`. The diagram shows only essential arrows (the transitive reduction), not every direct import. This checks allowed reachability rather than an exact direct-import allow-list.

From the repository root, check the current working tree with:

```sh
npm run test:arch
```

The script runs pinned pi-verify 0.2.7 through npx; its first run requires registry access unless already cached.
This is a static TypeScript import check, not runtime, security or behavioral verification.
It excludes root-level source files, external package imports and recognized tests/declarations; nested folders are grouped into their top-level slice.
The small `testing` source helper slice is included. No runtime code or dependency is added to the server by this configuration.

After structural changes, update the diagram in Draw.io while preserving its metadata, or use `npm run test:arch -- --write` to refresh dependencies and stage new boxes for human placement.
Do not use `--accept` as a substitute for human review.
Commit both diagram and configuration: pi-verify's `review` command and Pi `/verify` compare committed revisions, not local edits.
A historical revision without this diagram is reported as absent, not as a passing architecture baseline.
