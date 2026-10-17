# Pi Server Protocol — Draft

**Proposed, not implemented. Target wire version: `2` (provisional).**

A shared contract for TypeScript and Swift clients. The existing [v1 schemas](../../src/shared/protocol.ts) are only the migration baseline; the coordinated cutover replaces them, and v1 is not supported afterward. This draft describes behavior; exact schemas and fixtures follow separately.

## 1. Boundaries

- **Server:** sessions, execution, history, projects, structured questions and authoritative state.
- **SDK:** transport, typed requests/results, session projections and reconnect.
- **Application:** tabs, focus, navigation, layout and input drafts. These have no protocol messages.
- The client chooses which saved session to open, or creates a new one. Selecting a project's latest session is not a server operation.
- Pi Chat currently closes a runtime when its tab closes. That remains an application policy: call `closeSession`, then remove the local tab. Failure retains/restores the tab. Hiding a view or disconnecting does not itself close anything.

## 2. Connection

- WebSocket `/ws`, one JSON object per text message. No batches or binary messages initially.
- Remote access uses HTTPS/WSS through the homelab reverse proxy. Authentication and browser-origin validation are required; TLS alone is not authentication. Authentication is a connection/transport concern, not a session-operation payload. SDK transports accept replaceable credential providers so OAuth can be added later without changing v2 operations or events. Default binding remains loopback.
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

This draft groups operations by domain, but the wire format stays the same: a request/response envelope with `method` and `params`.

### 4.1 Session lifecycle and navigation

Session operations require the target runtime identities. Server operations do not depend on a focused session.

| Method | Scope / input | Response meaning |
|---|---|---|
| `createSession` | Server; optional `projectPath` | Created summary and snapshot; omitted path uses server default |
| `openSession` | Server; `sessionPath` | Loaded/existing summary and snapshot; concurrent opens converge to one runtime |
| `listOpenSessions` | Server | Complete runtime inventory |
| `getSessionSnapshot` | Session | Current state and event watermark |
| `closeSession` | Session | Teardown completed; saved history is not deleted |
| `getCatalogue` | Server | Projects and nested saved-session summaries |
| `ping` | Server | Completed liveness check |

### 4.2 Message, run and model control

| Method | Scope / input | Response meaning |
|---|---|---|
| `sendMessage` | Session; `message` | Accepted operation receipt; new chat/steering/command/bash input, not a dialog answer |
| `abortRun` | Session | Accepted abort receipt, or completed no-op if idle |
| `setModel`, `setThinkingLevel` | Session; selected value | Completed change and structured settings |
| `compactSession`, `reloadSession` | Session | Accepted operation receipt |
| `answerPrompt` | Session; `promptId`, `result` | Question settled |

### 4.3 Extensions and UI

| Method | Scope / input | Response meaning |
|---|---|---|
| `runExtensionAction` | Session; `actionId` | Accepted operation receipt |

### 4.4 Optional capability operations

Optional capabilities expose `browseDirectories`, `completeCommandArguments`, `setSessionArchived`, `pinProject`, `removeProject`, `openFile`, `restartServer` and presentation contributions. Clients use only advertised/selected capabilities. Directory/completion/catalogue data retain existing field semantics; exact models follow in schemas.

Paths refer to the server. `openFile` opens there, not on iOS. Removing a project removes catalogue membership, not files. Archiving rejects busy runtimes, persists metadata, then closes an open runtime; partial success must be reported rather than hidden.

## 5. Execution and lifecycle

- `sendMessage` preserves Pi behavior: plain input starts a run or steers an active run; slash commands and `!`/`!!` use existing command/bash rules. Pi owns scheduling and queues. Equal text submissions remain distinct.
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
- Reconnect repeats initialization and receives current state, not missed-event replay. Drop obsolete socket callbacks and incomplete drafts; reconcile local navigation against inventory. Transient notifications and operation outcomes may be lost.
- The current draft does not guarantee recovering an unfinished answer's already-streamed prefix. Clients may show running state until a complete final message arrives. Complete current-draft snapshots remain a review question.
- Runtime errors survive snapshots until new execution begins. Optional widgets/footer/slots are rendering hints; core settings must not be parsed from formatted UI text.

### Server events

The event stream is grouped by domain here for readability. The actual wire envelope is unchanged: each event still carries `type: event`, `event`, `sessionId`/`sessionInstanceId` when applicable, and `serverInstanceId`.

#### Session lifecycle and inventory events

| Event | Scope | `data` / application rule |
|---|---|---|
| `snapshot` | Session | Complete `SessionSnapshot`; replace authoritative projection |
| `runtimeStatus` | Session | Complete `RuntimeState`; omitted optional fields clear their old values |
| `sessionClosed` | Session | `reason: requested / archived / shutdown / replaced`; terminal for this incarnation |
| `sessionsChanged` | Server | `revision`, `sessions: OpenSessionSummary[]`; replace runtime inventory |
| `sessionReplaced` | Server | Previous session identities and new `snapshot`; invalidate old runtime, then reconcile inventory without selecting a UI tab |
| `serverStopping` | Server | `reason: shutdown / restart`; best-effort warning, not a guaranteed delivery |

#### Message and execution events

| Event | Scope | `data` / application rule |
|---|---|---|
| `assistantDelta`, `thinkingDelta` | Session | `runId`, `delta`; append to that run's draft |
| `messageFinal` | Session | `runId`, `message`; upsert by message ID and clear the matching assistant draft |
| `toolEvent` | Session | `runId`, `tool`; merge by toolCallId without regressing terminal status |
| `steeringQueue` | Session | `messages: string[]`; replace queued text, preserving duplicates |
| `settingsChanged` | Session | Complete `SessionSettings` |
| `operationFinished` | Session | `operationId`, `requestId`, `outcome: completed / failed / aborted`, `error?` |
| `notification` | Session | `level: info / warning / error`, `message`; transient, no acknowledgment |

#### TUI and presentation events

| Event | Scope | `data` / application rule |
|---|---|---|
| `prompts` | Session | `prompts: Prompt[]`; replace pending questions; missing IDs are resolved/cancelled |
| `presentationChanged` | Session, optional | Complete `Presentation`; replace widgets/footer/contributions; removal is represented by absence from the new collection |

#### Project and catalogue events

| Event | Scope | `data` / application rule |
|---|---|---|
| `catalogueChanged` | Server | `revision`, `catalogue: ProjectCatalogue`; replace catalogue |

### Server models

Illustrative TypeScript definitions, not implemented SDK exports. `?` means optional; unions describe distinct wire shapes. Collections are complete current values. Schemas will enforce bounds and cross-field rules; local notification bubbles are not authoritative history.

**Sessions and messages**

```typescript
interface SessionIdentity {
  sessionId: string;
  sessionInstanceId: string;
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
  name: string; // Invoke /name ... through sendMessage.
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
  id: string; // Passed as promptId to answerPrompt.
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
  actionId: string; // Invoked through runExtensionAction.
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

Catalogue fields retain existing semantics. `SavedSessionSummary.id` identifies history; it does not prove a runtime is loaded. Summary status is blocked when prompts are pending; detailed runtime status remains in `RuntimeState`.

### Pi extension UI mapping

| Pi UI call | Server output | Client action |
|---|---|---|
| `select(title, options)` | `Prompt` kind select with `options` | `answerPrompt`: offered string or cancellation |
| `confirm(title, message)` | `Prompt` kind confirm with `message` | `answerPrompt`: boolean or cancellation |
| `input(title, placeholder)` | `Prompt` kind input with `placeholder?` | `answerPrompt`: string or cancellation |
| `editor(title, prefill)` | `Prompt` kind editor with `prefill?` | `answerPrompt`: string or cancellation |
| `notify(message, level)` | `notification` event | Display only |
| `setWidget(key, lines, placement)` | Updated `Presentation.widgets` | Render if supported; clearing removes the keyed widget |
| `setStatus(key, text)` | Updated keyed `Presentation.footer` item | Render if supported; clearing removes the item |

The server publishes prompts before waiting for answers. New/changed prompts appear in `prompts` events and snapshots, independently of model turns. Widget/status updates use optional `presentationChanged` events and snapshots. Mobile may use native controls and different placement.

Arbitrary `ui.custom()` components, component-factory widgets, raw terminal input, custom headers/footers and terminal editor components are **not transported**. They remain unsupported/inert as in the current host unless a future declarative capability is designed. Slash commands and LLM model choices are separate from these UI models.

## 7. Questions, cancellation and retry

- Select/confirm/input/editor questions are snapshot-backed session state, including when no model turn is active. Clients choose modal, sheet or inline rendering.
- Answers are cancelled or typed values: boolean for confirm, an offered string for select, string for input/editor. Validate against the pending question. First valid answer settles once; invalid/late answers receive explicit errors.
- Defaults: five-minute total timeout and sixty-second no-controller grace, including questions created while disconnected. Reconnect cancels grace, not the total timeout. Expiration/teardown cancels questions. State does not survive process restart.
- Cancelling a local wait, timeout or disconnect does not cancel server execution. Use `abortRun` or answer a question as cancelled explicitly.
- Lost mutation responses are uncertain outcomes. Never automatically resend input/create/actions/file-open/restart. Request IDs provide correlation, not idempotency. Recover current state before deciding what to do next.

## 8. Open decisions and rollout

- Authentication ownership/mechanism for browser and Swift behind the reverse proxy; OAuth can be introduced later through the transport credential-provider boundary.
- Final envelope choice (custom versus JSON-RPC) and wire version confirmation.
- Admission handoff against Pi's SDK; whether operation outcomes need querying after reconnect.
- Whether full in-progress assistant drafts are required in snapshots.
- Message/work limits, heartbeat/timeouts and partial teardown failure behavior. Required events must not be silently dropped under load.

Keep current v1 runtime/UI behavior during SDK extraction, then cut over the server and Pi Chat together to v2. No v1 compatibility or dual-protocol period is required; clients using v1 are unsupported after cutover. Swift targets v2. Remove wire-level tabs/focus and move project-session selection to clients. Closing a Pi Chat client tab continues to call `closeSession`. Multi-client control, subscriptions, durable journals, automatic mutation replay, file transfer and AHP compatibility are deferred.

See [backend/SDK requirements](REQUIREMENTS.md) and [steering/snapshot requirements](../steering/REQUIREMENTS.md). Shared tests must cover lifecycle, streaming/steering, dialogs, version errors, snapshot ordering, reconnect/takeover, uncertain outcomes and slow consumers. No implementation or passing conformance tests are implied by this draft.
