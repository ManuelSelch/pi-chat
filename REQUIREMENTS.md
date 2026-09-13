# Pi Chat — Requirements

Project directory: `~/.pi/agent/git/pi-chat`.

## 1. Problem overview

Pi already provides capable local agent sessions, tools, extensions, skills, and persistent history. Existing web interfaces expose many coding-oriented panels that distract from university and general knowledge work.

Pi Chat shall provide a minimal local browser chat that reuses the existing Pi runtime and session files while emphasizing readable conversation, mathematical notation, attachments, and concise tool visibility.

## 2. Primary user

- A single local Pi user.
- The user works across project directories already represented by recent Pi sessions.
- The user primarily performs university, research, writing, and general assistant tasks.

## 3. Goals

- Deliver a working local demo quickly.
- Stream assistant text and tool progress in real time.
- Render Markdown and mathematical notation reliably.
- Reuse existing Pi credentials, resources, commands, and persistent sessions.
- Allow switching among projects inferred from recent Pi sessions.
- Keep the architecture modular enough to add richer controls later.
- Keep provider credentials and filesystem operations on the local server.

## 4. Non-goals for the first demo

- Full terminal emulator.
- Manual shell-command input.
- Git interface.
- File tree or graphical filesystem browser.
- Uploading files from remote machines.
- Public or multi-user deployment.
- Plugin marketplace.
- Model, provider, authentication, or global settings management.
- Parallel active runtimes.
- Session branching or tree visualization.
- Recreation of TUI-only slash commands.
- Native layout-aware PDF understanding.

## 5. Terminology

- **Project:** A working directory inferred from Pi's existing recent session files.
- **Session:** A standard persistent Pi JSONL session associated with a project directory.
- **Runtime:** The active `AgentSessionRuntime` that owns one current Pi session.
- **Resource command:** A slash command discovered from a Pi extension, prompt template, or skill.
- **Attachment reference:** A local filesystem path included with a prompt; the browser does not upload or copy the file.
- **Tool card:** A compact UI representation of a Pi tool call and its progress/result.

## 6. Functional requirements

### FR-1 — Local application startup

- The application shall run as one local Node.js/TypeScript server and one browser client.
- The server shall bind to `127.0.0.1` by default.
- The server shall use the user's existing Pi agent directory and configuration.
- The browser shall never receive provider credentials or complete Pi configuration objects.

### FR-2 — Pi runtime integration

- The server shall use the Pi SDK directly in-process.
- Runtime creation shall use Pi's standard resource and settings discovery.
- Persistent sessions shall remain standard Pi session files usable by the Pi CLI and other compatible clients.
- Pi SDK objects and event types shall be isolated behind an application-owned runtime adapter.
- The client/server protocol shall not expose Pi SDK classes directly.

### FR-3 — Active session lifecycle

- The demo shall maintain exactly one active runtime.
- The user shall be able to create a new persistent session.
- The user shall be able to resume an existing session from the selected project.
- Changing session or project shall replace the active runtime.
- After runtime replacement, subscriptions shall be removed from the old session and attached exactly once to the new session.
- Project or session switching shall be disabled while a run is active until the run settles or the user aborts it.
- The first demo shall support one controlling browser connection. A second connection shall be rejected clearly or replace the previous controller before it can prompt, abort, or replace the runtime.

### FR-4 — Recent projects

- The project picker shall derive projects from directories represented in recent Pi sessions.
- The first demo does not require arbitrary path entry or filesystem browsing.
- Each listed project shall show a readable folder name and enough path context to distinguish duplicate names.
- Selecting a project shall show its recent sessions.
- Projects shall be deduplicated by canonical directory path and ordered by most recent session activity.
- Missing or unreadable project directories shall not be selectable and shall be identified clearly.
- An empty state shall explain when no recent Pi project is available.

### FR-5 — Session history

- The session picker shall list recent sessions for the selected project.
- A session item shall display its stored name when available and a useful fallback otherwise.
- Opening a session shall render the authoritative current branch of its history.
- Reloading the page shall restore the active project, session, and messages without duplicating messages.
- For the single-user demo, the server owns the active project and session identity. A connected or reloaded client obtains both from the authoritative snapshot; browser storage is not authoritative.

### FR-6 — Prompting and streaming

- The composer shall accept multiline text.
- Submitting while idle shall send the prompt to the active Pi session.
- Assistant text shall appear incrementally as Pi emits streaming deltas.
- The UI shall expose an abort action while Pi is running.
- The final message emitted by Pi shall replace or reconcile the accumulated streaming draft.
- Errors, retries, compaction, and aborted runs shall produce visible, non-destructive status feedback.

### FR-7 — Markdown and mathematics

- Assistant and user text shall render Markdown with GitHub-flavored tables, lists, links, and fenced code blocks.
- Mathematical notation shall render with KaTeX.
- The renderer shall support display formulas written with `$$ ... $$`.
- Raw model-generated HTML shall not execute.
- Links shall use safe protocols and external links shall open safely.
- Code blocks and formulas shall remain horizontally usable on narrow screens.

### FR-8 — Tool execution cards

- Tool calls shall be correlated by Pi's `toolCallId`.
- Each tool card shall display the tool name and running, success, or error state.
- Cards shall be collapsed by default.
- Expanding a card shall show sanitized arguments and current or final output.
- Streaming tool updates shall update the corresponding card without creating duplicates.
- Tool errors shall be visually distinct without obscuring the assistant response.

### FR-9 — Local attachment references

- The composer shall accept local file paths through a path-entry control.
- Drag-and-drop may populate a reference when the browser exposes an absolute local path, but it is an opportunistic enhancement rather than the guaranteed input method.
- The browser shall send path references rather than upload or copy file contents.
- The UI shall clearly display each referenced file and allow removing it before submission.
- The server shall validate that every referenced path exists and is a regular readable file before it is included in a prompt.
- Image paths may be converted server-side into Pi image prompt content when supported.
- Other file paths, including PDFs, shall be included as explicit local references that Pi may inspect with its available tools.
- Unsupported, missing, unreadable, or ambiguous paths shall produce a clear validation error.
- The first demo shall document that browser drag-and-drop may not expose an absolute path in every browser; a path-entry fallback is required.

### FR-10 — Slash-command autocomplete

- Typing `/` at the beginning of the composer shall open command suggestions.
- Suggestions shall come from Pi-discovered extension commands, prompt templates, and skills.
- Suggestions shall show command name, description when available, and source category.
- Keyboard selection and dismissal shall be supported.
- Submitting a selected command shall pass it through Pi's normal `session.prompt()` behavior.
- TUI-only built-in commands shall not be advertised.
- Commands that require Pi extension UI interactions are outside the first demo unless they work without additional web-specific handling.

### FR-11 — Connection recovery

- The WebSocket protocol shall assign a monotonic server sequence number to outbound state-changing events.
- On connection or reconnection, the browser shall request an authoritative snapshot before applying subsequent live events.
- The snapshot shall include active project/session identity, messages, tool states that can be reconstructed, runtime status, command catalogue, and a `throughSequence` boundary.
- The server shall serialize snapshot creation with event publication or buffer events created after the snapshot boundary.
- After installing a snapshot, the client shall apply only events whose sequence is greater than `throughSequence`, in sequence order, and shall ignore duplicates.
- Reconnection shall not replay already-applied deltas as new content.

## 7. Architectural requirements

### AR-1 — Module boundaries

The server shall separate these responsibilities:

- `PiRuntimeAdapter`: creation, replacement, prompting, aborting, event subscription, and command discovery.
- `ProjectSessionService`: recent-project derivation and Pi session listing.
- `AttachmentService`: local path validation and image conversion.
- `ChatApplicationService`: use-case orchestration and active-runtime policy.
- `WebSocketTransport`: protocol validation, sequencing, snapshots, and client connections.

The browser shall separate these responsibilities:

- transport client and reconnection;
- normalized chat state;
- message rendering;
- tool-card rendering;
- composer, attachments, and command autocomplete;
- project/session picker.

### AR-2 — Dependency direction

- UI components shall depend on application-owned view models, not Pi SDK event shapes.
- Transport handlers shall invoke application services rather than Pi SDK methods directly.
- The runtime adapter shall be the only module that imports Pi runtime/session implementation APIs.
- Markdown rendering shall be independent of transport and session lifecycle code.

### AR-3 — Transport contract

- Client commands and server events shall use a versioned, discriminated TypeScript protocol.
- Runtime events shall be mapped into stable application events before transmission.
- The protocol shall support snapshots, prompts, abort, project selection, session selection, new session, and command discovery.
- Protocol messages shall be runtime validated at the network boundary.
- As a design note, keeping browser components independent of Pi SDK shapes should permit a future RPC-backed adapter; the demo shall not build speculative RPC infrastructure.

### AR-4 — State ownership

- Pi session state on the server is authoritative.
- Browser state is a projection and may be discarded/rebuilt from a snapshot.
- Streaming deltas are temporary; completed Pi messages are authoritative.
- There shall be one owner for runtime replacement and subscription disposal.

## 8. Non-functional requirements

### NFR-1 — Demo speed

- The first vertical slice should reach a real Pi text-streaming conversation before project switching, attachments, and polished rendering are added.
- Every later slice must leave the demo runnable.

### NFR-2 — Security

- Bind to loopback by default.
- Do not log credentials, authorization headers, full Pi settings, or attachment contents by default.
- Sanitize rendered Markdown and tool output.
- Validate all network messages.
- Treat project selection and path checks as guardrails, not as an operating-system sandbox.
- Public/LAN binding requires future explicit authentication and is not supported by the demo.

### NFR-3 — Reliability

- Runtime replacement shall not leak subscriptions or produce duplicate events.
- A malformed client message shall not terminate the server.
- A failed project/session switch shall leave the previous runtime usable when possible.
- Server shutdown shall dispose the active runtime cleanly.

### NFR-4 — Usability

- The primary screen shall remain a distraction-free chat.
- History/project selection shall be hidden behind one compact control or drawer.
- Tool calls shall not dominate the transcript.
- Keyboard operation shall cover prompt submission, command selection, abort, and closing overlays.
- The layout shall work on common laptop widths and mobile-sized browser widths.

### NFR-5 — Testability

- Pi SDK integration shall be replaceable by a fake runtime adapter in application and transport tests.
- Markdown, command filtering, event reduction, attachment validation, and project/session mapping shall be testable as pure units where practical.
- At least one integration test shall exercise prompt-to-stream-to-final-message behavior through the server protocol.

## 9. Incremental implementation plan

### Slice 0 — Project skeleton

- Create a TypeScript workspace with `server`, `web`, and shared `protocol` modules.
- Add unit-test, typecheck, lint, and development scripts.
- Create an application shell with a fake runtime adapter.
- Define and runtime-validate the minimal protocol variants: `snapshot`, `prompt`, `abort`, `assistantDelta`, `messageFinal`, `runtimeStatus`, and `protocolError`. Project, command, attachment, and tool variants may be added later.

**Done when:** an automated transport test starts the local server with the fake adapter, connects a client, validates a versioned snapshot, and confirms malformed input returns `protocolError` without terminating the connection.

### Slice 1 — Real Pi streaming vertical slice

- Implement one-project `PiRuntimeAdapter` using `AgentSessionRuntime`.
- Create/resume one persistent session.
- Map text/message/agent events into the shared protocol.
- Add prompt and abort controls.
- Implement initial-connect and page-reload recovery using an authoritative session snapshot. The client replaces projected state with the snapshot and then applies only events newer than its `throughSequence`. Full connection-loss retry hardening remains in Slice 6.

**Done when:** a real prompt emits at least two visible text deltas, completes with the authoritative final message, and after page reload the persisted transcript contains exactly one copy of each message.

### Slice 2 — Rendering and tool cards

- Add Markdown, GFM, syntax highlighting, KaTeX, and sanitization.
- Add normalized tool state and collapsed cards.
- Render tool progress and final errors/results.

**Done when:** tests confirm visible KaTeX output for `$$ ... $$`, one table, one code block, no executable raw HTML, and one tool card transitioning exactly once from running to success or error.

### Slice 3 — Projects and sessions

- Derive recent projects from Pi session storage.
- List sessions per project.
- Implement new, resume, and runtime replacement flows.
- Disable switching while running.

**Done when:** repeated project/session switching A → B → A preserves the authoritative message IDs and delivers each simulated SDK event once; the old runtime subscription is disposed before the replacement publishes events.

### Slice 4 — Slash commands

- Load command metadata from Pi resources.
- Add filtered autocomplete and keyboard navigation.
- Submit commands through Pi.

**Done when:** the catalogue identifies extension, prompt-template, and skill commands separately. At least one installed command from each available category is discovered and submitted successfully; an absent category has a tested empty state. Commands requiring unsupported extension UI are excluded with an explicit reason.

### Slice 5 — Local attachment references

- Add drag-and-drop metadata handling and path-entry fallback.
- Validate paths server-side.
- Convert supported images to Pi image content.
- Add explicit path references for PDFs and other files.

**Done when:** protocol-level tests verify that an image becomes supported Pi image content, a PDF becomes its validated canonical path reference, and no upload endpoint or copied file is created.

### Slice 6 — Demo hardening

- Harden the minimal snapshot sequencing from Slice 1 for temporary connection loss and retry behavior.
- Add empty, loading, validation, retry, and failure states.
- Verify responsive and keyboard behavior.
- Document startup, limitations, and architecture.

**Done when:** the demo can be restarted, reconnected, and shown reliably without exposing credentials or requiring manual state repair.

## 10. Proposed technology choices

These choices optimize for a quick TypeScript demo while preserving module boundaries:

- Node.js and TypeScript server.
- Direct `@earendil-works/pi-coding-agent` SDK integration.
- React with Vite for the browser client.
- WebSocket transport using a small server library.
- Shared runtime-validated protocol schemas.
- `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, and KaTeX.
- A sanitization step that does not enable arbitrary raw HTML.
- Vitest and Testing Library.

The concrete HTTP/WebSocket library and schema validator may be selected during Slice 0 as long as the architectural requirements remain satisfied.

## 11. Key risks and mitigations

- **Duplicate streams after switching:** centralize runtime ownership and test unsubscribe/rebind behavior.
- **Reconnect gaps:** send snapshots plus ordered live events; never rely on deltas as durable history.
- **Browser path restrictions:** provide manual path entry because drag-and-drop often omits absolute local paths.
- **PDF expectations:** first demo references paths only; Pi must inspect the file through available tools.
- **Tool mismatch:** correlate exclusively by `toolCallId` and treat updates as replaceable accumulated state.
- **Markdown injection:** disable raw HTML and enforce safe URL handling.
- **Scope expansion:** keep terminal, settings, Git, file browsing, model management, and parallel sessions explicitly outside the demo.
- **Extension UI commands:** do not promise commands that require unimplemented browser dialogs.

## 12. Assumptions

- Node.js compatible with the installed Pi SDK is available.
- Existing Pi credentials and settings are already valid.
- The server and browser run on the same local machine.
- Recent Pi sessions provide the project list needed for the demo.
- Pi tools are allowed to inspect referenced local files under the current user's permissions.
- One active runtime is sufficient for the first demo.

## 13. Open questions deferred beyond the demo

- Whether to support parallel active sessions.
- Whether to add an RPC-backed runtime for process isolation.
- Whether arbitrary project paths or a folder browser should be allowed.
- Whether to implement web equivalents of selected TUI commands.
- Whether to extract PDF text/layout independently of Pi tools.
- Whether to add model/thinking controls and settings management.
- Whether to support extension UI request/response dialogs.
- Whether to package the application as an installable Pi package with a `/study` launch command.
