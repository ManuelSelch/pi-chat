# Pi Server Protocol — Draft

**Proposed, not implemented. Target wire version: `2` (provisional).**

A shared contract for TypeScript and Swift clients. The existing [v1 schemas](../../src/shared/protocol.ts) remain unchanged until a coordinated migration. This draft describes behavior; exact schemas and fixtures follow separately.

## 1. Boundaries

- **Server:** sessions, execution, history, projects, structured questions and authoritative state.
- **SDK:** transport, typed requests/results, session projections and reconnect.
- **Application:** tabs, focus, navigation, layout and input drafts. These have no protocol messages.
- The client chooses which saved session to open, or creates a new one. Selecting a project's latest session is not a server operation.
- Pi Chat currently closes a runtime when its tab closes. That remains an application policy: call `closeSession`, then remove the local tab. Failure retains/restores the tab. Hiding a view or disconnecting does not itself close anything.

## 2. Connection

- WebSocket `/ws`, one JSON object per text message. No batches or binary messages initially.
- Remote access uses HTTPS/WSS through the homelab reverse proxy. Authentication and browser-origin validation are required; TLS alone is not authentication. Default binding remains loopback.
- One controller connection may operate multiple concurrent sessions. Only successful authentication and initialization replace the controller.
- Replaced connections close with code `4001`. They must not automatically reconnect until the user explicitly takes control.
- First request: `initialize`, carrying client name/version and requested optional capabilities.
- Result: protocol/server versions, `serverInstanceId`, `connectionId`, selected capabilities, complete open-session inventory, project catalogue and snapshots for all open sessions.
- Initialization is the readiness barrier: apply the whole result before processing later events or sending work. No navigation state is exchanged.
- Every message carries `version: 2`. Unsupported versions fail explicitly; unknown optional fields are ignored. Unknown required core variants are compatibility errors. Software/package versions are independent of wire versions.

## 3. Messages and identity

| Kind | Fields |
|---|---|
| Request | `version`, `type: request`, `requestId`, `method`, `params`; session identities when scoped |
| Response | `version`, `type: response`, `requestId`, `ok`; either `result` or `error` |
| Session event | `version`, `type: event`, `event`, `serverInstanceId`, `sessionId`, `sessionInstanceId`, `sequence`, `data` |
| Server event | `version`, `type: event`, `event`, `serverInstanceId`, `data` |
| Protocol error | `version`, `type: protocolError`, `error` |

- Requests receive one response while their originating connection remains current and writable. Responses never move to a replacement connection. Duplicate request IDs on one connection are protocol errors.
- Errors contain machine-readable `code`, readable `message` and optional `details`. Examples: `invalidRequest`, `unsupportedVersion`, `unsupportedOperation`, `sessionNotFound`, `sessionReplaced`, `sessionBusy`, `invalidPromptAnswer`, `permissionDenied`, `operationFailed`.
- `serverInstanceId` changes on process restart; `sessionInstanceId` changes whenever a runtime is loaded/replaced. Session requests name both `sessionId` and `sessionInstanceId`, preventing stale commands from targeting a reopened runtime.
- `sessionPath` identifies saved history on the server filesystem. It may be absent before Pi saves a session. `runId`, `promptId` and `operationId` identify execution, a question and admitted asynchronous work respectively.
- IDs are opaque. Timestamps use epoch milliseconds; counters use safe JSON integers. Optional fields are omitted unless their schema explicitly permits null.

## 4. Operations

Session operations require the target runtime identities. Server operations do not depend on a focused session.

| Method | Scope / input | Response meaning |
|---|---|---|
| `createSession` | Server; optional `projectPath` | Created summary and snapshot; omitted path uses server default |
| `openSession` | Server; `sessionPath` | Loaded/existing summary and snapshot; concurrent opens converge to one runtime |
| `listOpenSessions` | Server | Complete runtime inventory |
| `getSessionSnapshot` | Session | Current state and event watermark |
| `closeSession` | Session | Teardown completed; saved history is not deleted |
| `getCatalogue` | Server | Projects and nested saved-session summaries |
| `submitInput` | Session; `message` | Accepted operation receipt |
| `abortRun` | Session | Accepted abort receipt, or completed no-op if idle |
| `setModel`, `setThinkingLevel` | Session; selected value | Completed change and structured settings |
| `compactSession`, `reloadSession` | Session | Accepted operation receipt |
| `runExtensionAction` | Session; `actionId` | Accepted operation receipt |
| `answerPrompt` | Session; `promptId`, `result` | Question settled |
| `ping` | Server | Completed liveness check |

Optional capabilities expose `browseDirectories`, `completeCommandArguments`, `setSessionArchived`, `pinProject`, `removeProject`, `openFile`, `restartServer` and presentation contributions. Clients use only advertised/selected capabilities. Directory/completion/catalogue data retain existing field semantics; exact models follow in schemas.

Paths refer to the server. `openFile` opens there, not on iOS. Removing a project removes catalogue membership, not files. Archiving rejects busy runtimes, persists metadata, then closes an open runtime; partial success must be reported rather than hidden.

## 5. Execution and lifecycle

- `submitInput` preserves Pi behavior: plain input starts a run or steers an active run; slash commands and `!`/`!!` use existing command/bash rules. Pi owns scheduling and queues. Equal text submissions remain distinct.
- Long operations return `{state: accepted, operationId}` after validation/handoff, not after model completion. Publish acceptance before related events. Failures after acceptance are operation outcomes, not second responses.
- `operationFinished` reports the operation ID, original request ID and completed/failed/aborted outcome. Receipts are process-local and not replayed. Steering completes submission when Pi accepts it; queue consumption and the ongoing run remain separate state.
- Closing rejects new work, aborts execution, cancels questions and disposes the runtime before reporting success. `sessionClosed` is its final event, followed by inventory removal.
- `abortRun` stops execution without closing the session. Disconnect leaves runtimes alive; server restart may interrupt them. This is not durable execution.
- SDK-driven session switching emits `sessionReplaced` with old/new identities and a new snapshot. Updating client navigation is application-owned.
- A completed mutation remains successful even if a later catalogue refresh fails. Rejections must not falsely settle another active run.

## 6. State and recovery

- Snapshots contain identity, `throughSequence`, metadata, finalized messages, runtime status/run/error, steering queue, structured model/thinking settings, commands, pending questions and optional presentation state.
- Messages retain existing text/thinking, skill, tool, bash, custom-message and truncation data. Snapshots reflect Pi's current context; compaction may shorten history. Live/final/snapshot entries use consistent IDs within a runtime.
- Core session events increment a per-runtime `sequence`. Snapshot watermarks do not increment it. Prepare asynchronously, then capture current state/watermark and enqueue synchronously; never stamp stale state with a newer sequence.
- Apply only non-stale snapshots and events above the watermark. On a gap, recover through a fresh snapshot with bounded buffering; overflow requires reconnect. New process/runtime identities reset the projection.
- `sessionsChanged` and `catalogueChanged` carry complete replacement views with independent revisions. Optional `presentationChanged` also uses its own revision, not the core sequence, so capability filtering creates no gaps.
- Other events: `snapshot`, `assistantDelta`, `thinkingDelta`, `messageFinal`, `toolEvent`, `runtimeStatus`, `steeringQueue`, `prompts`, `settingsChanged`, `notification`, `operationFinished`, `sessionClosed`, `sessionReplaced`, and best-effort `serverStopping`.
- Reconnect repeats initialization and receives current state, not missed-event replay. Drop obsolete socket callbacks and incomplete drafts; reconcile local navigation against inventory. Transient notifications and operation outcomes may be lost.
- The current draft does not guarantee recovering an unfinished answer's already-streamed prefix. Clients may show running state until a complete final message arrives. Complete current-draft snapshots remain a review question.
- Runtime errors survive snapshots until new execution begins. Optional widgets/footer/slots are rendering hints; core settings must not be parsed from formatted UI text.

## 7. Questions, cancellation and retry

- Select/confirm/input/editor questions are snapshot-backed session state, including when no model turn is active. Clients choose modal, sheet or inline rendering.
- Answers are cancelled or typed values: boolean for confirm, an offered string for select, string for input/editor. Validate against the pending question. First valid answer settles once; invalid/late answers receive explicit errors.
- Defaults: five-minute total timeout and sixty-second no-controller grace, including questions created while disconnected. Reconnect cancels grace, not the total timeout. Expiration/teardown cancels questions. State does not survive process restart.
- Cancelling a local wait, timeout or disconnect does not cancel server execution. Use `abortRun` or answer a question as cancelled explicitly.
- Lost mutation responses are uncertain outcomes. Never automatically resend input/create/actions/file-open/restart. Request IDs provide correlation, not idempotency. Recover current state before deciding what to do next.

## 8. Open decisions and rollout

- Authentication ownership/mechanism for browser and Swift behind the reverse proxy.
- Final envelope choice (custom versus JSON-RPC) and wire version confirmation.
- Admission handoff against Pi's SDK; whether operation outcomes need querying after reconnect.
- Whether full in-progress assistant drafts are required in snapshots.
- Message/work limits, heartbeat/timeouts and partial teardown failure behavior. Required events must not be silently dropped under load.
- Whether coordinated rollout needs temporary v1 compatibility.

Keep v1 behavior during SDK extraction, then migrate server and Pi Chat together; Swift targets the new contract. Remove wire-level tabs/focus and move project-session selection to clients. Multi-client control, subscriptions, durable journals, automatic mutation replay, file transfer and AHP compatibility are deferred.

See [backend/SDK requirements](REQUIREMENTS.md) and [steering/snapshot requirements](../steering/REQUIREMENTS.md). Shared tests must cover lifecycle, streaming/steering, dialogs, version errors, snapshot ordering, reconnect/takeover, uncertain outcomes and slow consumers. No implementation or passing conformance tests are implied by this draft.
