# Bash commands in Pi Chat

Status: implemented (simple, non-streaming version).

## Goal

Run user-entered shell commands from the existing composer, using Pi's SDK rather than asking the model to call a tool or creating another shell runner.

| Input | Behavior |
| --- | --- |
| `!pwd` | Execute in the session's server-side working directory; retain command/output in model context. |
| `!!pwd` | Execute identically, but exclude command/output from model context. Still display and persist the result. |
| Ordinary text / slash commands | Keep existing behavior. |

Neither bash form triggers an assistant response. `!` output becomes available on the next ordinary prompt. This is Pi terminal behavior, not “run bash and immediately ask the model to explain it.”

## Scope and assumptions

- Include `!!` alongside `!` for compatibility with Pi and an explicit context-exclusion option.
- Initially allow one operation per session: no user bash during model work/compaction, no parallel user bash, and no model prompt while user bash runs. Other session tabs can work independently.
- Use the existing trusted/local-server security model. Commands execute on the server with its permissions, not in the browser. `!!` is context exclusion, not secrecy or a sandbox.
- No terminal emulation, stdin, interactive programs, persistent shell state, background-job manager, shell/path completion, remote execution UI, or automatic retry.
- Shell configuration, command prefix, cancellation, output truncation, and full-output files remain owned by Pi.

These are proposed defaults. Concurrent execution and automatic model follow-up would be separate features if requested.

## Existing code and SDK findings

Current flow:

`ComposerContainer -> prompt WebSocket message -> ChatApplicationService.prompt -> PiRuntimeAdapter.prompt -> session.prompt`

- `src/web/chat/composer/ComposerContainer.tsx` already submits trimmed text and only submits when idle.
- `src/shared/protocol.ts` carries session-scoped prompt/abort messages and typed transcript entries.
- `src/server/transport/command-handler.ts` refreshes the snapshot when a prompt finishes.
- `src/server/runtime/pi/message-mapping.ts` currently drops `bashExecution` messages.
- `src/server/runtime/pi/snapshot.ts` derives busy state solely from `!session.isIdle`.
- `src/web/app/state/chat-state.ts` treats `messageFinal` as append-only, not an update stream.

Installed Pi API inspected in `dist/core/agent-session.js` and `.d.ts`:

- `session.executeBash(command, onChunk?, { excludeFromContext, id?, operations? })` executes, streams, and records the result.
- `session.recordBashResult(...)` records results supplied by an extension.
- `session.abortBash()` cancels user shell commands; `session.isBashRunning` reports them.
- `session.isIdle` does **not** include bash execution. Busy state must also cover the adapter operation, including awaited extension interception before a process starts.
- Results persist as `role: "bashExecution"`, with command, output, exit code, cancelled/truncated flags, fullOutputPath, and excludeFromContext.
- `executeBash()` itself does not dispatch `user_bash`. Pi's terminal host dispatches it first with `extensionRunner.emitUserBash()`, then records an extension-provided result or passes extension-provided operations to `executeBash()`.
- Bash output is not delivered as the normal assistant tool execution stream. The completed `bashExecution` history entry is projected into the transcript.

Sources: Pi README editor section, `docs/sdk.md`, `docs/session-format.md`, and `dist/modes/interactive/interactive-mode.js#handleBashCommand`.

## Functional requirements

### 1. Input routing

- Recognize a leading `!!` before `!`, after the same outer trimming currently used by the composer/protocol.
- Remove only the selected marker; preserve the shell body, including multiline text, quoting, pipes, and shell operators. Do not tokenize or escape it as argv.
- Reject empty/whitespace-only shell bodies with a clear error; never send them to the model.
- A `!` elsewhere in an ordinary message remains ordinary text.
- Route commands on the server, before the adapter's normal slash-command/model dispatch. No separate browser execution request is needed.
- Add a small composer hint when input begins with `!` or `!!`: runs on server; included in next prompt / excluded from model context. Do not introduce a new editor mode or action framework.

### 2. SDK execution and extension compatibility

- Call Pi's `user_bash` interception once, matching its terminal host: command, context-exclusion flag, and session cwd.
- If an extension supplies a complete result, record it once with `recordBashResult()`; do not execute again.
- Otherwise call `executeBash()` once with the exclusion flag and any supplied operations; let it record the result. Do not append a duplicate session message.
- Keep Pi imports inside the Pi adapter area; do not spawn processes from web, transport, or application modules.
- No synthetic user prompt, assistant turn, or assistant tool call is added for bash commands.

### 3. Transcript and output

- Add a distinct typed bash transcript entry/card rather than pretending this is an assistant tool call.
- Display command, context-inclusion state, output, running/completed/nonzero-exit/cancelled status, and exit code when available.
- Render command/output as plain monospace text, not Markdown or HTML. Reuse existing safe ANSI stripping/output-size utilities where appropriate.
- Stream bounded output while running. Bound the adapter buffer, browser payload, and rendered text; use Pi's final truncated result as authoritative.
- Show truncation and the full-output path when supplied, without adding a file-reading/download endpoint.
- Historical `bashExecution` messages, including ones created by Pi's terminal, render after opening/resuming a session.
- Successful commands with no output still produce a card. Nonzero exit and cancellation are results, not transport/protocol failures.

### 4. Busy state and lifecycle correctness

- Keep the session busy while Pi executes the command. The completed result is delivered with the normal post-command snapshot.
- Do not create a provisional card or separate live bash event. The completed SDK history is delivered through the normal snapshot.
- Use normal message identity for persisted history; repeated identical commands remain separate runs.
- Do not add a bash streaming protocol or execution scheduler.
- Busy state starts before awaiting extension interception and ends only after result/error cleanup. Reflect it in snapshots and tab indicators, not just transient runtimeStatus events.
- Enforce the single-operation policy server-side before awaits; browser disabling alone cannot prevent rapid duplicate requests.
- While bash runs, reject prompts, bash submissions, reload, compaction, and runtime-replacing operations in that session with a recoverable error. Do not falsely publish idle for a rejected request while the original operation remains active; inspect the generic publisher error path.
- Escape/Stop cancels user bash through `abortBash()`, bypassing the current `isIdle` early return. Stay busy/stopping until execution settles.
- Stop calls Pi's `abortBash()` for an active process. Extension interception remains a normal pre-execution await and is not given a separate cancellation protocol.
- Browser disconnection does not restart or duplicate the command. Session disposal follows the existing runtime lifecycle.
- Unexpected execution/interception errors remain visible through subsequent snapshots. They must not leave the composer permanently busy.

## Implementation slices

1. **Persisted bash projection**
   - Add bash schema/type and map SDK `bashExecution` history.
   - Add a focused bash card component under `src/web/chat/` and render it from `transcript/MessageList.tsx`.
   - Test historical results: success/empty output/nonzero exit/cancelled/truncated/excluded, safe rendering, repeated commands.

2. **Routing and SDK bridge**
   - Add a small prefix parser and route inside `src/server/runtime/pi/pi-runtime-adapter.ts` before normal prompt handling.
   - Implement `user_bash`, extension-result recording, and `executeBash()` delegation.
   - Add adapter tests using SDK stubs; confirm no model call and exactly one persisted result per command.
   - Update `test/support/fake-runtime-adapter.ts` so end-to-end tests can exercise the same behavior deterministically.

3. **Busy state and cancellation**
   - Keep the adapter busy while `executeBash()` is pending and reject overlapping prompts.
   - Route Stop to `session.abortBash()` and return to idle after execution settles.
   - Test double submission, Stop, and failure cleanup.

4. **Composer hint and verification**
   - Add the context/server-execution hint; preserve existing Enter/Shift+Enter/slash-command behavior.
   - Document `!`/`!!` in README.
   - Run full tests, TypeScript check, build, and whitespace checks.
   - Smoke-test with a real Pi runtime: `!pwd`, `!!printf ...`, multiline output, a nonzero exit, a long-running cancellable command, and a subsequent ordinary prompt to verify context inclusion/exclusion.

## Acceptance checklist

- `!printf 'hello\\n'` produces one visible bash result in the active session, never an automatic model response.
- A later ordinary prompt can use that command/output; the equivalent `!!` result is not in model context but remains visible in the active session.
- Existing Pi session bash history is visible without re-execution.
- A running command keeps the session busy and produces exactly one completed card after it returns.
- Stop returns the composer to idle after cancellation and shows a cancelled result when Pi records one.
- Duplicate/busy requests cannot start overlapping operations or incorrectly unlock the composer.
- Empty commands and execution failures recover cleanly; ordinary text, slash commands, and assistant bash tools remain unchanged.
- Extension interception runs exactly once and respects supplied results/operations.
