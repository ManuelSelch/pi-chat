# Pi Server Protocol — V2

**Implemented wire version: `2`. The coordinated server, TypeScript SDK and Pi Chat cutover is complete; v1 is unsupported.**

The authoritative Zod protocol, domain schemas, generated JSON Schemas and fixtures now live in the independent `pi-sdk-typescript` repository. Chat consumes its public `@manuelselch/pi-sdk/protocol` entry and `/protocol/schema/**` and `/protocol/fixtures/**` artifacts. See the [pinned artifact receipt and update instructions](../../vendor/README.md) and [extraction handover](../pi-server-extraction/HANDOVER.md). This document retains the server-side v2 protocol reference; no v1 negotiation or compatibility path exists. See the historical [cutover verification](CUTOVER.md).

## 1. Boundaries

- **Server:** sessions, execution, history, projects, structured questions and authoritative state.
- **SDK:** transport, typed requests/results, session projections and reconnect.
- **Application:** tabs, focus, navigation, layout and input drafts. These have no protocol messages.
- The client chooses which saved session to open, or creates a new one. Selecting a project's latest session is not a server operation.
- Pi Chat currently closes a runtime when its tab closes. That remains an application policy: call `session.close`, then remove the local tab. Failure retains/restores the tab. Hiding a view or disconnecting does not itself close anything.

## 2. Connection

- WebSocket `/ws`, one JSON object per text message. No batches or binary messages initially.
- Remote access uses HTTPS/WSS through the homelab reverse proxy, which owns TLS termination and authentication. Pi Server and the SDK implement no application authentication or OAuth flow initially; the backend must remain loopback/private so remote clients cannot bypass the proxy. Apply browser-origin validation. OAuth could be added later at the proxy/transport boundary without changing v2 session operations or events. Default binding remains loopback.
- One controller connection may operate multiple concurrent sessions. A remote connection admitted by the proxy (or a local loopback connection) becomes controller only after initialization.
- Replaced connections close with code `4001`. They must not automatically reconnect until the user explicitly takes control.
- First request: `server.initialize`, carrying client name/version and requested optional capabilities.
- Result: protocol/server versions, `serverInstanceId`, `connectionId`, selected capabilities, complete open-session inventory, project catalogue and snapshots for all open sessions.
- Initialization is the readiness barrier: apply the whole result before processing later events or sending work. No navigation state is exchanged.
- The initial project catalogue is the last published cache (empty at revision 0 on cold start). A full disk/worktree refresh runs asynchronously and publishes `project.list.changed` with a newer revision; catalogue discovery never blocks readiness. If discovery finishes during runtime snapshot preparation, the initial result includes that newer catalogue. A failed refresh retains the cached catalogue. Runtime inventory/snapshots still use the atomic current-state barrier.
- Every message carries `version: 2`. Unsupported versions fail explicitly; unknown optional fields are ignored. Unknown required core variants are compatibility errors. Software/package versions are independent of wire versions.

## 3. Messages and identity

| Kind | Fields |
|---|---|
| Request | `version`, `type: request`, `requestId`, `method`, `params`; `sessionId` when scoped |
| Response | `version`, `type: response`, `requestId`, `ok`; either `result` or `error` |
| Session event | `version`, `type: event`, `event`, `serverInstanceId`, `sessionId`, `sequence`, `data` |
| Server event | `version`, `type: event`, `event`, `serverInstanceId`, `data` |
| Protocol error | `version`, `type: protocolError`, `error` |

- Requests receive one response while their originating connection remains current and writable. Responses never move to a replacement connection. Duplicate request IDs on one connection are protocol errors.
- Errors contain machine-readable `code`, readable `message` and optional `details`. Examples: `invalidRequest`, `unsupportedVersion`, `unsupportedOperation`, `sessionNotFound`, `sessionReplaced`, `sessionBusy`, `invalidPromptAnswer`, `permissionDenied`, `operationFailed`.
- `serverInstanceId` changes on process restart. `sessionId` is a fresh opaque unique ID assigned whenever a runtime is created, loaded or replaced; it is not Pi's persisted session ID. Reconnect and opening an already-loaded session retain its ID; closing and reopening saved history creates a new ID. In-place resource reload retains the ID unless it replaces the runtime. Session requests name only `sessionId`; IDs are never reused, so stale commands cannot target a reopened runtime. No separate `sessionInstanceId` is needed.
- `sessionPath` identifies saved history on the server filesystem. It may be absent before Pi saves a session. `runId`, `promptId` and `operationId` identify execution, a question and admitted asynchronous work respectively.
- Wire identifiers (request/runtime/process/connection/run/prompt/operation/message/tool/presentation IDs) are non-control strings capped at 128 characters. Pi-generated message/tool identities that exceed the wire bound are deterministically reduced to a short SHA-256-derived opaque ID in the server adapter, consistently across events and snapshots. Timestamps use epoch milliseconds; counters use safe JSON integers. Optional fields are omitted unless their schema explicitly permits null.

## 4. Operations

Request methods use namespaced `resource.action` values directly in the request/response envelope, with typed `params` and results. There is no `runFeature`/`featureId` wrapper in v2. SDK convenience methods may use idiomatic names: `client.createSession()` sends `method: "session.create"`. Event names use the same dot-separated namespaces, but describe state or outcomes rather than requested actions (for example `session.close` → `session.closed`). Payload field names and envelope `type` values are unaffected.

### 4.1 Session lifecycle and navigation

Session operations require the target runtime's `sessionId`. Server operations do not depend on a focused session.

| Method | Scope / input | Response meaning |
|---|---|---|
| `session.create` | Server; optional `projectPath` | Created summary and snapshot; omitted path uses server default |
| `session.open` | Server; `sessionPath` | Loaded/existing summary and snapshot; concurrent opens converge to one runtime |
| `session.list` | Server | Complete runtime inventory |
| `session.snapshot` | Session | Current state and event watermark |
| `session.close` | Session | Teardown completed; saved history is not deleted |
| `project.list` | Server | Known projects with metadata and nested saved-session summaries; not all server directories |
| `server.ping` | Server | Completed liveness check |

### 4.2 Message, run and model control

| Method | Scope / input | Response meaning |
|---|---|---|
| `message.send` | Session; `message` | Accepted operation receipt; new chat/steering/command/bash input, not a dialog answer |
| `run.abort` | Session | Accepted abort receipt, or completed no-op if idle |
| `prompt.answer` | Session; `promptId`, `result` | Question settled |
| `model.select` | Session; `{ model: string }` | Completed change and structured settings |
| `thinking.level` | Session; `{ level: ThinkingLevel }` | Completed change and structured settings |
| `session.compact` | Session; `{}` | Accepted operation receipt |
| `session.reload` | Session; `{}` | Accepted operation receipt |

Unknown methods or unsupported optional operations return an explicit error. Session operations require `sessionId`; server operations do not require a session or use a placeholder ID.

### 4.3 Extensions and UI

| Method | Scope / input | Response meaning |
|---|---|---|
| `extension.run` | Session; `actionId` | Accepted operation receipt |

### 4.4 Optional capability operations

Optional capabilities expose these operations and presentation contributions. Clients use only advertised/selected capabilities. Directory/completion/catalogue data retain existing field semantics; exact models follow in schemas.

| Method | Scope / purpose |
|---|---|
| `directory.browse` | Server; list server-local directories |
| `command.complete` | Session; complete slash-command arguments |
| `session.archive` | Server; set saved-history archive state by path, including unarchive |
| `project.pin` | Server; set project pin state |
| `project.remove` | Server; remove catalogue membership |
| `file.open` | Session; open a server-local file |
| `server.restart` | Server; acknowledge before shutdown where supported; disconnect alone does not prove restart succeeded |

Paths refer to the server. `file.open` opens there, not on iOS. Removing a project removes catalogue membership, not files. Archiving rejects busy runtimes, persists metadata, then closes an open runtime; partial success must be reported rather than hidden.

## 5. Execution and lifecycle

- `message.send` preserves Pi behavior: plain input starts a run or steers an active run; slash commands and `!`/`!!` use existing command/bash rules. Pi owns scheduling and queues. Equal text submissions remain distinct.
- Long operations return `{state: accepted, operationId}` after validation/handoff, not after model completion. Publish acceptance before related events. Failures after acceptance are operation outcomes, not second responses.
- `operation.finished` reports the operation ID, original request ID and completed/failed/aborted outcome. Receipts are process-local and not replayed. Steering completes submission when Pi accepts it; queue consumption and the ongoing run remain separate state.
- Closing rejects new work, aborts execution, cancels questions and disposes the runtime before reporting success. `session.closed` is its final event, followed by inventory removal.
- `run.abort` stops execution without closing the session. Disconnect leaves runtimes alive; server restart may interrupt them. This is not durable execution.
- SDK-driven session switching emits one atomic `session.replaced` with the previous `sessionId` and a new snapshot containing a fresh `sessionId`; it is not preceded by `session.closed`. The client swaps identities and inventory in a single update, and updating client navigation is application-owned: a selection on the previous identity transfers to the replacement.
- A completed mutation remains successful even if a later catalogue refresh fails. Rejections must not falsely settle another active run.

## 6. State and recovery

- Snapshots contain identity, `throughSequence`, metadata, finalized messages, runtime status/run/error, steering queue, structured model/thinking settings, commands, pending questions and optional presentation state.
- Messages retain existing text/thinking, skill, tool, bash, custom-message and truncation data. Snapshots reflect Pi's current context; compaction may shorten history. Live/final/snapshot entries use consistent IDs within a runtime.
- Core session events increment a per-runtime `sequence`. Snapshot watermarks do not increment it. Prepare asynchronously, then capture current state/watermark and enqueue synchronously; never stamp stale state with a newer sequence.
- Apply only non-stale snapshots and events above the watermark. On a gap, recover through a fresh snapshot with bounded buffering; overflow requires reconnect. New process/runtime identities reset the projection.
- `session.list.changed` and `project.list.changed` carry complete replacement views with independent revisions. Optional `presentation.changed` also uses its own revision, not the core sequence, so capability filtering creates no gaps.
- Reconnect repeats initialization and receives current state, not missed-event replay. Drop obsolete socket callbacks and incomplete drafts; reconcile local navigation against inventory. Retain the client's selected runtime if it remains in the complete inventory; otherwise select the first inventory entry in server order, or show Home when empty. Focus is never sent to the server. Transient notifications and operation outcomes may be lost.
- The current draft does not guarantee recovering an unfinished answer's already-streamed prefix. Clients may show running state until a complete final message arrives. Complete current-draft snapshots remain a review question.
- Runtime errors survive snapshots until new execution begins. Optional widgets/footer/slots are rendering hints; core settings must not be parsed from formatted UI text.

### Server events

The event stream is grouped by domain here for readability. Each event carries `type: event`, its namespaced `event` name, `sessionId` when applicable, and `serverInstanceId`. The method `session.snapshot` and event `session.snapshot` are distinguished by their request/event envelopes.

Core session events use `sequence`; `session.snapshot` carries its existing `throughSequence` watermark without incrementing it. Optional `presentation.changed` uses its own revision instead of a core sequence. Server-wide replacement lists carry independent revisions. Naming changes do not change payloads or recovery rules.

#### Session lifecycle and inventory events

| Event | Scope | `data` / application rule |
|---|---|---|
| `session.snapshot` | Session | Complete `SessionSnapshot`; replace authoritative projection |
| `runtime.status` | Session | Complete `RuntimeState`; omitted optional fields clear their old values |
| `session.closed` | Session | `reason: requested / archived / shutdown / replaced`; terminal for this incarnation |
| `session.list.changed` | Server | `revision`, `sessions: OpenSessionSummary[]`; replace runtime inventory |
| `session.replaced` | Server | `previousSessionId` and new `snapshot` with a fresh `sessionId`; one atomic handoff that invalidates the old runtime and replaces its inventory entry without closing it first or selecting a UI tab |
| `server.stopping` | Server | `reason: shutdown / restart`; best-effort warning, not a guaranteed delivery |

#### Message and execution events

| Event | Scope | `data` / application rule |
|---|---|---|
| `message.delta`, `message.thinking.delta` | Session | `runId`, `delta`; append to that run's draft |
| `message.finalized` | Session | `runId`, `message`; upsert by message ID and clear the matching assistant draft |
| `tool.updated` | Session | `runId`, `tool`; merge by toolCallId without regressing terminal status |
| `steering.queue.changed` | Session | `messages: string[]`; replace queued text, preserving duplicates |
| `settings.changed` | Session | Complete `SessionSettings` |
| `operation.finished` | Session | `operationId`, `requestId`, `outcome: completed / failed / aborted`, `error?` |
| `notification.created` | Session | `level: info / warning / error`, `message`; transient, no acknowledgment |

#### TUI and presentation events

| Event | Scope | `data` / application rule |
|---|---|---|
| `prompt.list.changed` | Session | `prompts: Prompt[]`; replace pending questions; missing IDs are resolved/cancelled |
| `presentation.changed` | Session, optional | Complete `Presentation`; replace widgets/footer/contributions; removal is represented by absence from the new collection |

#### Project and catalogue events

| Event | Scope | `data` / application rule |
|---|---|---|
| `project.list.changed` | Server | `revision`, `catalogue: ProjectCatalogue`; replace catalogue |

### Server models

Illustrative TypeScript definitions, not implemented SDK exports. `?` means optional; unions describe distinct wire shapes. Collections are complete current values. Schemas will enforce bounds and cross-field rules; local notification bubbles are not authoritative history.

**Sessions and messages**

```typescript
interface SessionIdentity {
  sessionId: string; // Unique runtime ID, not the persisted Pi session ID.
}

interface OpenSessionSummary extends SessionIdentity {
  title: string;
  sessionPath?: string;
  projectPath: string;
  projectName: string;
  status: "idle" | "running" | "blocked" | "closing";
}

interface SessionSnapshot extends SessionIdentity {
  throughSequence: number;
  sessionPath?: string;
  sessionName?: string;
  projectPath: string;
  messages: ChatMessage[];
  runtime: RuntimeState;
  steeringMessages: string[];
  settings: SessionSettings;
  commands: SlashCommand[];
  prompts: Prompt[];
  presentation?: Presentation;
}

interface RuntimeState {
  status: "idle" | "running" | "aborting" | "closing";
  runId?: string;
  lastError?: string;
}

interface SessionSettings {
  model: string; // Opaque server-offered ID.
  availableModels: string[];
  thinkingLevel: ThinkingLevel;
  availableThinkingLevels: ThinkingLevel[];
}

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

interface SlashCommand {
  name: string; // Invoke /name ... through message.send.
  description?: string;
  argumentHint?: string;
  source?: "native" | "extension" | "prompt" | "skill";
}

interface MessageIdentity {
  id: string;
  timestamp?: number;
}

type ChatMessage = MessageIdentity & (
  | { role: "user" | "assistant" | "system"; text: string; thinking?: string;
      skill?: { name: string; location: string; content: string } }
  | { role: "tool"; tool: ToolCard }
  | { role: "bash"; bash: BashCard }
  | { role: "custom"; customType: string; text: string }
);

interface ToolCard {
  toolCallId: string;
  name: string;
  status: "running" | "success" | "error";
  argsText?: string;
  outputText?: string;
  writeContent?: { text: string; truncated: boolean };
  editDiff?: {
    format: "unified" | "pi-display";
    text: string;
    truncated: boolean;
    firstChangedLine?: number;
  };
}

interface BashCard {
  command: string;
  output: string;
  status: "running" | "success" | "error" | "cancelled";
  exitCode?: number;
  excludeFromContext: boolean;
  truncated: boolean;
  fullOutputPath?: string;
}
```

**Questions and optional presentation**

```typescript
interface PromptBase {
  id: string; // Passed as promptId to prompt.answer.
  title: string;
}

type Prompt = PromptBase & (
  | { kind: "select"; options: string[] }
  | { kind: "confirm"; message: string }
  | { kind: "input"; placeholder?: string }
  | { kind: "editor"; prefill?: string }
);

type PromptResult =
  | { cancelled: true }
  | { cancelled: false; value: string | boolean };
// Server validates value against the pending prompt kind and offered options.

interface Presentation {
  revision: number;
  widgets: Widget[];
  footer: FooterItem[];
  extensions: ExtensionContributions;
}

interface Widget {
  key: string;
  lines: string[];
  placement: "aboveEditor" | "belowEditor"; // Layout hint.
}

interface FooterItem {
  key: string;
  text: string;
  align: "left" | "right";
  variant: "badge" | "plain";
}

type Slot = "session.header.right" | "composer.right" | "composer.below"
  | "session.status" | "settings.section";

interface ExtensionContributions {
  buttons: ExtensionButton[];
  badges: ExtensionBadge[];
  state: Record<string, JsonValue>; // Namespaced by extension.
}

interface ExtensionButton {
  id: string;
  slot: Slot;
  label: string;
  icon?: string;
  actionId: string; // Invoked through extension.run.
}

interface ExtensionBadge {
  id: string;
  slot: Slot;
  label: string;
  tone: "neutral" | "green" | "yellow" | "red";
}

type JsonValue = null | boolean | number | string | JsonValue[]
  | { [key: string]: JsonValue };
```

**Project catalogue and saved history**

```typescript
interface ProjectCatalogue {
  projects: ProjectSummary[];
}

interface ProjectSummary {
  path: string;
  displayPath: string;
  name: string;
  exists: boolean;
  modified: number;
  sessionCount: number;
  pinned?: boolean;
  quickChats?: boolean;
  sessions: SavedSessionSummary[];
  repositoryPath?: string;
  repositoryName?: string;
  worktree?: {
    branch?: string;
    commit?: string;
    detached: boolean;
    primary: boolean;
  };
}

interface SavedSessionSummary {
  path: string;
  id: string;
  title: string;
  name?: string;
  nameSource: "manual" | "auto" | "none";
  firstMessage?: string;
  modified: number;
  created: number;
  messageCount: number;
  archivedAt?: number;
}
```

Catalogue fields retain existing semantics. `SavedSessionSummary.id` is Pi's persisted history ID, not the runtime `sessionId`; use `sessionPath` to associate a loaded runtime with saved history. A saved history entry does not prove a runtime is loaded. Summary status is blocked when prompts are pending; detailed runtime status remains in `RuntimeState`.

### Pi extension UI mapping

| Pi UI call | Server output | Client action |
|---|---|---|
| `select(title, options)` | `Prompt` kind select with `options` | `prompt.answer`: offered string or cancellation |
| `confirm(title, message)` | `Prompt` kind confirm with `message` | `prompt.answer`: boolean or cancellation |
| `input(title, placeholder)` | `Prompt` kind input with `placeholder?` | `prompt.answer`: string or cancellation |
| `editor(title, prefill)` | `Prompt` kind editor with `prefill?` | `prompt.answer`: string or cancellation |
| `notify(message, level)` | `notification.created` event | Display only |
| `setWidget(key, lines, placement)` | Updated `Presentation.widgets` | Render if supported; clearing removes the keyed widget |
| `setStatus(key, text)` | Updated keyed `Presentation.footer` item | Render if supported; clearing removes the item |

The server publishes prompts before waiting for answers. New/changed prompts appear in `prompt.list.changed` events and snapshots, independently of model turns. Widget/status updates use optional `presentation.changed` events and snapshots. Mobile may use native controls and different placement.

Arbitrary `ui.custom()` components, component-factory widgets, raw terminal input, custom headers/footers and terminal editor components are **not transported**. They remain unsupported/inert as in the current host unless a future declarative capability is designed. Slash commands and LLM model choices are separate from these UI models.

## 7. Questions, cancellation and retry

- Select/confirm/input/editor questions are snapshot-backed session state, including when no model turn is active. Clients choose modal, sheet or inline rendering.
- Answers are cancelled or typed values: boolean for confirm, an offered string for select, string for input/editor. Validate against the pending question. First valid answer settles once; invalid, duplicate or late answers receive `invalidPromptAnswer`; expiration and teardown cancel the waiting extension.
- Defaults: five-minute total timeout and sixty-second no-controller grace, including questions created while disconnected. Reconnect cancels grace, not the total timeout. Expiration/teardown cancels questions. State does not survive process restart.
- Cancelling a local wait, timeout or disconnect does not cancel server execution. Use `run.abort` or answer a question as cancelled explicitly.
- Lost mutation responses are uncertain outcomes. Never automatically resend input/create/actions/file-open/restart. Request IDs provide correlation, not idempotency. Recover current state before deciding what to do next.

## 8. Implementation decisions and rollout

Implemented v2 cutover decisions:

- Treat the known presentation placements/slots/styles in section 6 as rendering hints, not closed core variants. The wire schemas accept future hint strings; clients ignore unsupported hints/contributions without rejecting required session state.
- Use the custom envelopes in section 3 and wire version **2**, not JSON-RPC. Responses carry no method; SDK correlation validates the successful result against the original request's method-specific schema. Error codes are open strings so new structured failures remain readable.
- Negotiate requested optional capability names by intersection. Unknown requested optional names are ignored; unselected optional operations return `unsupportedOperation`. Unknown core methods return `unsupportedOperation`; malformed known requests return `invalidRequest`.
- Validate identity/scope/capabilities and admission guards before acceptance. Enqueue the accepted response before invoking the admitted asynchronous work, so synchronous Pi callbacks cannot overtake it. Work still runs directly through Pi; no new scheduler or durable journal is introduced. A later handoff/execution failure produces `operation.finished`, never a second response. Steering settlement means Pi accepted the submission, not that the active run finished.
- Do not add an operation query/journal. Operation outcomes can be lost across reconnect. Reinitialize state and expose unknown outcomes; never automatically resend a mutation. `server.restart` is exceptional: its receipt acknowledges the attempt before shutdown; `server.stopping` is best effort and there is no promised post-restart operation outcome.
- Retain the section 6 draft limitation: no promise to recover an unfinished answer's streamed prefix. Drop partial drafts on reconnect; same-process gaps recover from snapshots with bounded buffering.
- Use a 16 MiB text-frame limit, at most 64 concurrent requests, 128-character non-control IDs, safe-integer counters, a 10-second initialization deadline and a 10-second SDK request-wait default. Bound the per-connection seen-ID set at 4,096 requests and require a new connection at exhaustion. Local wait expiry never cancels server work. No automatic heartbeat initially; `server.ping` is the explicit liveness operation.
- Never drop required events silently on transport overload: close/resynchronize rather than publish a valid-looking incomplete projection. A browser Origin must be valid HTTP(S) and match the request Host; origin-less native/CLI clients remain allowed on the private backend. Proxy authentication/TLS is not duplicated by the server.
- Retain a closing runtime entry if teardown fails; reject new work and return structured failure details indicating possible partial teardown. Only confirmed teardown emits final `session.closed` and removes inventory. Retrying explicit close may finish cleanup. No rollback promise for irreversible side effects.

These decisions are implemented and covered by SDK, application, transport and browser tests; schema conformance alone is not treated as proof of runtime behavior.

The v1-to-v2 server/SDK/Pi Chat cutover is coordinated and complete. There is no v1 compatibility or dual-protocol period; v1 clients are unsupported. The current Swift package remains a generation probe/scaffold; its production vertical slice is deferred. Wire-level tabs/focus/project continuation have been removed and project-session selection is client-owned. Closing a Pi Chat client tab calls `session.close`. Multi-client control, subscriptions, durable journals, automatic mutation replay, file transfer and AHP compatibility are deferred.

See [backend/SDK requirements](REQUIREMENTS.md) and [steering/snapshot requirements](../steering/REQUIREMENTS.md). Shared tests must cover lifecycle, streaming/steering, dialogs, version errors, snapshot ordering, reconnect/takeover, uncertain outcomes and slow consumers. V2 schema/fixture conformance is supplemented by real loopback server tests, SDK tests, web/domain drivers, browser e2e and production smoke verification; summary and limits are recorded in [CUTOVER.md](CUTOVER.md).
