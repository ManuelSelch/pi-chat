# Pi Chat Protocol v1 — Inventory and Migration Baseline

This document records the implemented v1 behavior observed in the repository at `b708f07` (runtime source unchanged by this documentation slice). It is an inventory, not a promise that v1 behavior is desirable or that the proposed v2 protocol is implemented. The coordinated migration is v2-only; v1 compatibility is not required.

Historical source note: slice 2 extracted v1 schemas into the SDK workspace; slice 5 removed the v1 wire contract/artifacts during the coordinated v2-only cutover. The source at commit `f63a463` is the migration baseline. This file records historical observed v1 semantics, not a supported protocol; see the [workspace handover](../../packages/pi-sdk/README.md) and [v2 cutover verification](CUTOVER.md).

Coverage: all **16 client message types (19 schema variants, including four `runFeature` variants)** and **21 server message types** are accounted for below. Source review and focused regression checks establish the extraction baseline; they do not establish v2 conformance.

## Current architecture and connection lifecycle

- The browser opens a WebSocket at `/ws` and sends one JSON object per message. The server parses inbound data with `parseClientMessage`; malformed JSON or a schema/version mismatch receives an uncorrelated `protocolError` string.
- `PROTOCOL_VERSION` is `1`. The server does not implement a protocol initialization/ready handshake, request negotiation, capability negotiation, or per-message session incarnation IDs. Every client message schema requires version 1; every server message includes version 1.
- The current Pi Chat server does not implement application authentication or browser-origin validation. The standard entry point binds to `127.0.0.1`; remote authentication/TLS are deployment concerns for the homelab reverse proxy.
- There is one controlling WebSocket and multiple concurrent runtime sessions. A newly connected socket replaces the controller immediately, before any client initialization. The old socket receives a protocol error and is closed with code `4001`; the browser suppresses automatic reconnect after that code until the user explicitly takes control. Other disconnects use exponential retry.
- On connect/reconnect, the server sends snapshots for currently open sessions, then `tabs`, then `catalogue`. It does not replay missed events. The browser drops incomplete streaming drafts on disconnect and restores only what arrives in snapshots; a currently streaming snapshot has no accumulated draft text.
- Server state is session/runtime-oriented, but v1 exposes navigation as `tabs` plus `activeSessionId`. `focusTab` changes server focus. Closing a tab calls `closeTab`, which disposes that runtime; it does not delete saved session history. Hiding a view or losing the socket does not close runtimes.

## V1 client operations

All session-scoped operations route by `sessionId` only; v1 has no `sessionInstanceId`. Request IDs, where present, correlate selected replies but are not idempotency keys and are not enforced for uniqueness by the server.

| V1 message | Scope and implemented behavior | Reply/observable outcome |
|---|---|---|
| `openProject` | Server-level path; continues/creates a runtime for the project and focuses its tab | No correlated reply; snapshots/tabs/catalogue on success; errors use `publishError` against the currently active session |
| `openSession` | Server-level saved-session path; focuses an already-open runtime with the same session path or opens it | No correlated reply; snapshots/tabs/catalogue on success; errors use `publishError` against the currently active session |
| `newSession` | Server-level optional project path; creates a fresh runtime | Optional `requestId`; when supplied, `sessionOpened` or `sessionOpenError` |
| `prompt` | Session-level text submission; Pi handles slash commands, `!`/`!!` bash and steering behavior | No acceptance/completion response; sequenced runtime events/snapshots or a sequenced `runtimeStatus.error` |
| `abort` | Session-level abort | No correlated reply; runtime status/events report progress |
| `uiPromptResponse` | Session-level answer/cancellation for a pending extension question | No correlated reply; unknown/settled prompt IDs are ignored |
| `runFeature` | Session-level discriminated feature: model selection, thinking level, compaction, or app restart | No correlated reply; side effects/events and snapshots; restart may disconnect before a reply |
| `runExtensionAction` | Session-level extension action | No correlated reply; action output/events and snapshot refresh |
| `focusTab`, `closeTab` | Application navigation sent over the wire; focus changes active session, close disposes the runtime | Updated `tabs`/catalogue; no operation-specific reply |
| `browseDirectories` | Server-local directory listing with path/base path, hidden-entry option and cursor | Correlated `directoryListing` or `directoryBrowseError` |
| `completeCommandArguments` | Session-specific Pi command completion | Correlated `commandArgumentCompletions`; optional string error |
| `openFile` | Opens a server-local file associated with a session's project | Correlated `fileOpenResult`; success means the OS accepted the open, not that a client displayed it |
| `setSessionArchived`, `pinProject`, `removeProject` | Server-level project/catalogue mutations; archive rejects active/busy sessions and closes an open runtime after persisting archive metadata | Correlated `projectMutationResult`; optional string error |

Request-scoped replies are handled by four browser trackers (folder/session-open, completion, file, and project mutations) and do not enter transcript state. Folder/completion wait cancellation and disconnect reject local promises; file opens are bounded/deduplicated and time out without retry; project mutation outcomes can be uncertain on disconnect. The protocol itself supplies no general mutation retry or deduplication guarantee.

## V1 server messages and state

### Session-scoped sequenced messages

`snapshot`, `assistantDelta`, `thinkingDelta`, `messageFinal`, `toolEvent`, `runtimeStatus`, `steeringQueue`, `prompts`, `widgets`, `footer`, and `notification` carry `sessionId` and a per-session `sequence`. Runtime events increment that sequence. A snapshot carries both `sequence` and `throughSequence` at the current watermark but does not increment it. Metadata/session-switch runtime events are internal triggers for a fresh snapshot rather than standalone wire events.

- **Snapshot state:** session identity/path/name, project path, finalized messages, streaming flag, steering queue, last runtime error, optional action/command registry, prompts, widgets, footer, extension contributions, and sometimes catalogue. The runtime snapshot is prepared asynchronously (including extension hooks), then captured and sent synchronously with its watermark. Snapshots are authoritative for server-owned session state.
- **Message union:** user/assistant/system text (assistant may include thinking; user may include skill invocation), tool cards, bash cards, displayable custom messages, and browser-local notice entries. Notices are not Pi history; the reducer anchors/preserves them around snapshots. Tool-call IDs and SDK object identity keep live and snapshot cards/messages correlated. Session history reflects Pi's current context and can change after compaction.
- **Streaming:** `assistantDelta`/`thinkingDelta` append to the current run draft; `messageFinal` appends only if its ID is absent (it does not replace an existing message) and clears the draft for any assistant final, without checking its run ID; `toolEvent` merges by tool-call ID. On disconnect the browser discards the unfinished draft. Snapshots report whether a run is active, not its partial assistant text.
- **Prompts:** pending select/confirm/input/editor questions are server-owned runtime state published in `prompts` and snapshots, even outside a model turn. Answers are generic cancelled-or-string/boolean values. Schema validation does not check the answer against prompt kind/options; the registry settles a known prompt once and ignores unknown/late IDs. Default total timeout is five minutes; a controller disconnect starts a sixty-second grace period; disposal cancels pending prompts.
- **Presentation:** keyed plain-text widget and footer/status changes have sequenced events and are repeated in snapshots. Declarative extension buttons/badges/state are snapshot contributions; notifications are transient sequenced events. Terminal-only/custom components are inert or unsupported.
- **Errors/status:** runtime-originated turn errors are retained as snapshot `lastError` until new execution begins. `publishError` also emits `runtimeStatus.error` for operation failures but does not itself persist it in the adapter; not every command error survives a snapshot. The reducer preserves an absent status error unless the status is running. `protocolError` is app-level and uncorrelated. Most command failures do not have structured error codes or a command-specific response.

### Server-wide messages without session sequence

- `tabs` replaces the current open-runtime tab list and includes `activeSessionId`; it has no revision.
- `catalogue` replaces project/session history and may include app-level features; it has no revision.
- Request replies listed above carry request IDs but no event sequence.

The publisher checks that asynchronous work still belongs to the current controller before sending. The server has no `serverInstanceId`/`sessionInstanceId`, so a client cannot distinguish a reopened runtime incarnation using protocol identity alone. Server restart resets publisher sequences; the current browser recovers from lower-sequence restarts by accepting the fresh snapshot.

## V1 wire shapes and validation

The authoritative v1 definitions are `src/shared/protocol.ts`, `src/shared/directories.ts`, and `src/shared/files.ts` (Zod). Client messages form a union of the operation types above; server messages form the response/event types above. IDs/paths have selected length/character bounds, message/tool/bash output has selected truncation bounds, and file-open errors have a structured code/message union. Most other errors are plain strings. Zod object schemas use default object behavior: additive unknown object properties are stripped during parsing, while an unknown discriminant or unsupported version is rejected; there is no explicit required-versus-optional field negotiation.

## Complete server message index

All messages include `version: 1`. Session events below carry `sessionId` and `sequence`; reply rows carry `requestId` but no sequence.

| Message | Payload beyond routing fields | Consumer / update rule |
|---|---|---|
| `snapshot` | `throughSequence`, session metadata, `messages`, `isStreaming`, optional state listed above | Session reducer replaces state; running snapshots preserve the current local draft for the same session |
| `assistantDelta`, `thinkingDelta` | `runId`, `delta` | Append text/thinking, starting a fresh draft for a different run |
| `messageFinal` | `runId`, `message` | Append absent message ID; assistant final clears draft |
| `toolEvent` | `runId`, `tool` | Merge card at `tool:<toolCallId>`; terminal card status never regresses |
| `runtimeStatus` | `status: idle / running / aborting`, optional `error` | Update session status/error; publisher also sends tabs |
| `steeringQueue` | `messages: string[]` | Replace pending Pi-owned steering, preserving repeated texts |
| `prompts` | `prompts` | Replace pending questions; publisher also sends tabs |
| `widgets`, `footer` | Complete `widgets` / `footer` collection | Replace the corresponding presentation collection |
| `notification` | `level`, `message` | Create local notice, not persisted history |
| `tabs` | `tabs`, `activeSessionId` | Replace global navigation/inventory, discard closed session projections |
| `catalogue` | `catalogue`, optional `features` | Replace project history/app capabilities |
| `protocolError` | `error: string` | Set global error; no request identity or error code |
| `directoryListing`, `directoryBrowseError` | `listing` / `error` | Folder tracker resolves/rejects by request ID |
| `sessionOpened`, `sessionOpenError` | `sessionId` / `error` | Folder tracker resolves/rejects a correlated `newSession` |
| `commandArgumentCompletions` | `sessionId`, `items`, optional `error` | Completion tracker matches request and session IDs |
| `fileOpenResult` | `sessionId`, structured `result` | File tracker matches request and session IDs |
| `projectMutationResult` | Optional `error` | Project tracker settles by request ID |

### Feature and request-tracker details

| `runFeature.featureId` | Input and actual completion boundary | V2 mapping |
|---|---|---|
| `thinking.level` | `{level}`; app rejects streaming state, then sets Pi thinking level | Direct method `thinking.level`; correlated completed result and structured settings |
| `model.select` | `{model}`; resolves offered provider/model ID and awaits Pi `setModel` | Direct method `model.select`; correlated completed result and structured settings |
| `session.compact` | `{}`; awaits Pi compaction, publishes running/idle and refreshes snapshots | Direct method `session.compact`; accepted receipt and terminal outcome |
| `app.restart` | `{}`; only advertised with a restart service; may shut down before any reply | Direct optional server-scoped method `server.restart`; acknowledgment before shutdown where supported |

| Tracker | Local policy | Server cancellation/replay |
|---|---|---|
| `FolderRequests` | Matches request ID across browse/open reply family; optional AbortSignal; no built-in deadline or pending-count bound | Cancels the local wait only; no server cancellation/replay |
| `CompletionRequests` | Matches request and session IDs; optional AbortSignal; no built-in deadline or pending-count bound | Cancels the local wait only; no replay |
| `FileRequests` | At most 32 pending; same session/path shares its pending promise; 10-second deadline; close/disconnect cancels waits | OS open may still occur; never automatically replay |
| `ProjectRequests` | Matches request ID; no built-in deadline, AbortSignal or pending-count bound | Disconnect rejects wait; mutation may already have completed; no replay |

## Observed limitations to preserve or fix explicitly

These are source-level findings, not newly implemented fixes:

- **Readiness and compatibility:** initial snapshots can interleave with live events; there is no atomic initialization result or server-ready barrier. The browser silently ignores invalid JSON/schema/unknown server messages. V2 must expose compatibility failure rather than silently lose core state.
- **Sequencing:** the browser ignores non-snapshot events at or below its watermark but does not detect gaps. Snapshots bypass this stale-event check, including lower-watermark snapshots after restart. The atomic server capture rule is already implemented and must survive extraction; v2 adds explicit stale/gap/restart handling.
- **Prompt grace:** `suspend()` starts a timer only if prompts exist at disconnect. The registry does not retain disconnected state, so a question created afterward only has its five-minute timeout, not an automatic sixty-second grace timer. Invalid kind/option answers are not checked; unknown IDs are ignored. V2 must validate answers and cover prompts created while disconnected.
- **Failure routing:** uncorrelated open failures use the currently active session's `runtimeStatus`, not `protocolError`. On Home that ID is empty, which fails the browser's non-empty session ID schema. Synchronous failures from unguarded session lookups (for example unknown-session `abort` or `uiPromptResponse`) are not uniformly converted to replies. V2 requires requester-scoped structured errors, even with no active runtime.
- **Acceptance/completion:** awaiting a normal `prompt` can cover an entire run, whereas steering can return on queue admission; extension/slash/bash operations have different boundaries. There is no wire receipt or request-correlated terminal outcome. Keep Pi scheduling; do not serialize control commands behind whole runs.
- **Mutation versus refresh:** `newSession` sends a correlated success after creation even if snapshot refresh fails, before catalogue scanning. Project mutation replies wait for catalogue refresh; `sendCatalogue` catches a scan error and publishes a separate runtime error, then the mutation can still report success. V2 should report mutation outcomes independently and not delay them on catalogue refresh.
- **Close/open races:** `SessionRegistry.close` removes/unsubscribes the entry before awaiting disposal; there is no closing state, terminal event or explicit partial-disposal outcome. The browser optimistically hides the tab; an error alone does not clear that pending-close marker. Existing open-by-path reuse is not an in-flight single-flight guarantee. V2 must define teardown failure, convergence of concurrent opens, and stale-runtime work handling.
- **Boundaries/limits:** no application-level heartbeat, general pending-work limit, or outbound slow-consumer recovery is defined. Widgets/footer consume core sequence numbers; blindly filtering them in a future client would create gaps. Extension snapshot state is `unknown` in TS, without a JSON-value schema. V2 limits and capability filtering need explicit contracts.

## Migration mapping to the proposed v2

| V1 behavior/surface | Proposed v2 direction |
|---|---|
| Connect immediately replaces controller; server pushes state without a ready barrier | `server.initialize` response is the readiness barrier; identity/capabilities/inventory/snapshots are explicit |
| Version 1; no compatibility negotiation | Coordinated v2-only cutover; v1 clients are unsupported afterward |
| V1 `sessionId` follows Pi's session identity and may recur when history is reopened | V2 assigns a unique runtime `sessionId`, independent of Pi's history ID; reconnect retains it, but runtime replacement or close/reopen gets a fresh ID. No separate `sessionInstanceId` |
| `tabs`, `activeSessionId`, `focusTab`, `closeTab` are wire-level | Tabs/focus stay application-owned; server exposes session inventory/lifecycle. Pi Chat calls `session.close` when a tab closes |
| Many commands have no correlated acceptance/result; error shape varies by command | Uniform request/response/error envelope; operation contract states admission versus completed mutation |
| Domain features use `runFeature` IDs; footer includes formatted settings text | Use namespaced `resource.action` request methods directly, without a `runFeature`/`featureId` wrapper; expose structured core settings separately from optional presentation |
| Separate `prompts`, `widgets`, and `footer` events share core session sequence | Proposed full prompt/presentation models and independently revised optional presentation state; core sequencing remains gap-free |
| `tabs` and `catalogue` have no revision | Complete replacement inventory/catalogue views have independent revisions |
| Snapshot has no runtime incarnation and no in-progress assistant draft | Use a unique runtime `sessionId`; snapshot draft completeness remains an explicit v2 review question |
| V1 project/file/folder semantics are server-local | Preserve them as typed, explicitly scoped v2 operations/capabilities |

V2 method names use `resource.action` uniformly: `session.create/open/list/snapshot/close`, `project.list`, `message.send`, `run.abort`, `prompt.answer`, `model.select`, `thinking.level`, `session.compact/reload`, `extension.run`, `directory.browse`, `command.complete`, `session.archive`, `project.pin/remove`, `file.open`, and `server.initialize/ping/restart`. Slash-separated suffixes here abbreviate distinct methods (for example `session.create` and `session.open`), not literal wire names. V1 names above remain the observed baseline; SDK method names may remain idiomatic.

### V2 event naming

V2 event names follow the same dot-separated namespace convention as methods, describing state or outcomes rather than requested actions. Payloads and sequencing semantics are unchanged by renaming. The observed v1 event names elsewhere in this inventory remain unchanged.

| V1 event or earlier v2 draft name | V2 event name |
|---|---|
| `snapshot` | `session.snapshot` |
| `runtimeStatus` | `runtime.status` |
| `sessionClosed` (v2 draft) | `session.closed` |
| `tabs` / `sessionsChanged` (v2 draft) | `session.list.changed` (runtime inventory only; navigation remains local) |
| `sessionReplaced` (v2 draft) | `session.replaced` |
| `serverStopping` (v2 draft) | `server.stopping` |
| `assistantDelta` | `message.delta` |
| `thinkingDelta` | `message.thinking.delta` |
| `messageFinal` | `message.finalized` |
| `toolEvent` | `tool.updated` |
| `steeringQueue` | `steering.queue.changed` |
| `settingsChanged` (v2 draft) | `settings.changed` |
| `operationFinished` (v2 draft) | `operation.finished` |
| `notification` | `notification.created` |
| `prompts` | `prompt.list.changed` |
| `widgets` / `footer` / `presentationChanged` (v2 draft) | `presentation.changed` (complete optional presentation view) |
| `catalogue` / `catalogueChanged` (v2 draft) | `project.list.changed` |

The v2 draft lives in [PROTOCOL.md](PROTOCOL.md). This inventory does not resolve its remaining protocol questions or authorize runtime changes.

## External protocol comparison: fix, document, defer

References: [AHP overview](https://microsoft.github.io/agent-host-protocol/) and [tryingET/pi-server specification](https://github.com/tryingET/pi-server/blob/main/PROTOCOL.md). These are design references, not dependencies or compatibility targets; their protocol versions are unrelated to Pi Chat v1/v2.

| Reference / concrete gap | Classification | Pi Chat migration decision |
|---|---|---|
| AHP makes authoritative session state independent of client UI | **Fix** | Replace server-owned tabs/focus with runtime inventory; keep tab selection local |
| AHP orders changes and specifies projection/reconciliation | **Fix / document** | Retain atomic snapshots/per-session sequence; add explicit initialization, runtime identity and gap recovery. Document snapshot replacement rather than optimistic write-ahead reconciliation |
| AHP synchronizes multiple controlling/subscribed clients | **Defer** | Single controller remains; no subscriptions or concurrent-client reconciliation |
| tryingET/pi-server separates command admission, execution and terminal outcomes | **Fix** | Define v2 accepted receipts versus completed mutations and terminal events without adding its scheduler/dependency machinery |
| tryingET/pi-server documents versioning, readiness and response/error rules | **Fix** | Specify v2 readiness/errors and test unsupported versions; no v1 compatibility period |
| tryingET/pi-server includes replay, idempotency, dependency and session-version checks | **Defer / document** | No durable journal, `dependsOn` or automatic replay. Document uncertain outcomes; unique runtime IDs reject stale runtime work, not duplicate external side effects |
| Both references have broader multi-client/interoperability surfaces | **Defer** | Do not replace Pi's runtime, adopt their wire formats, or promise third-party interoperability |

## Completion and handover

- Slice 1 delivers this observed v1 inventory plus the separate [proposed v2 draft](PROTOCOL.md). All client variants, server message families, feature variants and four browser request trackers have been checked against source.
- Preserve during extraction: Pi-owned steering (including equal texts), SDK-owned compaction-aware transcript, atomic snapshot capture/watermark/send, streamed drafts across running snapshots, session-scoped prompts, controller takeover and server-local file/project behavior. Do not introduce a second runtime queue or branch-history store.
- Apply in v2: unique runtime `sessionId`, uniform request errors/receipts, local navigation, validated prompts, explicit readiness/recovery and optional presentation revisions. The documented v1 limitations are not compatibility requirements.
- Deferred v2 decisions remain in `PROTOCOL.md`: final envelope, Pi admission handoff/operation outcome lookup, complete in-progress drafts, limits/heartbeats and partial teardown behavior. Completing this inventory does not silently settle them.
- Packaging names are confirmed: `@manuelselch/pi-server`, `@manuelselch/pi-sdk` and SwiftPM product/module `PiSDK`. SDK languages share the `pi-sdk` repository. Registry availability, manifests and Swift generation feasibility are implementation checks, not naming questions.
- Verification passed: schema-to-inventory discriminator coverage (16 client types / 19 variants, 21 server types, four feature variants), local Markdown links/whitespace, and the focused protocol/transport/prompt/request-tracker/reducer suite (**12 test files, 103 tests**). No v2 runtime implementation, real-Pi run, remote deployment or package publication is part of this slice.

## Source and regression-test references

- Wire schemas: `src/shared/protocol.ts`, `src/shared/directories.ts`, `src/shared/files.ts`.
- Dispatch/transport/publication: `src/server/transport/websocket-transport.ts`, `command-handler.ts`, `server-publisher.ts`.
- Application/session/runtime boundaries: `src/server/application/chat-application-service.ts`, `session-registry.ts`, `src/server/runtime/contracts.ts`, `src/server/runtime/pi/pi-runtime-adapter.ts`, `event-mapping.ts`, `snapshot.ts`.
- Browser transport/projections: `src/web/app/use-pi-chat.ts`, `src/web/app/state/app-state.ts`, `chat-state.ts`, `src/web/app/connection/*-requests.ts`.
- Existing evidence: `test/modules/server/transport/websocket-transport.test.ts`, `snapshot-publication.test.ts`, `folder-protocol.test.ts`, `file-protocol.test.ts`, `project-protocol.test.ts`, `test/modules/server/extensions/ui/ui-prompt-registry.test.ts`, `test/modules/web/app/connection/*-requests.test.ts`, `test/modules/web/app/state/app-state.test.ts`, and `chat-state.test.ts`.
