# Pi theme reuse — Design

## Overview
Reuse Pi's resolver on the server and send a concrete, optional palette through session presentation data. Chat translates that palette into Mantine; the same per-runtime Pi theme colors extension widget output. This is a palette integration, not a layout redesign or a theme-management feature. See [requirements](REQUIREMENTS.md).

## Components
| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| Pi runtime dependency | `Theme`, settings and resource loader | Reused | Resolve Pi variables/color formats, appearance and trusted available themes |
| Independent `pi-server` | `runtime/pi/infra/headless-theme.ts` | Changed | Replace shared fixed-dark instance with a proposed per-runtime resolver; isolate existing internal-loader compatibility seam |
| Independent `pi-server` | `PiRuntimeAdapter`, UI bindings, snapshot projection, `ServerPublisher` | Changed | Own runtime palette; bind it before extension startup; serialize it and include it in presentation signatures/revisions |
| Independent TypeScript SDK | `src/protocol/v2.ts`, generated schemas/fixtures and client projection | Changed | Own optional theme contract; preserve it in snapshots/presentation changes |
| Chat | Proposed theme boundary inside [App](../../src/web/app/App.tsx), [provider setup](../../src/web/app/main.tsx), [shared colors](../../src/web/ui/theme.ts) | Changed | Derive provider configuration from selected SDK session; wrap shell and overlay providers; map semantic colors centrally |
| Chat | [WidgetBlock](../../src/web/extensions/widgets/WidgetPanel.tsx) | Reused | Render existing ANSI strings unchanged |

Server instances are runtime-scoped, not Pi module-global state. Browser selection remains Chat-owned; the SDK stores each session's authoritative palette. No new backend endpoint or state store is needed.

## Runtime flow
1. On creation/replacement, the adapter reads effective `settingsManager.getTheme()` and trusted `resourceLoader.getThemes()`. Resolve an exact custom resource or built-in using the isolated Pi loader in truecolor mode, without global registration or terminal initialization.
2. Construct the runtime UI context with that instance, preserving the existing headless decoration workaround. Serialize its resolved colors and appearance. Resolve optional `export.pageBg/cardBg/infoBg` with Pi's validation/color primitives at the same compatibility seam; never implement a competing variable/color parser.
3. The publisher includes the palette in presentation snapshots and change signatures. Existing initialization/reconnect supplies it along with other runtime state.
4. Chat's theme boundary reads only the selected runtime's SDK presentation, builds Mantine configuration and forces its declared scheme. Background updates do not change the active palette. Home retains the selected runtime palette; without one, use current auto-scheme defaults.
5. `/reload` re-resolves before extensions restart and generate widget content, then publishes current presentation. Failure selects Pi dark and logs a diagnostic; it never blocks the session. No file watching or live theme mutation is introduced.

## Contracts & API changes
| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| Pi → server UI binding | Shared fixed-dark `Theme` → runtime-owned resolved `Theme` | Extension method signatures and ANSI widget contract unchanged |
| Server → SDK | Existing presentation → optional proposed `theme` with bounded name, `appearance`, fixed semantic color fields and page/panel/info surfaces | Additive v2 field; omission means unsupported/unavailable, not an instruction to retain another runtime's theme |
| SDK → Chat | Presentation projection without palette → retain optional theme in snapshots and full presentation replacements | Older servers retain existing UI; existing Zod objects strip unknown fields for older TypeScript clients |
| Chat → Mantine | Default provider → selected-theme override plus CSS-variable resolver | Internal only; fonts, spacing and component interactions unchanged |

All transmitted colors are validated six-digit RGB hex, not source expressions, paths or CSS. Send only roles consumed by the adapter, not the full Pi theme schema. Include `accent`, `text`, `muted`, `border`, `selectedBg`, `mdLink`, `success`, `warning`, `error`, `userMessageBg/Text`, `thinkingText` and `toolDiffAdded/Removed`. Use existing presentation revision ordering; removing the optional field clears that session's palette. Repeated identical palettes do not create updates.

## Decisions & Trade-offs
- **Confirmed current gap:** widgets use a deterministic Pi dark instance; they do not currently follow the configured custom theme. Mantine currently uses `defaultColorScheme="auto"` without a Pi palette.
- Resolve theme names against runtime-discovered resources, not global `initTheme`/`setRegisteredThemes`; those globals would couple concurrent sessions. Keep non-public Pi loader/validation/color helpers in the existing pinned compatibility seam and test packed installs.
- A missing/`system` selection uses deterministic Pi dark. For `light/dark` settings choose the dark member; browser-controlled pair selection is deferred. Explicit themes control their own appearance.
- Prefer Pi export page/card/info surfaces when supplied; otherwise use Pi's export surface-derivation policy based on `userMessageBg`. Reuse Pi helpers/primitives rather than duplicating its color math.
- Map `accent` to primary controls/focus, `mdLink` to links, `text`/`muted`/`border` to corresponding variables, and semantic status colors to the existing shared vocabulary. Use message/thinking/diff roles where already represented in Chat. Audit direct named-palette references so status dots/cards are not left in stock Mantine colors.
- Keep mapped semantic anchor colors exact. Derive ten-shade Mantine palettes and missing hover/disabled/tinted states locally; accessible button labels may need a contrasting foreground rather than the Pi body-text color. User-defined low-contrast source palettes are not silently rewritten.
- No new runtime dependency is planned. No automatic publication, Swift UI theming, live service replacement, theme selector/editor, or syntax-highlighting overhaul. Swift clients may ignore optional metadata; verify decoding compatibility separately from implementing native theme support.

## Verification
Planned, not executed:
- SDK fixtures/schema/projection: optional/absent fields, invalid hex, bounded names, replacement/removal, revisions and older-client unknown-field behavior; check pinned Swift decoder against representative added-field payloads.
- Server: custom variables/color formats and export surfaces without a TTY; trusted-resource selection; missing/invalid/system/pair fallbacks; two runtimes with different palettes; reload before extension startup; unchanged widget clearing/ANSI semantics. Check internal Pi seam in a fresh packed install.
- Chat unit/DOM: exact semantic mappings, derived shades, scheme forcing, portal inheritance, selected/background sessions, Home/no-session fallback and metadata removal. Preserve composer focus and dialog behavior.
- Before production edits, obtain approval of the isolated S1 visual mockup. Browser automation for mockup review remains opt-in.
- After implementation, run relevant builds/suites and isolated end-to-end custom-theme → widget + interface verification, including reload/reconnect. Consume verified package artifacts without editing installed sources; publication requires separate authorization.

## Open Questions
None. The proposed headless fallback, Home and reload policies above are part of the design submitted for approval.
