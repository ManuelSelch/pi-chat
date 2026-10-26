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
- **R7** — Preserve the server's origin/authentication protections. Document and test the supported deployment topology; cross-host/port browser support must resolve Q1 before implementation. No wildcard origin bypass, browser-supplied Origin spoofing, or new authentication scheme.
- **R8** — Verify default resolution, override validation, persistence/restoration/reset, storage failures, disconnected recovery, and isolation between old/new server state. Update configuration documentation with storage scope, endpoint format, and deployment restrictions.

## Assumptions
- A full page reload after successful save/reset is acceptable and keeps client/state replacement simple; no seamless hot switching is needed.
- Persistence is local to the browser origin, not shared through Pi settings, synchronized between devices, or stored on the backend.
- The user supplies the complete WebSocket URL, such as wss://example.test/ws; no server list, discovery, connection-history UI, or HTTP-to-WebSocket conversion is required.
- Existing browser/server authentication remains deployment-owned. Persisted URLs should not contain secrets; no token-management feature is included.

## Implementation Plan
### S1 — Connection Settings Mockup and Design
Description: Prepare an isolated Settings mockup covering endpoint editing, save-and-reload, reset, disconnected recovery, validation, and draft-loss messaging (R1, R3, R5, R6). Resolve Q1 and document the connection/persistence/security boundaries in DESIGN.md beside this plan. Verify by user review; explicit mockup and design approval are prerequisites for production/test edits. Do not change the server's origin policy as an incidental UI change.

### S2 — Persisted Endpoint and Settings Integration
Description: After S1 approval, implement endpoint resolution/validation and browser persistence, wire the approved Settings controls, and use the selected endpoint on startup (R1–R6). Save/reset reloads the page only after persistence succeeds; draft-loss confirmation precedes destructive reloads. Add focused tests for default preservation, explicit URLs, invalid data, storage failures, and clearing old client state. If Q1 requires independent server changes, obtain approval for that expanded design and deliver those prerequisites before claiming custom remote connections work.

### S3 — Browser Acceptance and Documentation
Description: After S2, verify save, reload restoration, reset, disconnected recovery, draft handling, and switching between supported backend deployments without leaking state or closing runtimes (R5–R8). Include a real browser/server handshake test for the topology selected in Q1, not only mocked transport tests. Update docs/configuration.md with examples, browser-local persistence, HTTPS restrictions, and origin/authentication constraints. Run applicable existing checks and record actual results.

## Open Questions
- **Q1** — Must the UI connect directly to a backend on a different host/port? The current pi-server checks browser Origin against the WebSocket request Host and rejects that topology. If yes, should scope include an explicit trusted-origin allowlist in the independent pi-server project, or will a trusted same-origin reverse proxy provide access?
