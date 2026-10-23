# `@manuelselch/pi-sdk` — TypeScript client

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

## Contract and package checks

`src/protocol/v2.ts` is authoritative; `models.ts` holds shared domain schemas,
not a legacy envelope. Regenerate schemas and examples:

```sh
npm run contract:generate --workspace @manuelselch/pi-sdk
npm test --workspace @manuelselch/pi-sdk
npm run typecheck --workspace @manuelselch/pi-sdk
npm run verify:package --workspace @manuelselch/pi-sdk
```

`@manuelselch/pi-sdk/protocol` imports no client state/transport. Shared schema,
fixture, loopback host, lifecycle, cancellation, recovery and offline packed
consumer tests are part of slice-5 verification. The Swift probe remains a
scaffold; production Swift networking/dialog/reconnect parity is slice 7/8.
