# Write tool-card Markdown preview

Status: proposed; planning only.

## Goal

Opening a `write` tool card shows the content supplied to the write tool as rendered Markdown, instead of making users read escaped content inside argument JSON. Keep the existing collapsed header, file path, and status indicators.

## Findings

- `ToolCard.tsx` already provides collapsed cards and specialized edit diffs.
- `toolCardFromCall()` in `src/server/pi-runtime-adapter.ts` serializes arguments with a 4,000-character limit. This can truncate the JSON and the written content, so `argsText` is not a reliable preview source.
- `src/web/chat/Markdown.tsx` supports GFM, math, code highlighting, and safe links without rendering raw HTML. Reuse it with the existing `.markdown` styling.
- History and live execution-start already use `toolCardFromCall()`. Result merging preserves earlier call fields, but the client reducer explicitly selects fields during tool updates.

## Requirements

1. A successful `write` card remains collapsed by default. Opening it shows **Written content** first, rendered as Markdown, followed by the result message. Raw Arguments move into a nested disclosure.
2. Treat content as Markdown regardless of file extension, as requested. Do not add extension-based code rendering or a source/preview toggle in this slice.
3. Preserve exact content text, including whitespace. An empty string is a valid write and displays **Empty file** instead of an empty preview area.
4. Running calls may show available content as **Content to write**; failed calls may show it as **Attempted content**, with the failure result clearly visible. Never claim content was written unless the call succeeded.
5. Partial streamed JSON is not parsed for Markdown rendering. Only validated string content from complete tool arguments produces a preview.
6. Preview data is identical live, after authoritative snapshots, on reconnect, and when opening saved sessions. It represents the historical call, not the file's current contents; no filesystem reads are needed.
7. Missing or malformed arguments retain the generic card. Older sessions can receive the new preview when their original call arguments contain a valid `content` string; do not depend on parsing truncated `argsText`.
8. Bound preview data independently of argument JSON. Proposed limit: 100 KiB of UTF-8 text per call, cut safely without splitting Unicode characters and marked explicitly as truncated. Do not append truncation markers inside the Markdown itself.
9. Bound the preview height and keep tables/code horizontally scrollable without widening the page. Reuse existing Markdown typography in light and dark themes.
10. Avoid Markdown parsing while the card is closed. Mount the preview when expanded; the native disclosure remains keyboard-operable.
11. Render with the existing safe Markdown configuration. Do not enable raw HTML, executable links, or local-file navigation. Disable remote image loading in this preview so opening written text cannot cause unexpected network requests; display image alt text instead. Avoid changing ordinary message image behavior.

## Proposed data contract

Add optional `writeContent` to the shared ToolCard schema:

- `text`: bounded content string, including empty strings.
- `truncated`: boolean.

Extract from validated `write` call arguments before args serialization/clamping. Only the exact tool name `write` is specialized. Do not forward arbitrary arguments or infer content from the result's success text.

Preserve this field across server call/result merges and the client's explicit tool-update merge. It may be present while running or failed; labels derive from card status. Confirm additive protocol compatibility using existing conventions.

## Delivery slices

### 1. Project content reliably

Files: `src/shared/protocol.ts`, `src/server/pi-runtime-adapter.ts`, and `src/web/chat/chat-state.ts`; optionally a small projection helper.

- Add schema and safe bounded content extraction in `toolCardFromCall()`.
- Preserve it when tool results complete, including errors, and during client merges.
- Tests cover empty content, malformed arguments, Unicode truncation, long content beyond the argsText limit, non-write tools, and historical call/result merges.
- Acceptance: content remains available even when the displayed argument JSON is truncated.

### 2. Render the expanded preview

Files: `src/web/chat/ToolCard.tsx`, proposed `src/web/chat/WriteContent.tsx`, and optionally `Markdown.tsx` for a narrowly scoped no-images option.

- Reuse Markdown rendering and styling inside a bounded preview region.
- Add status-appropriate headings, empty-file state, and explicit truncation notice.
- Put raw Arguments behind a nested disclosure only when preview data exists.
- Track native disclosure opening so Markdown rendering is deferred until expansion.
- Tests cover headings, lists, fenced code, literal hostile HTML, blocked unsafe links, no remote image loading, collapsed lazy rendering, failed/running labels, and unchanged edit/non-write cards.

### 3. Verify persistence and presentation

- Regression-test start -> completion -> snapshot and reopening historical sessions, retaining one card per tool-call id.
- Run full tests, TypeScript check, and production build.
- Browser-check light/dark themes, narrow viewport, wide tables, long code lines, large content, keyboard expansion, and errors.
- Acceptance: preview survives reload, cannot trigger remote image requests, and does not overflow the page.

## Non-goals

Implementation in this planning change, diffing overwritten files, approvals, rollback, source editing, filesystem previews, extension-based rendering, streaming partial Markdown, and changes to the edit diff viewer.

## Assumptions

- All `write` content is interpreted as Markdown, not only `.md` files.
- This displays the content passed to the tool. An overridden write tool could transform that content; the preview does not verify filesystem bytes.
- Raw Arguments and the normal result remain accessible for debugging.
