# Pi Chat Steering and Snapshot Consistency — Requirements

## Goal
Stop accepted user messages disappearing from the live transcript until reload. Match Pi terminal's queued-steering lifecycle using the Pi SDK, and guarantee consistent snapshot/event ordering in the backend rather than requiring browser-side repair.

## Scope
### In Scope
- Native SDK steering submission, queue updates, consumption, and transcript projection.
- Snapshot capture and publication across asynchronous extension hooks and catalogue loading.
- Consistency between live message events and SDK branch history during persistence.
- Deterministic regressions and real-Pi/browser verification of rapid submissions around bash completion.

### Out of Scope
- A custom steering scheduler, follow-up mode, or copying Pi terminal UI components.
- New composer UI, queue-editing controls, or terminal compaction-queue parity.
- Allowing text submission during an active user bash command.
- A browser event replay buffer, transcript merge framework, or mandatory stale-snapshot guard.
- Fixing input clearing on rejected submissions; this is a separate composer concern.

## Requirements
- Pi remains authoritative for execution and steering queues. Continue using `session.prompt(text, { streamingBehavior: "steer" })`, `queue_update`, and `getSteeringMessages()`; do not maintain a second execution queue.
- Queuing steering updates only the existing queued-steering panel. It must not emit a synthetic finalized transcript message or invent a `steering:` message identity.
- Match the terminal's consumption lifecycle: display the actual user message on SDK `message_start`, after the SDK removes it from its pending queue. A subsequent `message_end` or snapshot must not duplicate it.
- Identical queued texts remain distinct queue items. Do not deduplicate queued messages by text.
- Pending steering remains visible after reconnect and appears in history exactly once when consumed. Reload after consumption must agree with the live transcript.
- A snapshot must contain every user/finalized message already published through its declared `throughSequence`. Live SDK events can precede branch persistence; reading `sessionManager.getBranch()` alone is not sufficient at that boundary.
- Preserve existing branch/custom-message rendering. Any temporary adapter projection for already-published, not-yet-persisted real messages must use stable identity, remain narrowly bounded, and be cleared on persistence or session replacement. It is display state, not an execution queue. Verify SDK object identity across start/end/branch paths before relying on it.
- Perform asynchronous snapshot preparation first, including extension hooks and catalogue retrieval. Then capture fresh runtime state and the matching sequence and send the snapshot in one synchronous publication block, with no await between capture and send.
- Never label an earlier captured transcript with a later sequence. Concurrent snapshot preparations must each capture current state when publishing, rather than publish their earlier transcript copies.
- Apply the same publication rule to prompt completion, feature completion, metadata changes, session changes, and initial connection/reconnection. Discard work for a closed/replaced session or obsolete connection rather than publish it to a different incarnation.
- Guarantee ordering on the current WebSocket in the backend; no browser stale-snapshot guard is required for this change. Keep existing protection against events from obsolete sockets.
- Do not lock user input, pause agent execution, serialize whole prompts, or buffer the live event stream while catalogue/hooks await.
- Preserve streamed assistant drafts across running snapshots, notices, errors, tool cards, and idle/running state.
- Sending accepted text rapidly after bash completion must never erase its user message, regress runtime status, or require reload to repair history.

## Assumptions
- The inspected SDK terminal updates a separate pending panel on `queue_update` and adds real user transcript messages on `message_start`. This plan mirrors that behavior, not the terminal's entire feature set.
- Existing Node.js synchronous execution and WebSocket send ordering permit atomic capture/publication once asynchronous preparation is complete.
- SDK public events and history APIs suffice; no SDK fork or terminal UI import is expected. Verify the event/persistence boundary against the installed SDK during implementation.

## Implementation Plan
### 1. Consistent Live and Historical Message Projection
Description: Establish a narrow adapter projection that keeps already-published real messages visible before SDK branch persistence catches up. Preserve stable identity, branch ordering, custom-message behavior, and cleanup on session replacement. Start with failing tests that capture a snapshot during message dispatch and before branch append; verify snapshots include covered messages exactly once. Inspect installed SDK event/object behavior and use the smallest public-API solution; do not build a general event store.

### 2. Native Steering Display Lifecycle
Description: Depends on slice 1. Remove synthetic transcript emission and text-based tracking from queue updates. Forward SDK queue state to the existing panel and project actual user `message_start` using the same identity as later history/final events. Add regressions for queue-only visibility, consumption, duplicate text submissions, reconnect while queued, and final history without duplicate bubbles. Keep existing prompt submission and command guards.

### 3. Atomic Snapshot Publication
Description: Separate asynchronous preparation from synchronous current-state capture. Update the application/publisher boundary so runtime state, sequence, and send occur together after preparation, with coverage for session/connection invalidation. Add deferred-hook/catalogue tests that deliver live user events during preparation and finish multiple snapshot preparations in reverse order. Verify correct transcript, monotonic sequence, and current runtime status using the actual publisher plus browser reducer. Do not add browser repair logic or block execution.

### 4. Real-Pi Regression Verification
Description: Depends on slices 1–3. Extend existing integration drivers to cover steering queue consumption and rapid accepted text submission immediately after bash completion. Use deterministic delay controls where available, not timing-only sleeps. Verify live history, reconnect/reload agreement, and continued assistant streaming. Run focused tests, the full suite, typechecking, production build, and whitespace checks; document any baseline failures separately. Commit completed implementation slices after verification without pushing.

## Open Questions
None.
