# Rendering and inline review

- The lazily loaded `@pierre/diffs` CodeView owns multi-file/row virtualization, sticky headings, wrapping and scroll geometry. Navigation uses item IDs; selecting a file does not replace the comparison.
- Two bundled module workers highlight visible diffs, with a 32-entry AST cache and 2-second initialization timeout. Closing the panel tears down the pool. The library shows plain text before highlighting and falls back on worker failure.
- Files over 2,000 rendered patch rows or 128,000 patch characters stay plain. Long-line highlighting is bounded. These limits never truncate content; parser/render failures expose complete plain patches.
- Renderer shadow-root CSS consumes host Mantine, `--pi-*` and `--hljs-*` variables. No global theme mutations. Browser consumers must bundle the module worker referenced with `new URL(..., import.meta.url)`; Chat uses Vite ES-format workers so highlighter language/backends remain lazy chunks.

## Review flow
- Gutter plus or the keyboard-accessible file-heading comment button opens a single-line comment editor. The heading button anchors to the first available patch line. Checkmark/Cmd-or-Ctrl+Enter saves; X/Escape cancels.
- The plugin provider owns in-memory comments and unsaved editor text by session ID, project path and comparison. Panel close/reopen retains them; a page reload discards them. Comparison preferences remain per project.
- Anchors capture path, old/new side, line, code excerpt, base commit and original patch. Refreshes never silently move comments. A changed patch/base or missing file marks a comment outdated and blocks sending until removed and recreated.
- Send comments submits one ordinary user message with all saved comments, original excerpts and comparison context to the captured session. It does not modify the composer draft.
- Sending is disabled during editing, disconnected/busy states or stale/missing snapshots. Comments are locked while awaiting delivery; double-clicks do not send twice.
- Transport acceptance alone does not clear drafts. The plugin waits up to 10 seconds for the exact new user-message echo from that session. Confirmed comments clear; failures/unconfirmed delivery retain them with a check-chat-before-resending warning. No automatic retries; confirmation means submitted to chat, not implemented by the agent.
- Git RPC remains read-only. Reviews are browser-owned; no comment files, extra review server, Crit process or new host Git mutation API.
- Browser scenarios: [diff viewer](../../../packages/pi-chat/testing/e2e/diff-viewer.spec.ts). Adapter/domain/hook tests are colocated; DOM adapter tests stub CodeView and do not prove its actual browser rendering.
