# `@manuelselch/pi-sdk` — TypeScript client

Licensed under the [MIT License](LICENSE).

UI-independent TypeScript client for the Pi Server v2 protocol. The coordinated
Pi Chat server, SDK and application cutover is complete. **V2 only:** v1 envelopes
are rejected; no compatibility or automatic mutation replay is implemented.

## Connect and initialize

```ts
import { PiClient, createWebSocketTransport } from "@manuelselch/pi-sdk";

const client = new PiClient({
  endpoint: "wss://pi.example.test/ws", // explicit; never read from window.location
  transport: createWebSocketTransport(url => new WebSocket(url)),
});
const stopState = client.subscribe(state => console.log(state.connection.phase, state.inventory));
const stopEvents = client.onMessage(message => {
  if (message.type === "event" && message.event === "notification.created") console.log(message.data.message);
});
client.start();
// Wait for connection.phase === "ready" before user operations.
const runtimeId = await client.createSession("/server/project");
const admission = await client.prompt(runtimeId, "Hello");
// { state: "accepted", operationId }; assistant completion is a later event.

stopState(); stopEvents(); client.dispose(); // disconnects the client; does not close runtimes
```

Supply the host's WebSocket constructor (browser or modern Node). The SDK does
not import a socket implementation, inspect browser globals, require React/Pi,
or implement authentication/OAuth. `TransportFactory` and `Scheduler` are
injectable. `CancellationSignal` accepts AbortSignals without exposing DOM or
Node types in declarations.

## Plugin declarations

- `/plugins` exports framework-neutral plugin/remote-contract definitions and host context types; Pi Server owns activation and cleanup.
- Feature contracts such as [file opening](../../plugins/file-opening/README.md) live in separate plugin packages, not SDK feature exports.
- See [plugin contracts](docs/PLUGINS.md); plugin network transport and browser activation are not implemented.

## State, synchronization and recovery

- Construction is inert. `start()` schedules connection one tick later. Phases:
  `stopped`, `connecting`, `synchronizing`, `ready`, `reconnecting`,
  `superseded`, `failed`, `disposed`.
- The first wire request is `server.initialize`. `ready` is published only after
  the correlated result has been method-validated and its inventory, selected
  capabilities and exactly matching snapshots have been atomically applied.
  Each connection receives a new `connectionId`; `serverInstanceId` changes on
  process restart.
- The new connection replaces state from initialization. Navigation/focus stay
  local; an application can retain its selected `sessionId` if present in the
  new inventory, otherwise choose a remaining runtime. Disconnect does not close
  runtimes.
- Close code `4001` enters `superseded` without retry. Only explicit user action
  calls `takeControl()`; it never starts automatic controller-fighting loops.
- `getState()`/`getSession(id)` return deeply frozen projections. `subscribe`,
  `onMessage` and `onError` listeners are synchronous and isolated. Listener
  failures report `listenerError` without breaking transport cleanup.
- Core session events use contiguous per-runtime sequences; snapshots include a
  `throughSequence` watermark. Stale events/snapshots are ignored. Bounded gaps
  trigger one `session.snapshot` request with bounded event buffering; failure
  to heal or overflow fails the connection and reconnects. Inventory,
  project-catalogue and optional presentation revisions are independent.
- A same-process running snapshot preserves an already observed draft only when
  its `runId` matches. Initialization/reconnect has no cached incomplete draft.
  The protocol does not guarantee recovering a partially streamed answer prefix.
  Finalized messages are deduplicated by message ID; only a matching run's final
  assistant event clears its draft. Notices are transient app-owned view data,
  never SDK transcript history.
- `stop()`/`dispose()` detach listeners, invalidate stale callbacks, cancel local
  timers/waits and reject outstanding requests. Neither sends runtime-close.
  `stop()` can be followed by `start()`; disposal is permanent.

## Typed API

Every session method takes an explicit opaque runtime `sessionId`. Saved Pi
history is addressed by server-local `sessionPath`; these are different
identities. A fresh runtime ID is assigned on create/open/replacement and after
close/reopen; in-place resource reload and reconnect retain it.

| Convenience method | V2 method | Meaning |
|---|---|---|
| `createSession(projectPath?)`, `openSession(sessionPath)` | `session.create`, `session.open` | Completed runtime creation/load; resolves to the new `sessionId` and updates projections before the promise resolves |
| `request("session.list", {})`, `request("project.list", {})` | `session.list`, `project.list` | Correlated current replacement views |
| `request("session.snapshot", {}, id)` | `session.snapshot` | Current same-process snapshot/recovery |
| `closeSession(id)` | `session.close` | Resolves only after runtime teardown; failure can indicate partial teardown, so retry explicitly |
| `prompt(id, text)` | `message.send` | Resolves to admission receipt; settlement is a later `operation.finished` event |
| `abort(id)` | `run.abort` | Admission/completion receipt; does not close runtime |
| `compactSession(id)`, `reloadSession(id)` | `session.compact`, `session.reload` | Accepted asynchronous Pi work; eventual operation event |
| `respondToPrompt(id, promptId, result)` | `prompt.answer` | Completed prompt answer submission; valid kind/options checked server-side |
| `selectModel(id, model)`, `setThinkingLevel(id, level)` | `model.select`, `thinking.level` | Completed structured settings update |
| `runExtensionAction(id, actionId)` | `extension.run` | Accepted async extension action |
| `restartServer()` | `server.restart` | Accepted restart attempt; disconnect is not proof of success |
| `browseDirectories(query)` | `directory.browse` | Server-local paginated directory listing |
| `completeCommandArguments(id, name, prefix)` | `command.complete` | Session-scoped completion items |
| `openFile(id, path)` | `file.open` | Server OS accepted opening; does not transfer or display file contents |
| `archiveSession(path, archived)` | `session.archive` | Completed saved-history metadata mutation; may report persistence uncertainty |
| `pinProject(path, pinned)`, `removeProject(path)` | `project.pin`, `project.remove` | Completed project metadata mutations |
| `request("server.ping", {})` | `server.ping` | Explicit liveness operation; no automatic heartbeat |

The generic `request<M extends Method>(method, params, sessionId?, options?)`
exposes all methods with method-specific `Params<M>` and `Result<M>`.
Optional capabilities are intersected during initialize; calling an unselected
optional operation rejects with `unsupportedOperation`. Unknown requested
capabilities are ignored.

## Open/create theme metadata

Servers must return a concrete `theme` alongside `summary` and `snapshot`
in `session.open` / `session.create` results. The exported `SessionTheme` /
`sessionThemeSchema` contains a bounded name, explicit light/dark appearance,
fixed Pi semantic colors and page/card/info surfaces. All colors are six-digit
RGB hex; no Pi or Mantine dependency is introduced.

`client.getState().themes[runtimeId]` exposes the deeply immutable palette.
The SDK applies it before publishing the opened session. A missing or null
`theme` is a protocol error; it does not clear or replace the cached palette.
No backward-compatibility handling is provided.
Snapshots, presentation changes and reload operations never replace this cache.
A same-server reconnect retains entries for runtimes still in inventory; close,
inventory removal, runtime replacement and server-instance changes clear them.
Palettes are never transferred to a replacement identity.

There is no theme request, theme event, local storage or automatic restoration
from initialization. A fresh client/browser reload uses application defaults
until an open/create result arrives. Theme refresh on resource reload is deferred.
Server palette production and application rendering are separate integration work.

## Outcomes, cancellation and bounds

Promise resolution means the operation's documented response meaning above,
not necessarily completion of a model run. Server rejection is an `SDKError`
with structured `code`, `message`, optional `details`, `outcome: "rejected"` and
`requestId`. Local pre-send validation/offline/capability/limit errors use
`outcome: "notSent"`. Local timeout, cancellation after handoff, disconnection,
stop or disposal use `outcome: "unknown"`: the server may still execute. No
request is automatically resent. Query/reinitialize state or ask the user to
explicitly decide what to do.

`PiClient` defaults (configurable positive safe integers):

| Option | Default |
|---|---:|
| `connectTimeoutMs` (connect and initialization) | 10,000 ms |
| `requestTimeoutMs` | 10,000 ms |
| `maxPendingRequests` (shared requests) | 64 |
| `maxMessageCharacters` | 16,777,216 UTF-16 code units |
| `maxBufferedMessages` (inbound reentrancy and recovery) | 64 |
| `maxSessions` | 256 |
| `capabilities` | All known optional capabilities |

The transport bounds outgoing buffering (`maxBufferedBytes`, 4 MiB by default).
The client reconnects with exponential 250 ms–5 s backoff after failures. It caps
per-connection unique request IDs and reconnects before the server's 4,096-ID
budget is exhausted. No hidden queue, replay journal, offline submission,
automatic heartbeat or cancellation of server work exists. Unsignalled duplicate
file opens for the same runtime/path share one promise; signalled waits remain
independent.

## Protocol and package checks

Native `/model` prompts carry all available model references in `options` and a
`modelScope: { scoped: string[] }` subset for scoped/all filtering. Scope metadata
is limited to immediate selects and its references must be offered options.
Clients filter locally; answers remain ordinary `prompt.answer` strings.

`src/protocol/v2.ts` is authoritative; `models.ts` holds shared domain schemas,
not a legacy envelope. Regenerate schemas and examples:

```sh
# From the monorepo root:
npm ci --ignore-scripts
npm run protocol:generate -w @manuelselch/pi-sdk
npm test -w @manuelselch/pi-sdk
npm run typecheck -w @manuelselch/pi-sdk
npm run verify:package -w @manuelselch/pi-sdk
```

`@manuelselch/pi-sdk/protocol` imports no client state/transport. Generated artifacts remain available at `/protocol/schema/v2/*.schema.json` and `/protocol/fixtures/v2/*.json`. The old `/contract` entry is intentionally not exported. Runtime dependencies contain only Zod; this package builds/tests without importing Chat or Swift sources. Source and history now live in the [Pi Chat monorepo](../../docs/monorepo.md), with one root lockfile.

`npm run probe:swift:generate` writes a portable probe to `protocol/swift/GeneratedModels.swift`, never into a sibling repository. Swift imports pinned artifacts explicitly using its own synchronization script; TypeScript remains the sole protocol authority. Swift client/probe tests live in the separate `pi-sdk-swift` repository. Real-server cross-language compatibility tests also belong to the separate Swift repository.

## SonarQube Cloud

`npm run test:coverage` builds the SDK, runs the tests and writes text coverage
plus `coverage/lcov.info`. Coverage includes all `src/**/*.ts` files, including
unexecuted source files. Ordinary `npm test` runs without coverage.

- The root [workflow](../../.github/workflows/tests.yml) runs SDK/Server verification and normalizes their coverage into `coverage-packages/lcov.info`.
- Root Sonar analysis imports package coverage alongside Chat unit/browser reports. Configuration belongs to the [root development guide](../../docs/development.md#ci-and-static-analysis).
- Use `npm pack -w @manuelselch/pi-sdk --pack-destination <directory>` from the root to build a local consumer artifact. Nothing is published. See [PROTOCOL.md](PROTOCOL.md) and [workspace source history](../../docs/monorepo.md#imported-history).
