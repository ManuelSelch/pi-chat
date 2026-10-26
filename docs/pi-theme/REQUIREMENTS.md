# Pi theme reuse — Requirements

## Goal
Use a custom Pi theme as the color source for Pi Chat's Mantine interface and extension widgets, including when the server has no terminal. Reuse Pi's format and resolution rather than maintain a second user-authored palette.

## Requirements
- **R1** — Resolve the session's effective Pi `theme` setting and discovered themes, respecting Pi's existing project-trust/resource rules. An explicit custom theme with concrete colors must work without a TTY.
- **R2** — Use the same resolved theme instance for that runtime's `ctx.ui.theme` and the colors supplied to Chat. Different runtimes must not mutate each other's theme.
- **R3** — Apply the active session's palette across the interface, including portalled dialogs: page/panel surfaces, text, muted text, borders, links, primary controls, selections, status colors and diff backgrounds. Preserve layout, fonts and component behavior.
- **R4** — Preserve Pi's exact resolved semantic colors at their mapped roles; derive only missing Mantine shades/interaction colors. Respect the theme's light/dark appearance instead of overriding it with browser appearance.
- **R5** — Supply the resolved palette only in existing `session.open` / `session.create` responses, alongside `summary` and `snapshot`. Do not add it to summaries, snapshots, presentation updates, initialization, or a new request/event. Switching tabs applies the selected runtime's cached palette.
- **R6** — Resolve and cache the theme when a runtime is created/replaced. Open/create returns that runtime's cached palette, including when opening an already-running session. Theme refresh on `/reload` and automatic delivery on reconnect are deferred. No terminal queries, filesystem watcher, theme editor, new selector or browser-to-terminal synchronization is required.
- **R7** — Missing, invalid or terminal-dependent selections must not prevent a session from opening. Use a deterministic Pi dark fallback and report a server diagnostic. A fixed light/dark pair selects its dark member in this headless scope. With no usable session theme, retain Chat's existing Mantine fallback.
- **R8** — Preserve widget ANSI rendering, literal RGB colors and all existing clearing/update semantics. Already-rendered widget strings are not retroactively recolored.
- **R9** — Keep Pi resolution in the independent server, the authoritative wire contract in the TypeScript SDK, and Mantine adaptation in Chat. Updated servers always return a concrete theme in successful open/create responses, including fallback themes. Clients tolerate older servers without the field; absence in an open/create response clears that runtime's cached palette. Do not send source paths, raw theme files, ANSI or arbitrary CSS as theme metadata.

## Assumptions
- This user-requested bounded integration is an exception to the project's general maintenance-only direction; it does not authorize other optional UI features.
- Home keeps the selected runtime's cached palette if one exists; otherwise it uses existing Mantine defaults. A separate global/home theme is out of scope.
- The client cache is in-memory and runtime-scoped. Ordinary snapshots and same-server reconnect do not erase it. A browser reload/new client has no palette until an open/create response arrives; initialization alone retains Mantine defaults. Clear cached palettes on runtime close or server-instance change; a replacement runtime without open/create delivery uses defaults. These are accepted first-scope limitations.
- Users seeking precise headless colors define explicit values, an appearance, and optionally Pi's HTML-export surface colors. Terminal-default/ANSI-based themes receive deterministic approximations, not terminal parity.
- Syntax highlighting and full Pi Markdown-color parity are outside this first integration; widget text continues to use Pi's colors.

## Implementation Plan
### S1 — Palette review mockup
Description: Create an isolated mockup showing a representative shell, controls, modal, statuses and ANSI-colored widget with explicit light/dark custom palettes. Obtain visual approval before production implementation; preserve approved files and stop the owned preview. Implements the visual scope of R3–R4 without backend changes.

### S2 — Open/create theme contract
Description: Extend only the SDK's shared open/create result with a bounded, validated theme payload alongside summary and snapshot. Updated servers always supply it; clients accept older responses without it. Regenerate affected schemas/fixtures and retain palettes per runtime independently of snapshot reduction. Implements R5 and R9; independent server and Chat adoption depend on this contract.

### S3 — Per-runtime Pi theme resolution
Description: In the independent server, replace the fixed shared dark theme with per-runtime selection using Pi's settings, trusted discovered resources and color resolver. Bind the same instance to widgets and expose its serialized palette to open/create response construction. Keep the cached instance through explicit reload; refreshing it is deferred. Verify custom themes without a TTY, isolation, deterministic fallbacks and installed-package loading. Implements R1–R2 and R6–R9; depends on S2.

### S4 — Mantine integration and boundary verification
Description: Consume verified SDK/server artifacts, adapt the selected palette into Mantine, and cover portals, tab switching, cache survival through ordinary snapshots/reload/same-server reconnect, older-server responses and semantic colors. Verify the documented browser-refresh/initialization/replacement limitations. Run focused/full checks in changed repositories and an isolated real-extension browser scenario. Document custom-theme configuration and limits. Implements R3–R5 and completes R8–R9; depends on S1 approval and S2–S3. No publication, pushing or live-server restart is authorized by this plan.

## Open Questions
None.
