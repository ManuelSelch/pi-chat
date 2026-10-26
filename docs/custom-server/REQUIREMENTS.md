# Pi Chat Custom Server Endpoint — Requirements

## Goal
Allow the user to change the backend WebSocket endpoint from Settings and remember the selection across browser restarts, keeping the feature small and recoverable when a server is unreachable.

## Requirements
- **R1** — Settings exposes one backend WebSocket endpoint field, the effective endpoint, an explicit apply action, and a reset-to-default action. Settings remains usable without a backend connection.
- **R2** — With no override, preserve the current endpoint derived from the page: ws/wss according to page protocol, page host/port, /ws, and the page query string. Reset restores this behavior.
- **R3** — Accept an absolute ws:// or wss:// endpoint, including an explicit path and optional query string. Reject malformed URLs, other schemes, URL credentials, and fragments before disconnecting or changing persisted preferences. On an HTTPS page, reject insecure ws:// endpoints with a clear explanation. Do not append the current page query string to an explicit override or display query secrets in diagnostics.
- **R4** — Persist the override in browser-local storage, scoped to the UI origin and browser profile, and restore it on startup. Editing without applying must not change the connection or persistence. Invalid stored data must not prevent startup. Report storage-write failures and do not claim the preference was saved.
- **R5** — Applying or resetting deliberately replaces the client connection and clears old server-specific UI state. Do not replay pending commands, carry runtime IDs to another server, or close server runtimes merely because the UI disconnects. Explain unsent-draft loss before an apply/reset that discards drafts.
- **R6** — An unreachable or rejected endpoint leaves Settings and reset accessible, with a visible connection failure. Do not silently connect to a different server or automatically revert the user's saved endpoint.
- **R7** — Preserve the server's existing origin/authentication protections without changes to pi-server or a trusted-origin allowlist. The supported deployment serves Pi Chat and its WebSocket backend through the same browser-facing host/port, including behind a VPN/reverse proxy. Explain that selecting another host/port does not bypass the server's origin check and may be rejected. To use another server's bundled UI, open that server's Pi Chat URL; this navigates to another UI origin rather than sharing the saved preference.
- **R8** — Verify default resolution, override validation, persistence/restoration/reset, storage failures, disconnected recovery, and isolation between old/new server state. Update configuration documentation with storage scope, endpoint format, and deployment restrictions.

## Assumptions
- A full page reload after successful save/reset is acceptable and keeps client/state replacement simple; no seamless hot switching is needed.
- Persistence is local to the browser origin, not shared through Pi settings, synchronized between devices, or stored on the backend.
- The user supplies the complete WebSocket URL, such as wss://example.test/ws; no server list, discovery, connection-history UI, or HTTP-to-WebSocket conversion is required.
- Existing browser/server authentication remains deployment-owned. Persisted URLs should not contain secrets; no token-management feature is included.

## Implementation Plan
### S1 — Connection Settings Mockup and Design
Description: Prepare an isolated Settings mockup covering endpoint editing, save-and-reload, reset, disconnected recovery, validation, and draft-loss messaging (R1, R3, R5, R6). Document the connection/persistence/security boundaries and Q1's resolved same-host/port deployment in DESIGN.md beside this plan. Verify by user review; explicit mockup and design approval are prerequisites for production/test edits. Do not change the server's origin policy as an incidental UI change.

### S2 — Persisted Endpoint and Settings Integration
Description: After S1 approval, implement endpoint resolution/validation and browser persistence, wire the approved Settings controls, and use the selected endpoint on startup (R1–R6). Save/reset reloads the page only after persistence succeeds; draft-loss confirmation precedes destructive reloads. Add focused tests for default preservation, explicit URLs, invalid data, storage failures, and clearing old client state. Keep independent pi-server changes out of scope; an arbitrary custom URL must not be presented as a guarantee that cross-host/port connections are permitted.

### S3 — Browser Acceptance and Documentation
Description: After S2, verify save, reload restoration, reset, disconnected recovery, draft handling, and switching between supported backend deployments without leaking state or closing runtimes (R5–R8). Include a real browser/server handshake test for the same-host/port deployment selected in Q1, not only mocked transport tests. Verify that a different-host/port rejection leaves Settings/reset accessible; do not weaken server checks to make that test connect. Update docs/configuration.md with examples, browser-local persistence, HTTPS restrictions, and origin/authentication constraints. Run applicable existing checks and record actual results.

## Open Questions
- **Q1 — Resolved:** No trusted-origin allowlist or pi-server changes are needed. The user serves Pi Chat at the backend port using pi-server and plans a homelab deployment behind a reverse proxy and VPN. Retain the existing browser origin checks. Direct switching from one UI host/port to another backend host/port is not a supported deployment requirement.
