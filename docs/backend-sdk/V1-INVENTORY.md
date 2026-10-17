# Pi Chat Protocol v1 — Inventory and Migration Baseline

This document records the implemented v1 behavior observed in the repository. It is an inventory, not a promise that v1 behavior is desirable or that the proposed v2 protocol is implemented. The coordinated migration is v2-only; v1 compatibility is not required.

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
| `openProject` | Server-level path; continues/creates a runtime for the project and focuses its tab | No correlated reply; snapshots/tabs/catalogue or an app-level `protocolError` |
| `openSession` | Server-level saved-session path; focuses an already-open runtime with the same session path or opens it | No correlated reply; snapshots/tabs/catalogue or an app-level `protocolError` |
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
- **Streaming:** `assistantDelta`/`thinkingDelta` append to the current run draft; `messageFinal` upserts by message ID and clears the assistant draft; `toolEvent` merges by tool-call ID. On disconnect the browser discards the unfinished draft. Snapshots report whether a run is active, not its partial assistant text.
- **Prompts:** pending select/confirm/input/editor questions are server-owned runtime state published in `prompts` and snapshots, even outside a model turn. Answers are generic cancelled-or-string/boolean values. Schema validation does not check the answer against prompt kind/options; the registry settles a known prompt once and ignores unknown/late IDs. Default total timeout is five minutes; a controller disconnect starts a sixty-second grace period; disposal cancels pending prompts.
- **Presentation:** keyed plain-text widget and footer/status changes have sequenced events and are repeated in snapshots. Declarative extension buttons/badges/state are snapshot contributions; notifications are transient sequenced events. Terminal-only/custom components are inert or unsupported.
- **Errors/status:** runtime errors appear as `runtimeStatus.error` and persist in snapshots until a new run. `protocolError` is app-level and uncorrelated. Most command failures do not have structured error codes or a command-specific response.

### Server-wide messages without session sequence

- `tabs` replaces the current open-runtime tab list and includes `activeSessionId`; it has no revision.
- `catalogue` replaces project/session history and may include app-level features; it has no revision.
- Request replies listed above carry request IDs but no event sequence.

The publisher checks that asynchronous work still belongs to the current controller before sending. The server has no `serverInstanceId`/`sessionInstanceId`, so a client cannot distinguish a reopened runtime incarnation using protocol identity alone. Server restart resets publisher sequences; the current browser recovers from lower-sequence restarts by accepting the fresh snapshot.

## V1 wire shapes and validation

The authoritative v1 definitions are `src/shared/protocol.ts`, `src/shared/directories.ts`, and `src/shared/files.ts` (Zod). Client messages form a union of the operation types above; server messages form the response/event types above. IDs/paths have selected length/character bounds, message/tool/bash output has selected truncation bounds, and file-open errors have a structured code/message union. Most other errors are plain strings. Zod object schemas use default object behavior: additive unknown object properties are stripped during parsing, while an unknown discriminant or unsupported version is rejected; there is no explicit required-versus-optional field negotiation.

## Migration mapping to the proposed v2

| V1 behavior/surface | Proposed v2 direction |
|---|---|
| Connect immediately replaces controller; server pushes state without a ready barrier | `initialize` response is the readiness barrier; identity/capabilities/inventory/snapshots are explicit |
| Version 1; no compatibility negotiation | Coordinated v2-only cutover; v1 clients are unsupported afterward |
| Session operations identify only `sessionId` | Session-scoped operations also identify `sessionInstanceId`; events identify server/runtime incarnations |
| `tabs`, `activeSessionId`, `focusTab`, `closeTab` are wire-level | Tabs/focus stay application-owned; server exposes session inventory/lifecycle. Pi Chat still calls `closeSession` when a tab closes |
| Many commands have no correlated acceptance/result; error shape varies by command | Uniform request/response/error envelope; operation contract states admission versus completed mutation |
| Runtime UI features are represented by `runFeature` IDs and footer formatting | Typed core operations/settings; optional declarative presentation is separate |
| Separate `prompts`, `widgets`, and `footer` events share core session sequence | Proposed full prompt/presentation models and independently revised optional presentation state; core sequencing remains gap-free |
| `tabs` and `catalogue` have no revision | Complete replacement inventory/catalogue views have independent revisions |
| Snapshot has no runtime incarnation and no in-progress assistant draft | Add runtime identities; snapshot draft completeness remains an explicit v2 review question |
| V1 project/file/folder semantics are server-local | Preserve them as typed, explicitly scoped v2 operations/capabilities |

The v2 draft lives in [PROTOCOL.md](PROTOCOL.md). This inventory does not resolve its remaining protocol questions or authorize runtime changes.

## Source and regression-test references

- Wire schemas: `src/shared/protocol.ts`, `src/shared/directories.ts`, `src/shared/files.ts`.
- Dispatch/transport/publication: `src/server/transport/websocket-transport.ts`, `command-handler.ts`, `server-publisher.ts`.
- Application/session/runtime boundaries: `src/server/application/chat-application-service.ts`, `session-registry.ts`, `src/server/runtime/contracts.ts`, `src/server/runtime/pi/pi-runtime-adapter.ts`, `event-mapping.ts`, `snapshot.ts`.
- Browser transport/projections: `src/web/app/use-pi-chat.ts`, `src/web/app/state/app-state.ts`, `chat-state.ts`, `src/web/app/connection/*-requests.ts`.
- Existing evidence: `test/modules/server/transport/websocket-transport.test.ts`, `snapshot-publication.test.ts`, `folder-protocol.test.ts`, `file-protocol.test.ts`, `project-protocol.test.ts`, `test/modules/server/extensions/ui/ui-prompt-registry.test.ts`, `test/modules/web/app/connection/*-requests.test.ts`, `test/modules/web/app/state/app-state.test.ts`, and `chat-state.test.ts`.
