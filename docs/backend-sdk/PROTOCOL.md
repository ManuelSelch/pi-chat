# Pi Server Protocol — Draft 1

**Status:** proposed, not implemented. **Target wire version:** `2` (provisional).

This document proposes the contract shared by the future TypeScript and Swift clients. It does not describe a released protocol, claim AHP/tryingET pi-server compatibility, or authorize implementation. The implemented v1 contract remains defined by [protocol.ts](../../src/shared/protocol.ts), [directories.ts](../../src/shared/directories.ts), [files.ts](../../src/shared/files.ts) and their server handlers. Section 15 inventories that contract and its migration gaps.

The words MUST, MUST NOT, SHOULD and MAY express proposed conformance requirements. Choices explicitly marked **Open** require review before implementation. Schemas and fixtures will be added in a later slice; this draft is a behavioral/wire-shape proposal, not a complete generated schema.

## 1. Purpose and ownership

The protocol exposes Pi-backed sessions, execution, saved history, project discovery, structured questions and optional extension contributions over a reliable connection. It does not expose Pi's internal SDK objects.

| Owner | Responsibilities |
|---|---|
| Server | Live runtimes, execution, saved-session discovery, project metadata, prompts, authoritative state |
| Protocol/client SDK | Requests, results/errors, connection state, session projections, recovery |
| Application | Tabs, screens, focus, navigation order, scroll position, input drafts and UI layout |

There is **no tab API** in this protocol: no `tabId`, `focusTab`, `closeTab`, `tabs` event or shared `activeSessionId`. Neither the server nor the shared SDK chooses the user's selected session. Session inventory order is not UI tab order.

**Confirmed Pi Chat policy:** its close-tab action currently requests `closeSession`, then removes the local tab on success. Optimistic hiding must roll back on failure. This is application policy, not the meaning of a protocol operation. A future application may hide a tab without sending any message. Disconnecting, navigating or hiding a view MUST NOT implicitly close a session. On a fresh client, the app decides which open sessions to display; on reconnect it reconciles its own navigation against server inventory.

## 2. Transport, security and compatibility

- WebSocket endpoint: `/ws`; one complete UTF-8 JSON object per text message. Binary frames and JSON batches are not supported in the initial version.
- Local default remains loopback. Remote deployment uses HTTPS/WSS through the user's homelab reverse proxy, with WebSocket upgrade support and backend access restricted to the proxy/trusted network. TLS is terminated at the proxy; a public backend listener is not implied.
- Endpoint authentication MUST precede admission as controller. **Open:** proxy-managed versus server-managed authentication and the browser/native credential mechanism. A certificate encrypts the connection; it does not authenticate the caller. Browser origins MUST be validated against configured origins; a missing Origin from a native client is not authentication.
- This draft retains **one controller connection**, not one runtime. Several sessions may run concurrently. Only an authenticated, successfully initialized compatible connection takes control. Failed authentication, malformed initialization or an unsupported version MUST NOT displace a working controller.
- A new controller replaces the old connection with close code `4001`, reason `Controller replaced`. A displaced SDK MUST stop automatic reconnect until an explicit application takeover request opens a new connection. Reconnecting normally can claim control; clients must not implement an endless takeover retry loop.
- Wire `version` is an integer major version, independent of server and SDK package SemVer. Every message includes `version: 2`. The server rejects incompatible initialization with `unsupportedVersion` and `details.supportedVersions`, using the offered envelope shape where safely possible, then closes with code `1002`. A legacy v1 server is not required to understand this exchange.
- Additive optional fields are allowed within a major version. Unknown optional object members MUST be ignored. Unknown optional extension contributions/events may be ignored only when advertised as optional. Unknown core methods return `unsupportedOperation`; unknown required core event variants or malformed core data require a visible protocol error and fresh synchronization, not partial state application.
- Optional operations are advertised as capabilities. Servers MUST NOT emit optional families the client did not select. Known core enum/union changes requiring new semantics need a version or capability boundary, not an assumption that every generated decoder is permissive.
- Numeric counters/timestamps MUST be finite JSON integers within JavaScript's safe integer range. Timestamps use Unix epoch milliseconds. Optional members are omitted; explicit `null` is not interchangeable with absence unless a field specifically permits it. IDs are opaque nonempty strings, not filesystem paths.
- **Open:** maximum message bytes, initialization duration, heartbeat interval and bounded per-connection work limits. Before release, both SDKs and the server need explicit limits and slow-consumer behavior. Required stream updates MUST NOT be silently dropped; disconnect/resynchronize instead of allowing unbounded queues.

## 3. Identity and resources

| Field | Meaning and lifetime |
|---|---|
| `requestId` | Unique per request on one connection; correlation only, not deduplication |
| `connectionId` | Server-assigned identity for one initialized socket; diagnostic, not a credential |
| `serverInstanceId` | New opaque identity on every server process start |
| `sessionId` | Identity of the Pi session currently hosted; required on session-scoped requests/events |
| `sessionInstanceId` | New opaque identity each time a runtime is loaded; prevents old events affecting a reopened runtime with the same session ID |
| `sessionPath` | Server-local persisted session-file path; optional until Pi materializes history |
| `runId` | Identity of a particular running agent invocation, not an HTTP/WebSocket request |
| `promptId` | Identity of one outstanding structured question within a runtime incarnation |
| `operationId` | Server identity of admitted asynchronous work; not a durable task or retry key |

Live identity is `(serverInstanceId, sessionId, sessionInstanceId)`. Session-scoped requests MUST name `sessionInstanceId`; stale requests return `sessionReplaced`. Reopening saved history normally retains its Pi session ID but receives a new runtime incarnation. IDs are opaque to consumers even if the implementation uses Pi IDs.

Pi extensions may switch the underlying session. The server MUST explicitly report `sessionReplaced` with previous/next session identities and the new snapshot, and update inventory. Clients MUST NOT silently route old-ID commands to the new session. Whether to focus the replacement is an application decision. In-place resource reload retaining the same runtime/session identity refreshes state without rekeying; a true runtime replacement receives a new incarnation.

## 4. Message envelopes

The following table defines object fields, not language APIs. `params`, `result` and `data` must match the selected operation/event schema; they are not arbitrary unchecked values.

| Kind | Fields |
|---|---|
| Request | `version`, `type: request`, `requestId`, `method`, optional `sessionId`/`sessionInstanceId`, `params` |
| Success | `version`, `type: response`, `requestId`, `ok: true`, `result` |
| Failure | `version`, `type: response`, `requestId`, `ok: false`, `error` |
| Session event | `version`, `type: event`, `event`, `serverInstanceId`, `sessionId`, `sessionInstanceId`, `sequence`, `data` |
| Server event | `version`, `type: event`, `event`, `serverInstanceId`, `data` |
| Optional presentation update | `version`, `type: event`, `event: presentationChanged`, `serverInstanceId`, `sessionId`, `sessionInstanceId`, `revision`, `data` |
| Uncorrelated failure | `version`, `type: protocolError`, `error` |

A valid request receives exactly one success/failure response while the originating socket remains current and writable. Responses go only to their originating connection, never its successor. Session events describe authoritative state and may still reach a successor after the requesting client disconnects. A response MUST NOT claim delivery guarantees across network failure or process termination.

A malformed request with a usable unique ID receives `invalidRequest`; malformed JSON or an unusable ID receives `protocolError` or a policy close. Reusing an in-flight request ID is a connection protocol violation: terminate the connection rather than create ambiguous multiple responses. Clients MUST NOT reuse completed IDs on the same socket. Repetition on a new socket is a new request and may execute twice.

Errors contain `code` and user-readable `message`, with optional operation-specific `details`. Clients branch on `code`, never message text. Initial codes: `invalidRequest`, `unsupportedVersion`, `unsupportedOperation`, `notReady`, `sessionNotFound`, `sessionReplaced`, `sessionBusy`, `promptNotFound`, `promptAlreadyAnswered`, `invalidPromptAnswer`, `notFound`, `permissionDenied`, `resourceLimit`, `unavailable`, `operationFailed`. Authentication is normally a transport rejection. Internal paths, credentials and stack traces MUST NOT be returned as unrestricted diagnostics.

An operation rejection MUST NOT falsely publish an idle status for an unrelated ongoing run. Transport errors, request timeouts and uncertain outcomes are SDK errors, not invented server responses.

## 5. Initialization and reconnect

The first application request is `initialize`. Its params contain a client implementation name/version and `optionalCapabilities: string[]`; it does not contain navigation state. This draft supports one wire major per connection and does not negotiate transports or authenticate through client identity strings.

The initialization result contains:

- Selected `protocolVersion: 2`, `serverVersion`, `serverInstanceId`, `connectionId`, `connectionMode: single-controller`.
- Supported and selected optional capability names.
- `openSessions`: a complete runtime inventory plus its `revision`.
- `catalogue`: a complete project/saved-history view plus its `revision`.
- `sessions`: one session snapshot for every runtime in that inventory.

The server completes asynchronous preparation first, then captures current inventory, snapshots and watermarks in one synchronous publication block. No await may occur between authoritative capture and enqueueing the result. Catalogue preparation must invalidate/retry stale captures when known catalogue mutations happen; it must not attach a newer revision to an older cached value. Initialization failures return an error without stealing control or publishing a partial ready result.

The result is the synchronization barrier. The server MUST enqueue it before subsequent core events for that connection. No client work requests are accepted before it. An SDK is ready only after applying the entire result. Initial state may contain no sessions; that is a valid home/empty state. Notices emitted before the barrier are transient and need not be replayed. Long initialization is bounded; clients may retry connecting but MUST NOT resend pending mutations.

Reconnect uses a new `initialize` and fresh snapshots, not an event cursor. Drop partial drafts from the old socket, fail pending waits with uncertain outcomes where applicable, apply the new inventory and snapshots, and restore application navigation locally. A changed `serverInstanceId` invalidates all former counters/operation handles. Closed/replaced runtimes disappear from the authoritative inventory. Fresh initialization does not promise automatic reopening of runtimes after a server process restart; saved sessions remain discoverable.

**No subscription API in draft 1:** the controller receives all open-session state, matching the current application scale. Future multi-client/selective subscriptions require a separately reviewed capability/version change, not tab operations.

## 6. Runtime inventory, saved history and lifecycle

An `OpenSessionSummary` contains `sessionId`, `sessionInstanceId`, `title`, optional `sessionPath`, `projectPath`, `projectName` and `status: idle | running | blocked | closing`. `blocked` means an outstanding structured question; detailed runtime activity remains in snapshots. `listOpenSessions` returns all summaries and their revision. `sessionsChanged` is a full replacement inventory, not a patch. Its revision increases for membership and summary changes and is scoped to `serverInstanceId`; older/equal revisions are ignored after synchronization.

| Method | Scope / params | Result meaning |
|---|---|---|
| `createSession` | Server; optional `projectPath` | Completed creation; returns summary and initial snapshot. With no path, use configured server home/default, never a shared focused session. |
| `openSession` | Server; `sessionPath` | Completed load or lookup; returns summary and snapshot. Opening an already-open canonical path returns the same runtime and does not focus any UI. Concurrent opens must converge to one runtime. |
| `continueProject` | Server; `projectPath` | Existing openProject behavior: continue the project's most recent resumable session, or create one if none. Returns summary and snapshot; does not choose client navigation. |
| `listOpenSessions` | Server; empty | Current complete runtime inventory and revision. |
| `getSessionSnapshot` | Session; empty | Current authoritative snapshot with matching watermark. |
| `closeSession` | Session; empty | Completed teardown: no more work from this incarnation; does not delete history. |
| `getCatalogue` | Server; empty | Complete project catalogue, nested saved-session summaries and revision. |

Closing aborts active execution, cancels outstanding questions and disposes resources. It MUST NOT report completion until teardown finishes. Mark the runtime closing and reject new work while teardown is pending; do not let abort/prompt replies become stuck behind it. Publish terminal `sessionClosed` as the last session event, then remove from inventory. Subsequent commands return `sessionNotFound`; a different incarnation returns `sessionReplaced`. Close failures remain discoverable as authoritative runtime state; the server must not claim a usable runtime after partial disposal without reconciling its actual state. Detailed partial-teardown policy is **Open**.

Server shutdown/restart closes runtimes; ordinary socket disconnection does not. Snapshot/history persistence follows Pi: an empty or bash-only session may not yet have a persisted session file. Closing does not guarantee a new file will be created. `closeSession` is not a history deletion operation.

Project/catalogue data retains v1 names, worktree metadata, quick-chats marker, archive/pin state and path semantics. `catalogueChanged` replaces the complete catalogue with a revision scoped to the current server instance. It is not a durable filesystem change stream: external changes become visible on discovery/refresh. No separate flat saved-session listing is needed initially.

## 7. Request completion and asynchronous operations

Read operations complete with their result. Lifecycle operations above complete with their state mutation. Long execution operations use admission responses, so requests do not hold up control messages:

| Method | Scope / params | Successful response |
|---|---|---|
| `submitInput` | Session; `message` | `operationId`, `state: accepted`, `inputKind: prompt | steering | command | bash`. Accepts responsibility, not proof of transcript consumption or model completion. |
| `abortRun` | Session; empty | `operationId`, `state: accepted`; requests abort of current agent/user-bash work. Idle is an immediate no-op result with `state: completed`. |
| `setModel` | Session; `model` | Completed setting change and current structured settings; supported model identity remains an opaque server-offered string. |
| `setThinkingLevel` | Session; `level` | Completed setting change and current structured settings. |
| `compactSession` | Session; empty | `operationId`, `state: accepted`. |
| `reloadSession` | Session; empty | `operationId`, `state: accepted`; preserve Pi-native in-place reload behavior. |
| `runExtensionAction` | Session; `actionId` | `operationId`, `state: accepted`; no generic action payload is introduced. |
| `answerPrompt` | Session; `promptId`, `result` | Completed settlement of the question, not completion of the operation it unblocks. |
| `restartServer` | Server; empty; capability required | `state: accepted`; acknowledgment queued before shutdown. Successor initialization confirms actual recovery. |

A successful admission creates an in-memory operation receipt. The server publishes one `operationFinished` event with `operationId`, originating `requestId`, and `outcome: completed | failed | aborted`; failed outcomes include a structured error. Publish the acceptance response before events for that operation. No code path may also send a second terminal response for the same request. Run `runtimeStatus`/`lastError` remain session state, not substitutes for operation outcomes. Operations are not stored durably and are not listed/replayed on reconnect.

**Important completion distinction:** a normal idle prompt's operation finishes when its invocation settles; a steering submission finishes when Pi accepts the queue submission, not when the agent consumes it or the ongoing run ends. A slash command/bare bash invocation settles when that invocation returns. UI state MUST track queued steering and runtime status separately from operation receipts. A close that aborts work finishes affected operation receipts before the terminal sessionClosed event when the process remains healthy.

`submitInput` preserves Pi Chat's existing text semantics: idle plain input starts work; plain input during an agent run uses native steering; slash commands use command precedence/guards; `!`/`!!` invoke native user bash with existing context inclusion rules. No follow-up scheduler or image-upload input is added. Invalid/unsupported submissions fail admission or settle as failed; they MUST NOT clear another run's active status. Identical text submitted twice represents two inputs, not deduplication.

**Open implementation boundary:** the installed Pi SDK's prompt promise may cover an entire invocation. Admission needs explicit preflight/handoff ownership in the adapter/application; it MUST NOT mistake promise creation for successful completion or await a full model run before acknowledging acceptance. Receipt failures must be projected even if no model turn starts.

## 8. Supporting operations and capabilities

All are correlated requests with ordinary completed results unless noted otherwise. Session methods require both session identities.

| Method | Params / result | Capability |
|---|---|---|
| `browseDirectories` | v1 `path`, optional `basePath`, `showHidden`, `cursor`; returns directory listing | `directories` |
| `completeCommandArguments` | Session; `commandName`, `argumentPrefix`; returns ordered completion items | `commandCompletions` |
| `setSessionArchived` | Server; `sessionPath`, `archived`; completed metadata change | `projectManagement` |
| `pinProject` | Server; `projectPath`, `pinned`; completed metadata change | `projectManagement` |
| `removeProject` | Server; `projectPath`; removes catalogue membership, not project files/history | `projectManagement` |
| `openFile` | Session; `path`; completed server OS-open acceptance, not device download/display | `serverFileOpen` |
| `restartServer` | Server; empty; admission as above | `serverRestart` |
| `ping` | Server; empty; empty completed result; no session required | Core after initialization |

Catalogue, session lifecycle, chat, settings, snapshots and structured questions are core. `presentation` is an optional state/event family for footer/widgets/slots/extension state, not an authorization mechanism. Server capabilities reflect actual availability, not guesses based on server version. Reject unselected optional operations with `unsupportedOperation`.

Archive preserves current behavior: reject while the target runtime is busy/changing; persist archive metadata first, then close an open runtime and publish lifecycle/inventory updates. Unarchive does not load a runtime. If persistence succeeds but teardown fails, return an operation error with explicit `details.metadataApplied: true`, reconcile authoritative state and refresh catalogue rather than pretend no mutation happened. Opening archive history and resuming execution retain the existing restore-from-archive rules. An unrelated refresh failure cannot undo a completed metadata mutation.

Paths address the **server's filesystem**. Directory resolution, symlinks, `~`, readability, pagination and file-open validation retain their existing contracts. A server-local file-open operation is an effect, not a read suitable for automatic retry. Endpoint authentication grants trusted agent/file access; this draft adds no per-project filesystem sandbox. Concrete allowed roots for loading session files and remote deployment filesystem permissions need security review before exposure.

## 9. Snapshots, sequencing and events

A `SessionSnapshot` contains session identity, `throughSequence`, optional `sessionPath`/`sessionName`, `projectPath`, finalized `messages`, `runtime`, `steeringMessages`, `settings`, `commands`, `prompts`, and optional selected-capability `presentation`.

- `runtime` contains `status: idle | running | aborting | closing`, optional `runId`, and optional `lastError`.
- `settings` contains selected `model`, `availableModels`, selected `thinkingLevel`, `availableThinkingLevels`, and supported core operations. Clients MUST NOT parse formatted footer text for these values.
- `commands` retains v1 slash command name, description, argument hint and source.
- `prompts` and steering are complete current lists, not additive patches.
- `presentation` groups v1 widgets/footer/buttons/badges/extension state with existing field semantics and its own `revision`. Slot locations are rendering hints, not runtime addressing. Presentation revisions are scoped to the runtime incarnation; apply only newer complete replacements.
- Finalized transcript entries retain v1 roles: user, assistant, system, tool, bash and custom. The v1 notice/anchor shape is client presentation, not authoritative history. Text, thinking, skill expansion, tool arguments/results, write/edit previews and truncation metadata remain supported.
- Transcript is the current Pi SDK context, not necessarily full saved history. Compaction/navigation may replace earlier context. Live and snapshot entries use the same IDs; tool entries use stable tool-call identity. IDs need not remain identical across a fresh runtime load; the snapshot replaces old projections.

Every core session event increments `sequence` by one within a runtime incarnation, including transient and operation events. A snapshot carries the last covered value, `throughSequence`, and does not itself increment the counter. Optional presentationChanged updates use their own revision instead, so suppressing an unselected presentation capability cannot create holes in the core event stream. Server-wide full replacement views have their own revisions; there is no global order across sessions.

All async snapshot preparation happens before fresh synchronous state/watermark capture and enqueueing. The server MUST NOT stamp an old captured transcript with a newer sequence. Closed/replaced runtime/connection work is discarded. This applies to initialization, explicit refresh, prompt/feature completion and metadata/compaction changes.

For an established incarnation, apply a snapshot only when its watermark is not older than the applied sequence. Apply subsequent events strictly above that watermark; drop duplicates. A gap on a continuing connection requires `getSessionSnapshot` before further application; unknown runtime events similarly trigger inventory/snapshot recovery. Hold subsequent events in a bounded queue while recovering, then discard those covered by the new watermark; overflow requires reinitialization. A new server/runtime incarnation resets the projection and sequence baseline.

| Session event | Data / behavior |
|---|---|
| `snapshot` | Complete SessionSnapshot; envelope sequence equals throughSequence, exception to increment rule |
| `assistantDelta`, `thinkingDelta` | `runId`, append-only `delta`; draft belongs to that run |
| `messageFinal` | `runId`, complete message; upsert by ID and replace the matching assistant draft |
| `toolEvent` | `runId`, tool-call projection; merge by toolCallId without regressing a final card to running |
| `runtimeStatus` | Current runtime status, optional runId/lastError; not request acknowledgment |
| `steeringQueue` | Complete current list of queued input texts, retaining duplicate items |
| `prompts` | Complete outstanding question list |
| `settingsChanged` | Complete structured settings |
| `presentationChanged` | Complete optional presentation state; only when selected; revisioned rather than core-sequenced |
| `notification` | Transient level/message; not replayed or reconstructed from history |
| `operationFinished` | Operation identity and final invocation outcome |
| `sessionClosed` | Final event for incarnation, reason: requested, archived, shutdown or replaced |

Server events: `sessionsChanged`, `catalogueChanged`, `sessionReplaced`, and best-effort `serverStopping` carrying reason restart/shutdown. `sessionReplaced` carries old/next identities plus new snapshot and is followed by updated inventory; ignore late old-incarnation events. Unexpected transport close remains possible without `serverStopping`.

A full snapshot may shorten history after compaction. Client-only notices may be retained/reanchored locally; they MUST NOT be mistaken for persisted messages or inserted into server state.

**Partial streaming limitation:** the initial target does not promise recovering the already-streamed prefix of an unfinished assistant message after reconnect, because v1 snapshots primarily describe finalized messages. On every initialization or explicit recovery, drop incomplete local drafts; subsequent deltas may show only the newly received suffix until messageFinal/snapshot supplies the complete message. During uninterrupted same-incarnation refreshes, retain the matching draft while runtime/run identity is unchanged. Never concatenate drafts from different runs. Clients may instead display a reconnecting/running placeholder until finalization. Adding a complete current-draft snapshot is a separately reviewed improvement, not an implicit guarantee of this draft.

## 10. Structured questions

Questions are session state, independent of active model turns. They can originate from tools, slash commands or extension actions. A question retains v1 fields `id`, `kind`, `title`, optional `message`, `options`, `placeholder`, `prefill`; `kind` is select/confirm/input/editor. The id is the promptId used by answerPrompt. UI rendering is client-specific (modal, sheet or inline).

`result` is either `{cancelled: true}` or `{cancelled: false, value: ...}`. Confirm requires a boolean; select requires one of the offered strings; input/editor require a string, including empty text. The server validates against the actual pending question, not just a union schema. Cancellation resolves to the Pi UI method's normal cancelled result.

The first valid answer settles exactly once and publishes the updated full prompts list. Later duplicate answers return `promptAlreadyAnswered` while a bounded settlement receipt is retained; unknown/expired/pruned IDs return `promptNotFound`. A request ID is not the prompt ID. Invalid answers do not settle the question. No answer-draft synchronization or concurrent respondents are introduced.

Defaults retain the current host policy: five-minute total prompt timeout and a sixty-second no-controller grace period for pending questions. A question created while disconnected also starts no-controller grace. Reconnect before grace expiry cancels that grace, not the total timeout. Expiration, abort/close and runtime teardown settle as cancelled and remove the question; clients see current prompts via snapshots after recovery. These prompts and receipts are process-local, not durable after restart. No terminal-only custom component API is implied.

## 11. Cancellation, retries and uncertain outcomes

- Cancelling an SDK request wait, dismissing a screen, socket disconnect or timing out locally does not undo server work. `abortRun` is the explicit execution control; cancelling a question is `answerPrompt` with cancelled true.
- Server admission results are not durable promises. A server crash can interrupt runs and lose in-memory receipts/queues/prompts even when completed transcript entries are saved.
- On loss of a pending mutation response, report an uncertain outcome. Reinitialize and inspect inventory, snapshots/catalogue; do not automatically resend create/input/actions/file-open/restart. Matching text or project paths does not prove whether a create/input ran.
- Read requests may be issued again with new request IDs. A later manual mutation is a new intent; no general idempotency key or exactly-once guarantee exists in draft 1.
- A received accepted receipt followed by disconnect proves admission, not completion. Operation events missed while disconnected are not replayed. Current state can recover session status, not every historical command outcome.
- Request failure leaves unrelated run/lastError state intact. Run failures persist in runtime.lastError until a new accepted execution starts, rather than disappearing on arbitrary reads or UI interactions.

## 12. Ordering and race requirements

- Requests may complete out of submission order. Correlate by requestId. No generic dependsOn or global scheduler is introduced.
- Runtime admission/mutation guards must prevent invalid concurrent lifecycle changes. Abort and answers remain dispatchable while input/actions are active. Setting changes use Pi's existing busy-state rules; rejection is explicit.
- Opening the same canonical saved session concurrently returns one runtime. Closing/reopening never reuses an old incarnation's events/replies as the new session's state.
- Responses carrying snapshots/inventories obey the same watermark/revision checks as pushed state. A late read cannot regress a newer projection.
- A reply stays bound to its original connection even if an await finishes after controller takeover. Resulting authoritative state goes to the current controller through events/snapshots.
- A successful create/mutation is not changed to failure because subsequent catalogue refresh fails. Report the refresh problem separately; it must not invite repeating a completed side effect.
- Runtime metadata changes, compaction and SDK-driven session switches produce fresh state and matching inventory updates without relying on client focus.

## 13. Client conformance scenarios

A server and both SDKs must pass the same behavioral fixtures/scenarios, not merely decode schema examples:

1. Empty initialize; several already-open sessions; ready only after the complete barrier.
2. Invalid version/auth/origin does not steal control; valid replacement closes old socket with 4001 and no reconnect fight.
3. Create/open returns identity plus snapshot, concurrent duplicate opens converge, and local focus changes send no messages.
4. Close finishes teardown, history remains, local close policy waits/rolls back, and disconnect is not close.
5. Idle input, duplicate-text steering, consumption as a real user message, slash command and user bash; no fake queued transcript messages.
6. Streaming/thinking/tools/finalization use stable identities; a late read or reversed async snapshot preparation cannot regress state.
7. Reconnect while running/blocked, sequence gaps, server restart, runtime reopen with the same session ID, explicit session replacement and bounded recovery queues.
8. Select/confirm/input/editor from both active turns and idle actions; invalid answer, duplicate answer, expiration, teardown and disconnect-created questions.
9. Operation failure before a turn starts, rejected command during another run, accepted then lost socket, timeout and no automatic retry.
10. Compaction-aware history, current lastError, transient notifications, unsupported optional UI and typed model/thinking configuration.
11. Supporting operations, filesystem error mapping, archive persistence versus close failure, successful create followed by refresh failure and server restart acknowledgment before shutdown.
12. Unknown optional members, unknown required variants, malformed JSON, oversized messages, slow clients and unavailable optional capabilities.

These tests are future acceptance criteria. This documentation commit does not assert they currently pass.

## 14. Why this shape, and deferred features

| Reference / finding | Decision |
|---|---|
| AHP's explicit lifecycle, errors and capability discovery | Adopt the principles with a smaller custom contract |
| AHP channels, subscriptions, multi-client reconciliation, multiple chats per session | Defer; current controller already receives all runtimes |
| AHP turn-bound input requests | Do not adopt; Pi's session-level extension questions must work outside turns |
| pi-server consistent command responses and explicit execution semantics | Adopt consistent correlation and documented admission/completion distinctions |
| pi-server command replay, dependencies, journal, lanes and optimistic session versions | Defer; do not rebuild execution infrastructure for two owned clients |
| Existing Pi Chat snapshots and normalized domain objects | Preserve; clients need not depend on upstream SDK message types |
| Existing server-owned tabs/focus | Remove from target protocol and SDK; retain equivalent app behavior locally |

Also deferred: image attachments, file transfers, push notifications, durable runtime recovery, UI component transport, collaborative input drafts and resumable transport event logs. Their absence does not prevent a future capability/version extension.

## 15. Implemented v1 inventory and migration

This section records the inspected implementation, not target conformance. v1 uses direct `{version: 1, type: ...}` command objects, no initialize handshake, a single controller claimed immediately on WebSocket connection, session snapshots, then tabs and catalogue. Some operations have requestId replies; others report through session events. The extracted TypeScript SDK must initially preserve this behavior before switching wire contracts.

| Existing client type | Current behavior / response family | Target |
|---|---|---|
| prompt | No correlated reply; runtime events then snapshot/catalogue after invocation | submitInput + admission and operation outcome |
| abort | No correlated reply; runtime state/events | abortRun |
| uiPromptResponse | No correlated reply; unknown/settled IDs ignored | answerPrompt, method-specific validation and result |
| openProject | Open/continue project, snapshot/tabs/catalogue; no correlated reply | continueProject |
| openSession | Open by path or focus existing runtime; no correlated reply | openSession without focus side effect |
| newSession | Optional path and requestId; optional sessionOpened/sessionOpenError | createSession, explicit server default path |
| closeTab | Disposes runtime and updates tabs/catalogue | closeSession; tab removal is app-local |
| focusTab | Sets server focus and sends tabs | Remove; local application navigation |
| runFeature | thinking.level/model.select/session.compact/app.restart; no correlated reply | setThinkingLevel/setModel/compactSession/restartServer |
| runExtensionAction | Async extension action then snapshot/tabs/catalogue | runExtensionAction |
| completeCommandArguments | requestId; commandArgumentCompletions with items/error | Standard result/error envelope |
| browseDirectories | requestId; directoryListing/directoryBrowseError | Standard result/error envelope |
| setSessionArchived | requestId; projectMutationResult; archiving may close runtime | Standard result/error plus explicit lifecycle |
| pinProject, removeProject | requestId; projectMutationResult | Standard result/error envelope |
| openFile | requestId/sessionId; fileOpenResult with typed file-open failure | Standard result/error; retain file failure codes in operation details |

| Existing server type(s) | Target treatment |
|---|---|
| snapshot | Restructure session snapshot; add incarnation, runtime/settings; keep atomic watermark semantics |
| assistantDelta, thinkingDelta, messageFinal, toolEvent | Retain domain meaning in session event envelope |
| runtimeStatus, steeringQueue, prompts | Retain; complete current state and explicit runtime identity |
| widgets, footer | Optional presentationChanged |
| notification | Transient session event; local notice anchoring is not protocol state |
| tabs / activeSessionId | Replace runtime inventory with sessionsChanged; delete focus semantics |
| catalogue / app features | getCatalogue/catalogueChanged plus capabilities and structured operations |
| protocolError | Structured uncorrelated error |
| projectMutationResult, fileOpenResult, commandArgumentCompletions, directoryListing, directoryBrowseError, sessionOpened, sessionOpenError | Replace operation-specific envelopes with standard responses |

Additional target gaps: runtime incarnation/process IDs, structured settings independent of presentation, explicit close/replacement events, terminal operation receipts, prompt validation/settled-answer diagnostics, authenticated initialization and full initial barrier. Current v1 snapshots cannot be assumed to contain a recoverable unfinished assistant draft.

**Transition proposal:** v1 behavior remains unchanged through extraction. Introduce v2 deliberately in a coordinated server/TypeScript release; the Swift SDK targets v2. Do not infer a peer version from whichever message happens to parse. **Open:** whether a short v1 compatibility window is needed. If supported, choose a separate versioned endpoint or explicit handshake route; do not run both controllers as separate owners of the same runtime registry. Package SemVer and protocol version compatibility are documented separately.

## 16. Review questions

1. Are the proposed custom envelopes, integer wire version 2 and all-open-sessions initialization appropriate, or is JSON-RPC framing preferred before schemas are written?
2. Should endpoint authentication live at the existing reverse proxy or in pi-server, and which credential mechanism works for browser and Swift?
3. Are admission receipts and transient operationFinished events sufficient, or does an initial workflow require querying operation outcomes after reconnect?
4. Should reconnect initially retain the documented incomplete-stream limitation, or should a complete current assistant draft become mandatory snapshot state before mobile support?
5. Which limits, heartbeat/timeouts and partial-close failure policy should the first implementation enforce?
6. Is a temporary v1 compatibility endpoint required during rollout, or can server and Pi Chat move together before the Swift release?

## 17. Related sources

- [Backend/SDK requirements](REQUIREMENTS.md)
- [Steering/snapshot requirements](../steering/REQUIREMENTS.md)
- [Implemented application service](../../src/server/application/chat-application-service.ts)
- [Implemented session registry](../../src/server/application/session-registry.ts)
- [Implemented publisher](../../src/server/transport/server-publisher.ts)
- [Implemented command handler](../../src/server/transport/command-handler.ts)
- [Implemented prompt registry](../../src/server/extensions/ui/ui-prompt-registry.ts)
- [AHP specification](https://microsoft.github.io/agent-host-protocol/specification/overview.html)
- [tryingET/pi-server protocol](https://github.com/tryingET/pi-server/blob/main/PROTOCOL.md)
