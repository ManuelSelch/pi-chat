# Remember application theme — Design

## Overview
Keep the last selected runtime palette as browser-owned application appearance when no selected runtime palette exists. Restore it on browser refresh, without changing SDK cache ownership or server behavior. This narrowly supersedes the default-fallback/no-persistence decisions in [Pi theme reuse](../pi-theme/DESIGN.md).

## Components
| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| Chat | [AppControllerProvider](../../src/web/app/AppControllerContext.tsx) | Reused | Supply only the selected runtime's SDK palette |
| Chat | [SessionThemeProvider](../../src/web/app/theme/SessionThemeProvider.tsx) and proposed adjacent persistence hook | Changed / New | Own remembered appearance for the browser origin; selected palettes take precedence and update storage |
| Chat | [piMantineTheme](../../src/web/app/theme/pi-mantine-theme.ts) | Reused | Map the effective palette to root variables and portalled dialogs |
| SDK | Public `sessionThemeSchema` from `@manuelselch/pi-sdk/protocol` | Reused | Validate stored data before rendering |

## Runtime flow
1. Theme provider synchronously reads `pi-chat:lastTheme` from local storage on initial mount. Parse and validate with the SDK schema; absent or invalid data means no remembered palette.
2. A selected runtime palette renders immediately and updates the remembered palette and storage. Background session palettes do not update it.
3. Closing all sessions, losing a runtime cache entry, or switching to Home leaves remembered appearance intact. SDK entries still clear as before.
4. Refresh restores remembered appearance before the first themed render. A subsequently selected runtime palette overrides it.
5. Unavailable storage or failed writes do not interrupt rendering: retain the palette in memory for this mounted application.

## Contracts & API changes
| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| Theme provider → Mantine | Selected palette or defaults → selected palette, otherwise remembered palette, otherwise defaults | Internal appearance behavior only |
| Chat → browser storage | No palette → one validated serialized `SessionTheme` at `pi-chat:lastTheme` | New browser-local data; no migration or legacy fallback |
| Server / SDK → Chat | Existing open/create payload and runtime cache | Unchanged |

## Decisions & Trade-offs
- Browser persistence is appearance only, not an authoritative runtime cache or theme setting. Never restore it into SDK state or recolor widgets.
- Remember the resolved palette, not its name; the browser cannot load server theme files. Remembered colors can be stale until a selected runtime supplies its palette.
- Persistence is per browser origin, including across server restarts; no server-specific partition, expiry, cross-tab synchronization requirement, or new network requests.
- Keep fonts, layout, interactions and defaults for first-time visitors unchanged. This is a theme-lifetime correction, not a new UI or layout requiring a mockup.
- No dependency, protocol, server, or SDK changes.

## Verification
- Extend existing theme DOM tests: close final session, replacement/cache clearing, and server-instance changes retain appearance while SDK caches still clear.
- Cover light/dark palette switching, Home and portal inheritance, unmount/remount restoration, absent/invalid stored data, rejected incoming palettes and storage read/write failures.
- Run focused theme tests, full unit suite, typecheck/build and appropriate existing browser theme regressions. Update configuration documentation to distinguish runtime cache from remembered browser appearance.

## Open Questions
None.
