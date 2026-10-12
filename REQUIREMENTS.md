# Pi Chat Steering and Snapshot Consistency — Requirements

## Goal
Stop accepted user messages disappearing from the live transcript until reload. Match Pi terminal's queued-steering lifecycle using the Pi SDK, and guarantee consistent snapshot/event ordering in the backend rather than requiring browser-side repair.

## Scope
### In Scope
- Native SDK steering submission, queue updates, consumption, and transcript projection.
- Snapshot capture and publication across asynchronous extension hooks and catalogue loading.
- Snapshots sourced only from SDK `session.messages`, including its compaction-aware context and custom messages.
- Deterministic regressions and real-Pi/browser verification of rapid submissions around bash completion.

### Out of Scope
- A custom steering scheduler, follow-up mode, or copying Pi terminal UI components.
- Full pre-compaction transcript preservation, branch-history merging, or a temporary message-history overlay.
- New composer UI, queue-editing controls, or terminal compaction-queue parity.
- Allowing text submission during an active user bash command.
- A browser event replay buffer, transcript merge framework, or mandatory stale-snapshot guard.
- Fixing input clearing on rejected submissions; this is a separate composer concern.

## Requirements
- Pi remains authoritative for execution and steering queues. Continue using `session.prompt(text, { streamingBehavior: "steer" })`, `queue_update`, and `getSteeringMessages()`; do not maintain a second execution queue.
- Queuing steering updates only the existing queued-steering panel. It must not emit a synthetic finalized transcript message or invent a `steering:` message identity.
- Match the terminal's queued-versus-consumed distinction: queued input stays in the pending panel; consumed input becomes a real transcript message. Publish the real user message on `message_end`, when it is already present in `session.messages`, rather than introducing extra state for exact `message_start` timing. Subsequent snapshots must not duplicate it.
- Identical queued texts remain distinct queue items. Do not deduplicate queued messages by text.
- Pending steering remains visible after reconnect and appears in history exactly once when consumed. Reload after consumption must agree with the live transcript.
- Generate transcript snapshots only from `session.messages`; do not read or merge session branch entries for transcript reconstruction. Pi owns message persistence and context reconstruction, including custom messages.
- After compaction, show SDK-retained messages and its compaction summary rather than preserving every original bubble. This intentionally changes Pi Chat's current full-branch display. Refresh the snapshot after successful compaction so live display and reload agree.
- Map displayable SDK custom messages, bash executions, and compaction/branch summaries through the existing transcript protocol or its smallest necessary extension. Respect custom-message `display`; no separate custom-entry persistence handling is needed.
- A snapshot must include already-published finalized messages still present in the current SDK context. SDK compaction/session navigation may legitimately replace earlier context. `message_end` updates agent messages before public listeners, avoiding the branch-persistence gap.
- Reuse existing stable object-keyed message identity for live finalized messages and snapshots. Verify SDK context reconstruction does not cause duplicate live custom-message emission; adapt event mapping if required, without adding another history store.
- Perform asynchronous snapshot preparation first, including extension hooks and catalogue retrieval. Then capture fresh runtime state and the matching sequence and send the snapshot in one synchronous publication block, with no await between capture and send.
- Never label an earlier captured transcript with a later sequence. Concurrent snapshot preparations must each capture current state when publishing, rather than publish their earlier transcript copies.
- Apply the same publication rule to prompt completion, feature completion, metadata changes, session changes, and initial connection/reconnection. Discard work for a closed/replaced session or obsolete connection rather than publish it to a different incarnation.
- Guarantee ordering on the current WebSocket in the backend; no browser stale-snapshot guard is required for this change. Keep existing protection against events from obsolete sockets.
- Do not lock user input, pause agent execution, serialize whole prompts, or buffer the live event stream while catalogue/hooks await.
- Preserve streamed assistant drafts across running snapshots, notices, errors, tool cards, and idle/running state.
- Sending accepted text rapidly after bash completion must never erase its user message, regress runtime status, or require reload to repair history.

## Assumptions
- The inspected SDK terminal updates a separate pending panel on `queue_update` and adds real user transcript messages on `message_start`. Pi Chat will use finalized `message_end` instead to keep snapshots wholly SDK-owned; exact start-event timing is not required.
- The user explicitly accepts a compaction-aware transcript sourced only from `session.messages`, rather than Pi Chat's current full-branch history. Similarity to terminal behavior does not require identical summary placement or terminal-only decorations.
- Existing Node.js synchronous execution and WebSocket send ordering permit atomic capture/publication once asynchronous preparation is complete.
- SDK public events and history APIs suffice; no SDK fork or terminal UI import is expected. Verify the event/persistence boundary against the installed SDK during implementation.

## Implementation Plan
### 1. SDK-Owned Transcript Snapshots
Description: Replace branch-based transcript reconstruction with mapping of `session.messages` only. Preserve supported message rendering and add mapping for SDK compaction/branch summaries as needed. Test finalized-message visibility before branch persistence, custom messages, bash results, compacted context, and live/reload consistency. Ensure successful compaction refreshes the display. Verify identity against the installed SDK; do not add a history overlay or custom persistence.

### 2. Native Steering Display Lifecycle
Description: Depends on slice 1. Remove synthetic transcript emission and text-based tracking from queue updates. Forward SDK queue state to the existing panel and retain actual user `message_end` as the transcript event, using the same identity as SDK snapshots. Add regressions for queue-only visibility, consumption, duplicate text submissions, reconnect while queued, and final history without duplicate bubbles. Keep existing prompt submission and command guards.

### 3. Atomic Snapshot Publication
Description: Separate asynchronous preparation from synchronous current-state capture. Update the application/publisher boundary so runtime state, sequence, and send occur together after preparation, with coverage for session/connection invalidation. Add deferred-hook/catalogue tests that deliver live user events during preparation and finish multiple snapshot preparations in reverse order. Verify correct transcript, monotonic sequence, and current runtime status using the actual publisher plus browser reducer. Do not add browser repair logic or block execution.

### 4. Real-Pi Regression Verification
Description: Depends on slices 1–3. Extend existing integration drivers to cover steering queue consumption and rapid accepted text submission immediately after bash completion. Use deterministic delay controls where available, not timing-only sleeps. Verify live history, reconnect/reload agreement, compaction-aware display, custom messages, and continued assistant streaming. Run focused tests, the full suite, typechecking, production build, and whitespace checks; document any baseline failures separately. Commit completed implementation slices after verification without pushing.

## Open Questions
None.
