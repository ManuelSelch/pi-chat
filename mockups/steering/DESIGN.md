# Steering composer

- Revision: 2
- Status: approved for production implementation.
- Goal: expose Pi's native steering, without follow-up support or a second queue implementation.
- Preserve the existing textarea-only composer and Escape-to-stop shortcut.
- While the agent is running, Enter submits steering; Shift+Enter inserts a newline. The placeholder becomes “Steer Pi…”.
- Pending steering messages appear in a panel above the composer, separate from the transcript, with no internal scrolling or height cap. No keyboard helper text is displayed. Pi's queue will be authoritative in production, including snapshots/reconnects.
- Once consumed, the normal Pi user message appears in the transcript and disappears from the queue panel.
- Idle input starts a normal run. Bash, session-changing commands, disconnection, aborting, and compaction must retain safe runtime guards.
- Narrow layouts wrap the footer text. No new animation.
- Demo controls are review-only; receiving messages, running, and stopping are simulated. Abort queue semantics will follow Pi, not this prototype.
- States: default running; `?state=queued` shows one queued message. Enter queues additional text; “Simulate Pi receiving steering” consumes one message; Escape switches to idle.
- Outstanding questions: none.
- Approval evidence: user said “looks good. implement it” for revision 2.
