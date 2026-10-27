# Pi Chat commands — Design

## Overview
Consolidate lifecycle commands in the existing extension. Use a managed-process signal to invoke the host's existing restart service without opening a competing WebSocket controller. Remove restart only from the shared session actions; retain Settings.

## Components
| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| Extension | [pi-chat.ts](../../extension/pi-chat.ts) | Changed | Dispatch subcommands, complete arguments, manage launch/stop, observe restart |
| Chat host | [index.ts](../../src/host/index.ts) | Changed | Handle SIGUSR2 on managed production servers; publish signal support atomically |
| Chat host | [restart-service.ts](../../src/host/restart-service.ts) | Changed | Guard overlapping attempts; reuse build-before-shutdown and preserve the current server on build failure |
| Session UI | [SessionActionsProvider](../../src/web/sessions/actions/SessionActionsProvider.tsx) / action builder | Changed | Remove restart entry and now-unused confirmation/state wiring |
| Settings / pi-server | Existing restart control / service | Reused | Keep Settings and the existing protocol unchanged |

The host owns restart execution. Its successor rewrites the existing PID record on listening; the extension owns only bounded observation and notifications.

## Runtime flow
1. `/pi-chat start` and `stop` reuse existing launcher behavior; bare command shows status.
2. `/pi-chat restart` validates a healthy managed PID record and sends SIGUSR2 once. It does not kill the server or start a second build.
3. The production host invokes the same guarded restart service used by Settings. Build failure logs a diagnostic and leaves the listener running.
4. The extension waits up to a bounded restart deadline for a changed PID record and healthy listener. Success reports the successor; timeout reports that restart was not confirmed, without retrying or killing either process.
5. Successful replacement lets existing browsers reconnect normally. No browser controller is displaced by command execution.

## Contracts & API changes
| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| Pi extension → user | Separate start/stop commands → `/pi-chat start`, `stop`, `restart`; bare status | Breaking; no old aliases |
| Managed host → extension | PID/status only → additionally accepts SIGUSR2 for restart | Local macOS/Linux process contract; host PID record adds required `restartSignal: "SIGUSR2"` before the command will signal it |
| Server → clients | Existing restart and reconnect protocol | Unchanged; no server/SDK publication needed |
| Session menus → user | Restart action present → absent | Settings remains unchanged |

## Decisions & Trade-offs
- Investigation found that creating an SDK client would replace the active browser controller. Avoid that route rather than promising automatic browser reconnection after supersession.
- Signals fit the launcher's existing POSIX process-group management. Register an explicit development/unmanaged rejection handler so SIGUSR2 does not accidentally terminate a host lacking restart support.
- Require explicit signal support in the tracked PID record before signaling; older running hosts are refused rather than accidentally terminated. Publish the host record atomically.
- Limit signaling to tracked servers. No fallback to stop/start, no new HTTP endpoint, dependencies or compatibility shim.
- The existing protocol does not deliver a restart completion/failure receipt. PID/health observation confirms success; build-failure detail stays in host logs and a retained old PID yields an honest timeout, not an invented success.

## Verification
- Planned command tests cover registration, completion, usage, preserved start flags, missing/unhealthy managed records, single signal, successor observation and timeout.
- Isolated production fixtures verify successful replacement, retained PID/listener on build failure, updated stop behavior and cleanup. Never signal the user's server.
- Update shared-action/DOM tests for restart absence while retaining Settings coverage; run typecheck, relevant tests and production build.

## Open Questions
None.
