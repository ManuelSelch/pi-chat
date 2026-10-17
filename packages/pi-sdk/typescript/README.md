# @manuelselch/pi-sdk — TypeScript client

Local, unpublished migration SDK. **Currently v1 only**, matching the live Pi
Chat server. The [proposed v2 contract](../../../docs/backend-sdk/PROTOCOL.md)
is not implemented here. There is no dual-version negotiation or new scheduler.

## Connect

```typescript
import { PiClient, createWebSocketTransport } from "@manuelselch/pi-sdk";

const client = new PiClient({
  endpoint: "wss://pi.example.test/ws", // Explicit; never derived from window.location.
  transport: createWebSocketTransport((url) => new WebSocket(url)),
});
const unsubscribe = client.subscribe((state) => {
  console.log(state.connection.phase, state.inventory, state.sessions);
});
const stopEvents = client.onMessage((message) => {
  // Transient notifications are delivered here, not inserted into history.
  if (message.type === "notification") console.log(message.message);
});
const stopErrors = client.onError((error) => console.warn(error.code, error.message));
const ready = new Promise<void>((resolve, reject) => {
  const off = client.subscribe(({ connection }) => {
    if (connection.phase === "ready") { off(); resolve(); }
    else if (["failed", "superseded", "disposed", "stopped"].includes(connection.phase)) {
      off(); reject(new Error(connection.error?.message ?? connection.phase));
    }
  });
});
client.start();
await ready;

// Explicit session routing avoids focus races.
const sessionId = await client.createSession("/server/project");
client.prompt(sessionId, "Hello");

unsubscribe(); stopEvents(); stopErrors();
client.dispose(); // Closes the socket and local waits, NOT server runtimes.
```

Supply the host's WebSocket constructor (browser or modern Node); the SDK does
not read a global WebSocket or import a socket implementation. `TransportFactory`
and `Scheduler` are structural injection seams for embedders and deterministic
tests. `CancellationSignal` accepts standard AbortSignals without exposing DOM
or Node types in the SDK declarations. No React, Mantine, Pi runtime, filesystem,
window, authentication or OAuth dependency is required. The server-only
`@manuelselch/pi-sdk/contract` entry point does not import the client.

## Lifecycle and state

- Construction is inert. `start()` schedules the initial connection one tick
  later; repeated starts are idempotent. Connection phases are `stopped`,
  `connecting`, `synchronizing`, `ready`, `reconnecting`, `superseded`, `failed`
  and `disposed`.
- Reconnect delays are 250, 500, 1000, 2000, 4000, then 5000 ms, reset on socket
  open. Errors do not schedule a second retry; close/factory failure/initial-sync
  timeout own retries. Reconnect creates a fresh transport and receives snapshots.
- Close code **4001** enters `superseded` without automatic retry. `start()` does
  not override it. Only an explicit user action should call `takeControl()`.
- `ready` on **v1 is observational, not atomic**: this connection has received
  catalogue, inventory and snapshots for the advertised initial sessions. V1
  can interleave live messages with those sends. There is no initialize request,
  readiness receipt, process identity or event replay.
- `getState()` returns a stable, deeply frozen/read-only snapshot until the next
  publication. `getSession(id)` reads one projection. `subscribe` registers a
  synchronous change callback; read `getState()` for the current value when
  subscribing. Callbacks must not block the host event loop.
- `onMessage` delivers validated raw v1 messages, including replies and stale
  sequenced events. Projections, not raw callbacks, apply the stale-event guard.
  There is no retained event log or async subscriber backlog. A subscriber
  exception reports `listenerError` without breaking other subscribers/cleanup.
- Session projections include transcript/draft, Pi-owned steering, questions,
  action registry, widgets/footer and extension data. SDK history does not invent
  browser-local notice bubbles. The web application owns their display/anchors.
- `inventory` and `serverActiveSessionId` expose legacy **server-sent v1** data;
  they do not own local tabs, optimistic opening/closing or application navigation.
- Disconnect drops incomplete drafts but keeps cached history until snapshots
  replace it. Running same-session snapshots preserve an existing local draft.
  Snapshots accept lower watermarks after restart, as the v1 reducer did. V1 does
  **not** detect sequence gaps, recover a missing streamed prefix, upsert an
  existing final message or match an assistant final's run before clearing draft.
  Unique runtime/process identities and those v2 guarantees wait for slice 5.
- `stop()`/`dispose()` detach transport listeners, invalidate old callbacks,
  cancel retry/watchdog/request timers, reject pending waits and remove all
  subscriptions. `stop()` permits a later start with new subscriptions; disposal
  is permanent. Neither sends runtime-close commands. `takeControl()` retains
  subscriptions but invalidates the previous connection and pending work.

## Operations and response meaning

Every session-level method takes `sessionId` explicitly. Paths are on the server.

| API | V1 meaning |
|---|---|
| `prompt(sessionId, text)`, `abort(sessionId)` | Sent locally; Pi still owns execution/steering |
| `respondToPrompt(sessionId, promptId, result)` | Sent locally; no v1 settlement acknowledgment |
| `selectModel`, `setThinkingLevel`, `compactSession`, `runExtensionAction` | Explicit session first; sent locally, no correlated receipt |
| `openSession(path)`, `openProject(path)`, `focusSession(sessionId)` | Sent locally; v1 server still selects/focuses a session |
| `restartServer()` | Legacy `app.restart` with `sessionId: "app"`; disconnect is not proof of success |
| `closeSession(sessionId)` | Sends `closeTab`, cancels local session-scoped waits; **no teardown acknowledgment** |
| `createSession(projectPath?, options?)` | Correlated `newSession`; resolves runtime ID, not full UI/snapshot readiness |
| `browseDirectories(request, options?)` | Resolves a directory listing, including pagination metadata |
| `completeCommandArguments(sessionId, name, prefix, options?)` | Resolves completion items |
| `openFile(sessionId, path, options?)` | Resolves when server OS accepts opening; no file download/display guarantee |
| `archiveSession(path, archived, options?)`, `pinProject(path, pinned, options?)`, `removeProject(path, options?)` | Resolves v1 project-mutation reply; no file deletion |
| `send(command)` | Validated low-level v1 send; no invented admission/completion promise |

Promise-returning methods accept `{ signal: abortController.signal }`. Cancelling
only stops the local wait, never aborts a run or reverses a server mutation. Use
`abort` or an explicit cancelled prompt response for those domain actions.

`SDKError` exposes `code`, `outcome` and, for tracked requests, `requestId`:

- `notSent`: rejected locally before handoff (validation, pre-abort, offline,
  request limit or adapter send-buffer limit).
- `unknown`: an attempted send lost its reply through timeout, cancellation,
  disconnect or stop. **The server may still perform the operation.**
- `rejected`: a correlated server error. V1 supplies mostly text, not the v2
  structured operation-error contract.

The SDK never retries or replays any command. Request IDs are correlation, not
idempotency. IDs are monotonic for a client's lifetime, including reconnects.
V1 uncorrelated controls return `void`; errors subsequently appear in runtime
state or `protocolError` messages, not a fabricated per-operation result.

Unsignalled same-session/path file opens share one pending promise. Calls with
signals are independent and do not cancel one another. Inventory removal or an
explicit close cancels pending file/completion waits for that session. Request
families and reply session IDs must match before a wait can settle; late replies
cannot resurrect completed/cancelled waits.

## Bounds and recovery

`PiClient` defaults (all configurable positive safe integers):

| Option | Default |
|---|---|
| `connectTimeoutMs` (open plus initial synchronization) | 10,000 ms |
| `requestTimeoutMs` | 10,000 ms |
| `maxPendingRequests` (shared across request families) | 64 |
| File-family pending cap | 32 |
| `maxMessageCharacters` (one incoming frame and aggregate queued characters) | 16,777,216 UTF-16 code units |
| `maxBufferedMessages` (reentrant inbound deliveries) | 64 |
| `maxSessions` (inventory/projection count) | 256 |

The standard WebSocket adapter bounds outbound buffering with `maxBufferedBytes`
(default 4,194,304), including UTF-8 size of the proposed send. Custom transports
must provide their own equivalent backpressure; `send` may throw an `SDKError`
with `notSent` when rejecting before handoff.

Invalid JSON/unsupported required wire variants and incoming overload enter
`failed`, close/detach the socket and reject pending waits. Required events are
not silently dropped while pretending the projection is valid. Call `start()`
explicitly after addressing the failure to obtain fresh server snapshots.
There is no application heartbeat or durable request journal.

## Migration boundary

Slice 4 is complete: Pi Chat's `usePiChat` owns one PiClient per mounted
controller and invokes its typed operations. The browser provides the explicit
WebSocket endpoint and logging adapter. React cleanup disposes only the client,
not server runtimes. `bindPiChat` is shared with domain integration tests; SDK
projections are not reduced a second time in the web application.

Browser notice anchoring, dismissed errors, optimistic navigation, input drafts
and focus remain web-owned. The old web tracker bridges and `./migration` export
are removed; their regression tests now live beside the internal SDK trackers.
All request families used by Pi Chat now have the SDK's limits/deadlines. Session
creation uses the existing correlated v1 reply; unknown outcomes are displayed
without replay. Invalid required input is surfaced as a connection failure, not
silently ignored. A pre-existing server Home error bug is corrected by using the
existing v1 `protocolError` instead of an invalid empty-session runtime event.

This does not add atomic readiness or change the v1 schemas/fixtures. Slice 5
replaces the v1 contract in a coordinated v2-only cutover; these temporary legacy
operations do not imply permanent v1 support.
