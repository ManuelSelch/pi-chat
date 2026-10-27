# Pi Chat commands — Requirements

## Goal
Consolidate server lifecycle operations under one Pi extension command and remove restart from session actions.

## Requirements
- **R1** — Register `/pi-chat` with `start`, `stop`, and `restart` subcommands and argument completion; bare `/pi-chat` shows status. Unknown subcommands show usage without changing server state.
- **R2** — Preserve start options (`--port`, `--cwd`, `--no-open`), detached launch, production build, health checks, and managed-server stop behavior. Remove `/pi-chat-start` and `/pi-chat-stop` without aliases.
- **R3** — Restart the managed server using its existing rebuild-before-shutdown implementation, retaining its port, project and environment. Build failure leaves the existing server running. Report success only after observing a healthy successor; timeout is not success. Never automatically replay restart.
- **R4** — Restart must not acquire WebSocket control or displace connected browsers. Unmanaged or development servers are not restarted by this command.
- **R5** — Remove Restart server from the session action menus (composer and quickswitcher). Keep the separate Settings restart control unchanged.
- **R6** — Update current usage documentation, launcher fixtures and regression tests. Do not restart or stop the user's active server during verification.

## Assumptions
- The requested removal applies to session actions, not the independent Settings control.

## Implementation Plan
### S1 — Consolidated lifecycle commands
Description: Implement R1–R4 with completion, managed restart signaling and bounded successor observation. Verify command dispatch and failure paths with isolated tests and production lifecycle fixtures.

### S2 — Session action removal and documentation
Description: Implement R5–R6 by removing the shared restart action and its confirmation wiring, adjusting affected tests and current usage docs. Verify retained actions and the independent Settings control.

## Open Questions
None.
