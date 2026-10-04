# Command argument completion

Status: proposed plan; implementation not started.

## Goal

Pi Chat should offer argument suggestions for slash commands registered by Pi extensions using the existing `getArgumentCompletions(argumentPrefix)` API. Extensions should work without Pi Chat-specific registration or browser code.

Example: after selecting `/deploy`, typing `/deploy st` offers `staging`; accepting it produces `/deploy staging` without executing the command.

## Current behavior and evidence

- `src/web/chat/composer/command-menu.ts` completes command names only. `commandQuery()` closes the menu at the first whitespace.
- `ComposerContainer.tsx` owns drafts per session and handles arrows, Enter, Tab, Escape, and command selection. Selecting a command inserts `/name `.
- `CommandMenu.tsx` already provides a scrollable list with keyboard highlighting and mouse selection without losing composer focus.
- `src/server/runtime/pi/pi-runtime-adapter.ts` projects registered extension commands by `invocationName`, but discards their completion callbacks.
- The installed Pi SDK exposes `extensionRunner.getCommand(invocationName)`. Registered commands can return `AutocompleteItem[] | null` synchronously or asynchronously from `getArgumentCompletions(prefix)`.
- Pi's combined autocomplete provider passes the **entire argument text before the caret**, not just the last token. Selecting an item replaces that argument prefix with `item.value`; it does not automatically append a space. Multi-argument providers must return the preceding arguments as part of their value.
- Native `/model` and `/thinking` currently open dialogs and ignore typed arguments. Offering their argument values would be misleading without a separate execution change.
- Correlated folder requests already travel over WebSocket without entering transcript reducers. However, `FolderRequests.receive()` currently consumes every message containing `requestId`; adding another request family requires narrowing that routing.

Sources inspected: Pi `docs/extensions.md`, `docs/sdk.md`, `docs/tui.md`, `examples/extensions/commands.ts`, extension runner declarations, and the installed TUI autocomplete implementation. Keep SDK imports and callback invocation within the runtime adapter boundary.

## Scope

### First release

- Extension commands with `getArgumentCompletions`, including async callbacks and suffixed invocation names such as `/review:2`.
- Empty argument prefixes, partial prefixes, and multiple arguments on the first composer line.
- Caret-aware replacement with preservation of text after the caret and of later lines.
- Existing command-name completion, local session actions, and Cmd/Ctrl+K remain available.
- Request correlation, lifecycle cleanup, provider failure handling, and accessible keyboard/mouse interaction.

### Non-goals

- Native command argument completion or changes to native command execution.
- General filesystem/path completion, `@` references, shell completion, or implicit fallback to those sources.
- General `ctx.ui.addAutocompleteProvider()` support; it remains a separate, broader feature.
- Inferring suggestions from prompt-template `argumentHint` metadata, skills, command names, or help text.
- Shell tokenization, automatic quoting, or automatic escaping. Provider values are inserted verbatim.
- Completing slash commands on later lines or arguments whose caret is on a later line.
- Changing prompt submission, steering, or execution behavior.

## Functional requirements

### 1. Detect the completion context

1. Keep command-name lookup local to the browser.
2. Argument lookup applies only when the draft starts with `/`, the first line contains an exact registered invocation followed by an ordinary space, and the caret is after that separator on the first line.
3. Use the first ordinary space as the separator, matching Pi's argument completion behavior. Additional spaces are part of the prefix and must not be trimmed or collapsed.
4. Pass the substring after the separator and before the caret to the provider exactly, including quotes, flags, preceding arguments, and trailing whitespace.
5. A non-collapsed text selection disables argument completion. Caret movement reevaluates eligibility even when the text does not change.
6. No argument request for unknown commands, local UI actions, commands without a provider, ordinary prose, a mid-sentence slash, or a later-line caret.
7. Selecting a command name should immediately make its empty argument prefix eligible.

### 2. Resolve suggestions on the server

1. Resolve against the named open session, not the server's currently focused tab.
2. Resolve the exact invocation with `extensionRunner.getCommand()`, including numeric suffixes. Do not guess by the original registration name.
3. Invoke only `getArgumentCompletions`; never the command handler, `prompt()`, template expansion, or an agent run.
4. Support synchronous arrays, promises, `null`, and empty arrays. Missing providers and unknown commands return an empty result.
5. Preserve provider order and filtering. Do not apply command-name fuzzy ranking to argument items.
6. Transfer only plain `value`, `label`, and optional `description` fields; validate provider output and render labels/descriptions as text, never HTML.
7. A rejected callback, invalid output, or deadline expiry produces a recoverable completion error, not a session/run failure or transcript notice.
8. Resolve against the live runner for every request; do not retain callback references across reload or session replacement.

### 3. Present and accept suggestions

1. Reuse the existing menu presentation with a distinct argument-row kind. Argument labels must not gain a leading slash or a session-action badge.
2. ArrowUp/ArrowDown navigate; unmodified Enter or Tab accepts the highlighted item; Escape dismisses; pointer selection preserves composer focus.
3. Shift+Enter continues to insert a newline. Shift+Tab remains normal reverse focus navigation. IME composition must not accept suggestions or submit the draft.
4. Acceptance replaces the full argument prefix from the separator to the captured caret with `value`. Preserve the command, separator, suffix after the caret, and later lines. Place the caret directly after the inserted value.
5. Do not append a space, quote, or slash. Do not run the command or submit the draft.
6. Clear the suggestion list immediately on acceptance, submission, or dismissal. Do not immediately reopen the same context after acceptance or Escape; a subsequent text edit or explicit Tab request can reopen it.
7. When no argument suggestions are available, keep normal Enter submission and Tab focus behavior. No-result and failure states must not trap keyboard focus.
8. While a request is pending, do not allow old results to be selected. Pending completion must not block typing or ordinary submission.
9. Announce the menu as argument suggestions, expose active selection to assistive technology, and keep the highlighted row visible. Use stable row ids independent of possibly duplicated labels.

### 4. Handle asynchronous state and lifecycle

1. Debounce automatic argument requests (proposed default: 150 ms). Tab can explicitly request immediately when no menu is open and the context is eligible; that key press requests suggestions, not command execution.
2. Correlate replies by request id and retain the session, runtime completion context, draft revision, caret/selection, and replacement range locally.
3. Ignore replies unless that full context still matches. Text edits, caret movement, selection changes, acceptance, Escape, submission, tab switches, overlays, and loss of connection/control invalidate pending UI results.
4. Close/reload/session replacement invalidates old server work and old browser results, even when the visible session id and command names stay the same.
5. Ordinary streaming snapshots must neither clear current suggestions nor resurrect dismissed suggestions. Completion state stays outside transcript state.
6. Disconnect/unmount clears timers and pending promises. Reconnect may request again from the current eligible draft; replies from disposed sockets are ignored.
7. Completion replies go only to the requesting socket, subject to the existing controller policy. No broadcast, sequence advancement, snapshot publish, or transcript mutation is needed.

## Proposed boundaries and protocol

- Add an application-owned completion item type to `src/shared/protocol.ts`; no Pi TUI types in browser/shared interfaces.
- Add optional `supportsArgumentCompletion` metadata to slash commands, defaulting to false for compatibility. Project it only for extension commands with a callback.
- Add an optional `completionContextId` to the action registry. A host-generated opaque id identifies the current runtime generation; rotate on reload/replacement and preserve it during ordinary snapshots. A missing id means no remote argument completion.
- Add `completeCommandArguments` with `sessionId`, `requestId`, `completionContextId`, `commandName`, and `argumentPrefix`.
- Add unsequenced `commandArgumentCompletions` and `commandArgumentCompletionError` replies carrying session id, request id, and completion context id. Success contains validated items; failure contains a bounded user-safe error.
- Add an async completion method to `RuntimeAdapter` and the fake runtime. The application service validates session/context, delegates, and rechecks runtime identity/context after awaiting before permitting a result.
- Keep deadline and output normalization in a small Pi runtime completion helper rather than expanding the main adapter.
- Use a dedicated browser completion request helper and composer hook. Narrow folder request consumption to its own reply types **before** routing completion replies. Alternatively, extract a typed request multiplexer if this makes routing simpler; avoid a broad controller rewrite.
- The browser owns parsing, captured replacement ranges, and insertion. The server needs only the invocation and prefix, not the entire draft.

## Reliability and limits

Proposed defaults, adjustable during implementation:

- Request id/context id: maximum 128 characters; command invocation: maximum 256 characters; argument prefix: maximum 16 KiB.
- At most 100 returned items, preserving provider order. Reject malformed items and oversized insertion values rather than truncating values into different arguments. Bound labels/descriptions and total reply size.
- Completion deadline: 2 seconds. Client timeout slightly exceeds the server deadline so all promises settle even if a reply is lost.
- Bound provider concurrency per session; coalesce repeated automatic requests to the latest context instead of launching unbounded callbacks. A still-running timed-out provider must not accumulate additional invocations indefinitely.
- The SDK callback has no AbortSignal parameter. Timeouts and invalidation stop waiting/publishing, not the underlying extension work; document this limitation. Synchronous blocking extension code cannot be interrupted without process isolation, which is out of scope.
- Do not log draft argument prefixes by default. Existing trusted-extension permissions remain unchanged; autocomplete providers should be fast and side-effect-free, but the host cannot enforce that for arbitrary extension code.

## Incremental implementation slices

### Slice 1 — Completion contract and runtime provider

- Add schemas, command capability metadata, and runtime generation metadata.
- Add adapter contract, fake support, and a focused Pi completion helper.
- Test exact suffixed invocation resolution, exact prefixes, sync/async/null results, ordering, invalid output, limits, failure, deadline, and generation invalidation.
- Exit: suggestions can be queried through the application/runtime boundary without executing a command.

### Slice 2 — Correlated WebSocket requests

- Route session-scoped completion requests through the application service and transport with origin-only replies.
- Add browser request lifecycle handling; narrow the existing folder reply router.
- Test session isolation, missing sessions, stale generation, requester-only replies, controller loss, disconnect cleanup, and coexistence with folder requests.
- Exit: an async completion request works end-to-end without touching transcript reducers or snapshots.

### Slice 3 — Pure caret context and insertion helpers

- Add pure detection and application functions beside `command-menu.ts`.
- Test empty/multi-argument prefixes, repeated spaces, quoted arguments, mid-argument caret, preserved suffix/later lines, non-collapsed selections, invalid contexts, and exact insertion values without added whitespace.
- Keep existing command-name tests intact.
- Exit: insertion behavior is deterministic and matches the specified Pi prefix contract.

### Slice 4 — Composer integration

- Track caret/selection and IME state; add debounced lookup and explicit Tab triggering.
- Extend menu rows/presentation and connect navigation, acceptance, dismissal, loading, and recoverable errors.
- Test DOM behavior including empty-prefix lookup after command selection, Shift+Enter, Shift+Tab, IME, caret restoration, mouse focus, and no auto-submit.
- Exit: extension argument completion is usable by keyboard and mouse without regressing local actions or command-name completion.

### Slice 5 — Races, smoke testing, and documentation

- Test reordered replies, text edit while awaiting, Escape while awaiting, selection changes, tab switching, close/reload with unchanged names, reconnect, overlays, and streaming snapshot refresh.
- Add an isolated demonstration extension with both immediate and delayed argument providers for browser smoke testing.
- Run the full Vitest suite, TypeScript check, production build, and whitespace check.
- Manually verify with a real Pi runtime: `/deploy st` acceptance, empty prefix, a suffixed command, middle-of-line replacement, async failure, and reload during lookup. Verify the callback is called and the handler is not called until submission.
- Document supported APIs and explicit non-goals in the user/developer docs.
- Exit: all checks pass and the browser smoke confirms the real SDK path.

## Assumptions and follow-ups

- First release prioritizes compatibility with extension command callbacks, not full terminal autocomplete parity. This scope is a recommendation, not a user-confirmed limitation.
- Native model/thinking argument completion can follow, but must introduce and test direct argument execution while retaining no-argument dialogs.
- General autocomplete-provider stacking and path completion should be planned separately because they have custom trigger and insertion semantics.
- Confirm during implementation whether the 150 ms debounce, 2-second deadline, and 100-item cap fit real installed providers; retain bounded behavior regardless of tuned values.
