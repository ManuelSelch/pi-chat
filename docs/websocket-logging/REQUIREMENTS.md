# Pi Chat WebSocket Troubleshooting Logs — Requirements

## Goal

Make intermittent Pi Chat WebSocket disconnects diagnosable after they happen by writing useful, structured server logs to a persistent file, while keeping log storage bounded.

## Scope
### In Scope
- A Pi Chat server logfile with bounded size and retention.
- Structured events relevant to server startup/shutdown and WebSocket lifecycle.
- Browser-side close/error details available for troubleshooting without logging chat content.
- Tests for logging, rotation/retention, and disconnect diagnostics.
- Documentation describing the log location and how to inspect it.

### Out of Scope
- General-purpose application audit logging or transcript/prompt logging.
- Capturing message payloads, credentials, headers, or other sensitive user data.
- Automatically uploading logs or sending telemetry externally.
- Diagnosing or changing the underlying disconnect behavior as part of this logging work.

## Requirements
- Logs are written to a persistent file and remain available after the server process exits.
- Log storage is strictly bounded by configurable maximum file size and retained-file count (or an equivalent bounded rotation policy). Rotation must not lose the currently active log writer or prevent server startup if logging cannot initialize; failures should be reported to stderr and the server should continue with console logging.
- Each log record includes an ISO timestamp, severity, event name, and relevant structured fields.
- Server records startup (host/port and project directory), graceful shutdown, and unexpected process/server errors where observable.
- WebSocket records include connection lifecycle events: accepted/opened, closed (close code, reason, and clean flag where available), socket errors, and controller replacement. Include a stable per-connection identifier and whether a Pi runtime was active when the connection closed, where available.
- Browser records close/error details (close code, reason, clean flag, timestamp) in developer-console diagnostics; do not expose error details as chat content. If browser diagnostics are persisted server-side, they must be sent through a bounded, non-blocking diagnostic path and correlated to the connection without logging message contents.
- Do not log WebSocket frames, prompts, model output, tool arguments/results, authentication material, or full request headers.
- Logging must be asynchronous/non-blocking for WebSocket and runtime event handling; log write failures must not crash or interrupt an agent run.
- Rotation and retention are deterministic and tested, including startup with existing files and failure cases.
- Tests verify representative structured WebSocket records, redaction boundaries, and that log disk usage remains within the configured bound.
- Documentation identifies default log location, retention/size settings, and a command or method to inspect recent records.

## Assumptions
- Pi Chat is a local, single-user application; logs are local-only and do not require a remote logging service.
- Use a bounded rotating file policy: 5 MiB per file and 3 retained files.
- Browser-side close diagnostics remain console-only; do not report them to the server.

## Implementation Plan
### 1. Add bounded file logger
Description: Introduce a small server-owned structured logger that writes timestamped records to `~/.pi/agent/logs/pi-chat.log` and rotates at 5 MiB per file, retaining three rotated files. Support environment overrides for log directory, maximum bytes, and retained-file count. Ensure logging initialization/write failures fall back to stderr/console without stopping Pi Chat. Verify rotation, retained-file bounds, restart behavior, and failure handling with isolated filesystem tests.

### 2. Instrument server lifecycle and WebSocket transport
Description: Add structured records for server startup/shutdown, WebSocket accept/open/error/close, close code/reason/cleanliness, controller replacement, and runtime-running state on disconnect. Assign connection identifiers for correlating lifecycle events. Do not log payloads or sensitive request data. Add transport tests asserting event fields and redaction.

### 3. Add browser disconnect diagnostics and usage documentation
Description: Record browser-side WebSocket open/error/close details in developer-console diagnostics only; do not send browser diagnostics to the server. Include close code, reason, clean status, and timestamp. Document where the server logfile lives, how to inspect it, and how to adjust the 5 MiB / 3-rotated-file retention settings. Add focused tests for client close diagnostics and run the relevant test suite, typecheck, and build.

## Open Questions
None.
