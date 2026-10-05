# Typed file capabilities

Status: steps 1–2 implemented (typed contracts, shared link parsing, session-aware file service, macOS opener, and requester-only transport). Browser request tracking/stable actions and end-to-end UI verification remain pending. The existing shell-based click action stays in place until the replacement works end to end.

## Goal

Replace Markdown file links that currently send `!!open -- <quoted path>` through the chat prompt with a small, typed application operation. Preserve click-to-open behavior without invoking Pi, creating bash history, interrupting a run, or invalidating transcript memoization.

Keep the design compatible with future inline previews without implementing a file framework or desktop app.

## Scope

First release implements one capability: **open a file in its default application on the Pi Chat server machine**.

In scope:
- Existing local Markdown links in user, assistant, custom, and thinking messages.
- A session-scoped, correlated `openFile` request and result over the existing WebSocket.
- Server-side path resolution/validation and an injectable OS opener.
- Recoverable UI errors and stable link actions.

Out of scope:
- Inline image/text/PDF/HTML previews, downloads, thumbnails, uploads, MIME discovery, and HTTP file-serving endpoints.
- Reveal-in-Finder/Explorer, native dialogs, Electron/Tauri packaging, editor selection, file writes, or a plugin capability registry.
- Automatically opening files based on streamed model output.
- Drawer memoization and progress-animation changes; those are separate performance tasks.
- A general controller/state-management rewrite or generic RPC framework.

## Ownership and semantics

- A path belongs to the environment running the Pi Chat server, not the browser device.
- Resolve relative paths against the project directory of the explicitly requested open session, never process cwd or the currently focused tab.
- A user may open a file while Pi is running; this operation does not involve the runtime prompt/tool loop.
- Permit readable files outside the project, matching the trusted local-server model used by folder selection. Canonicalization is validation, not a project sandbox.
- Remote clients receive the same server-machine behavior. Errors/help must not suggest that a remote device's default application will open.
- Initial OS support is macOS, preserving current behavior. Other platforms return a typed unsupported result unless their opener is deliberately implemented and tested. Do not silently invoke a shell fallback.

## Functional requirements

### Link handling

- Preserve HTTP/HTTPS/mailto behavior and unsafe-scheme rejection.
- Preserve local relative paths, absolute paths, and valid local `file:` URLs, including `file://localhost/...`.
- Reject nonlocal file URL hosts and malformed encoded paths; do not misclassify `//host/path` as an ordinary local file.
- Treat anchor-only links as navigation, not file opening.
- Keep parsing in one shared place. Transport the extracted path, not a command or arbitrary URL.
- For URI-form links, define and test escaping and fragment/query handling: decode the path exactly once and do not pass URI metadata to the OS. Literal `#`/`?` filename characters must be URL-encoded. Preserve spaces, Unicode, and apostrophes.
- Relative paths including `..` are valid. Do not add `~` expansion in this slice; current supported forms are sufficient.
- A file is opened only after an explicit user activation. Keyboard activation must work as well as clicking.
- Suppress duplicate activations of the same file while its request is pending. Unrelated files may be opened independently.

### Typed wire contract

Use the existing protocol/version and controller policy. Add concrete messages, not a generic operation dispatcher:

- Client `openFile`: `sessionId`, `requestId`, `path`.
- Server `fileOpenResult`: `sessionId`, `requestId`, and a discriminated success/error result.
- Success means the OS opener accepted the request; it does not prove the application displayed the file.
- Errors use bounded user-readable messages and stable codes such as `invalidPath`, `sessionUnavailable`, `notFound`, `notFile`, `permissionDenied`, `unsupported`, and `openFailed`.
- Validate request identifiers and nonempty bounded path strings at the wire boundary; reject NUL/control characters before filesystem/OS access.
- Step 1 limits: session/request identifiers are at most 128 characters, extracted paths at most 4096, and error messages at most 512. Identifiers/paths must not be whitespace-only; preserve literal path spelling rather than trimming or decoding wire paths.
- The shared parser decodes Markdown URI paths once after removing query/fragment metadata. Wire paths preserve literal `%`, `#`, and `?`; URL schemes and network-path prefixes are rejected.
- Reply only to the requesting controller socket. Never broadcast file-open results.
- Unknown/closed sessions must yield correlated errors, including synchronous lookup failures.
- File requests/results never enter transcript reducers or trigger snapshots, catalogue scans, tab changes, runtime status changes, or model turns.
- Keep the request/result family extensible by adding explicit operations later. Do not introduce speculative capability negotiation for a single operation.

### Server service

- Application service obtains the requested session's project directory and delegates to a small file service.
- Resolve to an absolute canonical path; verify that the target is a readable regular file. Follow symlinks to their target; reject directories, sockets, devices, and FIFOs.
- Do not interpret the path as code, a shell command, or an OS URL scheme.
- Pass an absolute path to the macOS opener as a separate argument, without shell interpolation. Do not use `prompt`, `executeBash`, `exec(string)`, or a shell.
- Keep OS invocation injectable so tests cannot launch real user applications.
- Bound opener completion with a deadline, capture failures without unbounded output, and clean up the child on timeout. Never retry an open automatically.
- The macOS implementation uses `/usr/bin/open` with a separate absolute-path argument, a 5-second timeout, `SIGKILL` on timeout, and an 8 KiB output limit. Automated tests inject/mock the opener; they never launch user applications.
- Missing files, permissions, unsupported OS, opener failures, and a file disappearing after validation produce recoverable errors.
- Validation is not a guarantee against filesystem races; report failures rather than claiming transactional file access.
- This is a privileged user action: continue enforcing the existing controller boundary. Bind to loopback under the existing server model; do not weaken access policy or expose a new unauthenticated HTTP endpoint.
- Opening a file in an external application is not a sandbox or security scan. Do not open directories/application bundles or execute paths directly; revisit confirmation policy if broader file types/actions are added.

### Browser request lifecycle and feedback

- Expose a stable `openFile(sessionId, path)` action backed by the current socket and a request tracker, following the completion/folder-request pattern.
- Each request captures its session; switching tabs cannot retarget it.
- Consume only file-result messages so folder and completion replies continue working.
- Bound pending-request lifetime. Disconnect, socket replacement, session closure, or UI disposal removes pending state; late results are ignored.
- Cancellation/timeout means the browser stopped waiting, not that an already accepted OS open was undone. Never replay on reconnect.
- Show failures as ephemeral feedback outside chat history, identified by file/session, without replacing Pi runtime errors. Avoid a success toast for every normal click.
- Keep link action identity stable across token/footer/widget/catalogue updates. A stable callback cannot depend on an unstable `prompt` function.
- Prefer a feature-local file action boundary rather than threading arbitrary controller objects into Markdown rows. Reuse existing component boundaries; no global callback registry is needed.
- File actions must not cause unchanged historical Markdown to reparse on each streamed token.

## Minimal architecture

`Markdown link -> stable file action -> correlated WebSocket -> application service -> file service -> injectable OS opener`

Suggested ownership:
- `src/shared/files.ts`: path/result types and validation schemas, imported by `protocol.ts`.
- `src/server/files/file-service.ts`: resolution and filesystem validation.
- `src/server/files/system-file-opener.ts`: platform-specific OS invocation.
- `src/server/application/chat-application-service.ts`: session/project lookup and delegation.
- `src/server/transport/command-handler.ts`: dispatch and requester-only result.
- `src/web/app/connection/file-requests.ts`: pending request lifecycle.
- `src/web/chat/markdown/local-link.ts`: safe local-link extraction, with shell-command helpers removed.
- Transcript/Markdown feature boundary: stable activation and ephemeral feedback.

These are suggested module locations, not a requirement to add more abstraction than implementation needs.

## Incremental implementation

### 1. Define link semantics and wire types

- Add file messages/result schemas and local-link parsing coverage.
- Specify URI escaping, invalid schemes/hosts, path limits, and explicit session targeting.
- Retain the old UI path until the replacement works end to end.

Acceptance: protocol rejects malformed requests; parsing tests cover supported links and ambiguous/unsafe forms.

### 2. Implement the file service and typed transport

- Add an injectable opener and validate files using temporary test fixtures.
- Delegate from the application service using the requested session directory.
- Send correlated results to the requester without calling runtime methods or publishing snapshots.

Acceptance: correct session path resolution, readable-file checks, outside-project support, failure mapping, controller enforcement, and zero runtime/history effects.

### 3. Replace the browser quick fix

- Add the bounded request tracker and stable file action.
- Wire Markdown/thinking links to it with duplicate-activation protection and ephemeral failures.
- Remove `shellQuote`, `openLocalLinkCommand`, and the link-to-`prompt` callback; retain normal user-entered `!`/`!!` commands unchanged.

Acceptance: user activation sends `openFile`, never a prompt; pending/errors clean up on tab/socket lifecycle; existing links and bash commands keep working.

### 4. Verify behavior and performance

- Run relevant module/transport/DOM tests, then the full suite, TypeScript, production build, and whitespace checks.
- Browser smoke with an isolated fake runtime/opener: click/keyboard open, a run in progress, missing file, duplicate click, disconnect, and tab change.
- Add a rendering regression test proving unchanged historical Markdown does not rerender when streaming/footer/catalogue events arrive. Changing session should still use the new session directory.
- Perform one explicitly controlled macOS smoke using a harmless temporary document; never open real user files from automated tests.

## Test matrix

- Paths: relative, absolute, parent traversal, local file URL, URL-encoded spaces/Unicode/#/?, apostrophes, leading hyphen filenames, symlinks, outside-project file, missing/unreadable file, directory, special file, malformed encoding, nonlocal host, unsupported scheme, control/NUL input.
- Service: explicit session cwd, no process-cwd fallback, closed/missing session, unsupported OS, argument-array invocation, opener failure/timeout, disappearance after validation.
- Transport: controller-only command, matching request/session IDs, requester-only reply, synchronous error correlation, no snapshot/catalogue/runtime side effects.
- UI: pointer/keyboard activation, stable action reference, no prompt/bash history, operation during streaming, independent errors, duplicate suppression, multiple files, session closure/change, disconnect/replacement, bounded pending state, ignored late replies, no reconnect replay.
- Regression: web/mailto links, unsafe schemes, file URL sanitization, thinking/custom messages, normal `!!` bash execution, completion/folder reply routing, historical Markdown memoization.

## Future extensions, not implementation commitments

- Preview metadata and content should be separate read-only operations; use HTTP streaming for bytes rather than embedding large content in chat WebSocket snapshots.
- Authenticate/authorize content endpoints, enforce sizes, support lazy media loading/ranges, and isolate active HTML before serving previews.
- Add `revealFile` only when wanted, using the same file service boundary.
- A future desktop shell can implement client-machine OS actions behind a narrow platform bridge; do not silently change server-path semantics.

## Confirmed assumptions

- Click continues to mean **open externally**, not inline preview.
- Readable files outside the project remain allowed.
- macOS-only external opening is sufficient for the first slice; unsupported platforms get a clear error.
- No executable/application launching capability is intended.

Confirmed by the user's instruction to keep the plan and start implementation. If these assumptions change, update this plan before proceeding; do not expand this slice into a file browser or preview framework.
