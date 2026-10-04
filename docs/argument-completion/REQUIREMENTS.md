# Command argument completion

Status: planned; implementation not started.

## Goal

Show Pi's existing command argument completions in Pi Chat. Reuse the registered command's `getArgumentCompletions(prefix)` callback and the existing composer menu; do not build another completion engine.

Example: `/deploy st` offers `staging`. Selecting it inserts `/deploy staging` without executing the command.

## Behavior

- Keep existing command-name completion and local session actions unchanged.
- After `/command `, request suggestions for the argument text before the caret. An empty prefix is valid.
- Pass the entire argument prefix unchanged, matching Pi's API—not just the last token. Pi's callback owns filtering and ordering.
- Support synchronous and async callbacks. Missing callbacks, `null`, and empty arrays mean no suggestions.
- Show each item's `label` and optional `description` in the existing menu. Insert its `value` verbatim.
- Replace the argument prefix before the caret, preserving text after it. Do not add whitespace or execute the command.
- Reuse arrows, Enter/Tab acceptance, Escape dismissal, and pointer selection. Preserve Shift+Enter, Shift+Tab, and IME input.
- Only request for a leading slash command with the caret in its first-line arguments and no active text selection.
- Ignore late responses after the draft/caret changes, dismissal, submission, tab switching, or disconnect. Keep completion state local to the composer, outside transcript snapshots.
- Callback failure closes argument suggestions without failing the chat or changing the draft.

## Implementation — three small steps

### 1. Forward to Pi

- Add a completion method to `RuntimeAdapter` and the fake adapter.
- In `PiRuntimeAdapter`, resolve the exact invocation through the current `extensionRunner.getCommand(commandName)` and await its `getArgumentCompletions(argumentPrefix)` callback.
- Preserve suffixed names such as `/review:2`. Never call the command handler or `prompt()` for completion.

### 2. Bridge over WebSocket

- Add a session-scoped request containing `requestId`, `commandName`, and `argumentPrefix`.
- Return plain items (`value`, `label`, optional `description`) or a completion error to the requesting socket, following the existing controller policy.
- Route through the application service to that session's adapter. No snapshots, transcript events, or broadcasts.
- Narrow `FolderRequests.receive()` to folder reply types so it does not swallow completion replies just because they contain `requestId`.

### 3. Show in the composer

- Extend the existing command menu with argument rows, without slash prefixes or session-action badges.
- Track caret position, request suggestions when the argument prefix changes, and clear old suggestions immediately.
- Use the latest request id plus the captured session/draft/caret to ignore stale replies. Clear pending UI state on dismissal, acceptance, tab change, and disconnect.
- Apply the selected value using the captured argument range and restore composer focus/caret.

## Verification

- Adapter: exact invocation/prefix, sync and async results, no provider, callback failure, and no handler execution.
- Transport: correct session, requester-only replies, and coexistence with folder requests.
- Composer: empty prefix, selection/insertion, preserved suffix, keyboard/mouse behavior, and a delayed response after editing or changing tabs.
- Run existing tests, TypeScript check, and production build; smoke-test one real extension command in the browser.

## Keep out of this change

- A new completion framework, runtime-generation protocol, provider scheduler, custom concurrency controls, or caching.
- Filesystem completion, general autocomplete-provider stacking, or inferred suggestions.
- Native command execution changes: `/model` and `/thinking` currently open dialogs rather than consume typed arguments. This change exposes existing registered command callbacks only.
