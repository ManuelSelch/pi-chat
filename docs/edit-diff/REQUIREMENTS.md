# Edit tool-call diff view

Status: proposed; planning only, no implementation.

## Goal

Show what an `edit` tool call changed inside its existing transcript card, rather than requiring users to interpret raw JSON replacements. Keep the transcript compact and make completed changes readable in both live sessions and historical sessions.

## Current findings

- `src/web/chat/ToolCard.tsx` renders collapsed native details/summary cards with path, status, arguments, and result text.
- `src/shared/protocol.ts` carries only `argsText` and `outputText` for tool cards.
- `src/server/pi-runtime-adapter.ts` discards result details in both `toChatMessages()` and `tool_execution_end` handling.
- The installed Pi edit tool returns `details.diff` (display-oriented, numbered lines), `details.patch` (standard unified patch), and optional `firstChangedLine`. Modern arguments use `edits[]`; older sessions may use top-level `oldText`/`newText`.
- `src/web/chat/chat-state.ts` explicitly merges selected tool fields; adding a protocol field alone will not preserve it during live updates.

## Recommended MVP

Use the tool's completed result as the authoritative source. Render a single-column unified diff within the expanded card. Do not read files or reconstruct historical changes from current filesystem contents.

### Functional requirements

1. Cards remain collapsed by default. Existing path and running/error indicators remain unchanged.
2. Expanding a successful `edit` card with supported result details shows Changes first, followed by the result message. Put raw Arguments in a nested disclosure to avoid duplicating the diff visually.
3. Prefer a valid unified patch. Parse file/hunk headers separately from content, show old/new line-number gutters, preserve spaces and blank lines, and label additions/removals using both `+`/`-` and theme-aware color.
4. When only Pi's display diff exists, render its numbered lines and omission markers without pretending they are a standard patch. Do not invent missing old/new line numbers.
5. Running calls continue to show arguments/output, not an applied-change diff. Failed calls show their error and arguments, not a success-looking diff.
6. Calls without usable details, including older sessions and overridden tools, retain the existing generic display. Do not infer applied changes from arguments in the MVP.
7. Live completion, authoritative snapshots, reconnect, and historical-session loading must produce the same diff for a tool-call id, with no duplicate cards and no loss of arguments.
8. Malformed details or unsupported patch syntax never crash the transcript. Fall back to safe plain text when possible, otherwise the generic card.
9. Bound payload and render size. Proposed limits: 100 KiB for the selected diff text and 2,000 rendered lines. Truncate at line boundaries, explicitly mark incomplete data, and never present partial counts as totals. Final constants should align with existing adapter limits.
10. Keep code lines unwrapped with horizontal scrolling inside a bounded-height region. Long lines must not widen the page on mobile.

### Data contract proposal

Add an optional application-owned `editDiff` object to `ToolCard`:

- `format`: `unified` or `pi-display`.
- `text`: validated, bounded plain text; prefer patch, otherwise display diff.
- `truncated`: explicit boolean.
- `firstChangedLine`: optional positive integer.

Transport only one selected representation, not arbitrary tool details or duplicated patch/diff strings. Share one result-details projection helper between history mapping and live completion. Only attach this object to successful `edit` results. Validate unknown input defensively and preserve compatibility with messages lacking the field. Confirm protocol-version handling before landing the additive schema change.

### Non-functional requirements

- Render all code/output as React text, never raw HTML, ANSI markup, or executable links.
- Keyboard-operable disclosures; readable light/dark colors; changes distinguishable without color alone.
- Keep Pi SDK types and imports inside the runtime adapter boundary.
- Parsing is pure and bounded; rendering does not perform filesystem or network access.
- Keep `App.tsx` unchanged; implementation belongs in the chat feature and adapter/protocol layers.

## Non-goals

Side-by-side mode, syntax highlighting, word-level highlights, edit previews while streaming, write-tool diffs, git working-tree diffs, approvals, rollback/apply buttons, editor navigation, and new extension APIs.

## Delivery slices

### 1. Carry completed diff data

Files: `src/shared/protocol.ts`, `src/server/pi-runtime-adapter.ts`, `src/web/chat/chat-state.ts`.

- Add schema and bounded result projection.
- Use identical projection for session tool results and live completion.
- Update explicit client merge behavior.
- Tests: `test/protocol.test.ts`, `test/pi-message-mapping.test.ts`, `test/chat-state.test.ts`, plus live adapter coverage.
- Acceptance: a completed edit has identical diff data live and after snapshot reconstruction; missing/malformed/error details degrade safely.

### 2. Parse supported formats

Proposed file: `src/web/chat/edit-diff.ts`, with focused unit tests.

- Parse unified hunks into header/context/addition/removal/no-newline rows with correct old/new counters.
- Handle zero-length ranges, multiple hunks, CRLF, blank lines, code beginning with `+++`/`---`, and missing trailing newline.
- Parse Pi display numbering and ellipsis separately.
- Bound work and return explicit unsupported/truncated results.
- Acceptance: metadata is never counted as changed code; malformed inputs do not fabricate line numbers or crash.

### 3. Render inside ToolCard

Proposed file: `src/web/chat/EditDiff.tsx`; integrate in `ToolCard.tsx` and chat styling as needed.

- Build a compact unified viewer with gutters, accessible +/- markers, scrolling, and truncation notice.
- Promote Changes over raw arguments only when a usable successful diff exists.
- Retain generic card behavior for other tools and fallback cases.
- Extend `test/message-list.dom.test.tsx` or add focused ToolCard/EditDiff DOM tests.
- Acceptance: keyboard expansion works; malicious-looking code remains literal text; running/error/no-details cards preserve current behavior.

### 4. Verify lifecycle and presentation

- Add regression coverage for live completion followed by snapshot, reconnect, and historical session loading.
- Run full tests, TypeScript check, and production build.
- Browser-check a multi-hunk edit, large diff, long lines, dark/light themes, and narrow viewport.
- Acceptance: no duplicate cards, disappearing diffs, page-level horizontal overflow, or regressions for non-edit tools.

## Assumptions / decisions to confirm

- Recommended default is unified (single-column), not side-by-side.
- Diff stays inside the existing collapsed tool card; auto-expansion is intentionally excluded.
- Applied-result view only; an argument-based preview could be a separate later slice and must be clearly labeled Proposed, not Applied.
- Old sessions without stored details cannot provide an authoritative historical diff and will keep the generic fallback.
