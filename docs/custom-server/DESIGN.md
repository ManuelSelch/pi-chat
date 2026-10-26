# Custom Server Endpoint — Design

## Overview
Add a Backend server section at the top of Settings, using the [revision 1 mockup](../../mockups/custom-server/DESIGN.md). Persist an explicit WebSocket URL and reload after saving/resetting; retain the page-derived endpoint when no override exists. No pi-server, SDK, protocol or origin-policy changes.

## Components
| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| Chat settings/server | Endpoint rules and browser store (proposed) | New | Pure URL validation/default resolution; guarded localStorage read/write/remove. Export a small feature entry API for application wiring. |
| Chat settings/server | Settings logic and presentational panel (proposed) | New | Own unsaved field/error state; validate, confirm, persist, then reload. Panel receives values/callbacks only. |
| Chat settings | [SettingsContainer](../../src/web/settings/SettingsContainer.tsx) / [SettingsDrawer](../../src/web/settings/SettingsDrawer.tsx) | Changed | Compose the new panel independently of session capabilities or connection availability. |
| Chat application | [usePiChat](../../src/web/app/use-pi-chat.ts) | Changed | Resolve the endpoint once per mount through the settings feature API and pass it to PiClient. Expose that effective endpoint for Settings display. |
| Chat shared UI | [ConfirmDialogProvider](../../src/web/ui/confirm/ConfirmDialogProvider.tsx) | Reused | Confirm destructive reload before changing storage. |
| SDK / pi-server | PiClient / WebSocket admission | Reused | Existing connection lifecycle, runtime retention and browser-origin checks. |

## Runtime flow
1. On startup, usePiChat resolves the stored override or the current page-derived default and starts PiClient with that URL.
2. The user opens Settings even when disconnected. The panel shows the effective endpoint, editable override, validation/error feedback and reset. Editing changes local form state only.
3. Save validates the trimmed input; blank means default. Reset removes the override. Both ask for confirmation warning that unsent drafts across tabs are discarded; cancellation changes nothing.
4. On confirmation, persist/remove the preference. On failure, keep the current connection and show a generic storage error. On success, reload the current page without navigating to the WebSocket URL.
5. Reload recreates app/SDK/composer state without replaying commands or closing server runtimes. An unreachable/rejected endpoint retains Settings/reset access; no automatic fallback after a connection failure.

## Contracts & API changes
| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| Browser storage → endpoint resolver | No endpoint preference → `pi-chat:serverEndpoint`, a plain URL string; absent means page-derived default | New local preference, no migration. Invalid stored values are ignored; unavailable storage uses the default with a visible preference warning. |
| Endpoint resolver → PiClient | Page-derived URL → validated override or unchanged default | Same SDK endpoint string contract; no dependency update. |
| Panel → settings logic | New values/callbacks for edit/save/reset | Internal only; no connection-dependent disabling. |

Accept absolute ws/wss URLs with path/query; reject credentials, fragments, malformed URLs and insecure ws on HTTPS. Never append the page query to an override. Redact queries in effective-endpoint display and diagnostics; only the editable input contains the complete saved URL.

## Decisions & Trade-offs
- Reload is simpler and safer than hot switching. Confirm every changed save/reset rather than exposing the composer's private draft map. Server-side runs continue; the usual server controller rules still apply after reconnecting.
- Preserve remembered appearance and unrelated browser preferences; they are not runtime identity/state. Do not create new caches or cross-tab synchronization.
- No allowlist: same browser-facing host/port remains the supported topology behind the user's VPN/reverse proxy. Warn on different-host/port input without pretending the setting bypasses admission. Another server's bundled UI is reached by opening its own page URL, not by this reload action.
- No new production dependency, authentication, token management or connection probing. Storage does not secure secrets. Connection errors are generic because browsers may not expose handshake rejection reasons.

## Verification
Planned, not yet run: pure URL/default and storage-failure tests; driven Settings tests for confirmation/cancel, write failure, reload and reset; real browser/server checks for persistence, unreachable/cross-host rejection recovery and same-host/port handshake. Verify a new page contains no old runtime IDs/drafts or replayed commands and that disconnect does not close runtimes. Run applicable unit, build and browser suites. Mockup review is user-led; no automated browser inspection has been performed.

## Open Questions
None. Explicit approval of this design and mockup revision 1 is required before production/test edits.
