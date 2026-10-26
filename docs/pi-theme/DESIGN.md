# Pi theme reuse — Design

## Overview
Reuse Pi's resolver on the server and return its concrete palette only alongside `summary` and `snapshot` in existing open/create responses. Chat translates that palette into Mantine; the same per-runtime Pi theme colors extension widget output. This is a palette integration, not a layout redesign or a theme-management feature. See [requirements](REQUIREMENTS.md).

## Components
| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| Pi runtime dependency | `Theme`, settings and resource loader | Reused | Resolve Pi variables/color formats, appearance and trusted available themes |
| Independent `pi-server` | `runtime/pi/infra/headless-theme.ts` | Changed | Replace shared fixed-dark instance with a proposed per-runtime resolver; isolate existing internal-loader compatibility seam |
| Independent `pi-server` | `PiRuntimeAdapter`, UI bindings, `ServerPublisher.opened` | Changed | Own runtime palette; bind it before extension startup; return its serialized form only in open/create results |
| Independent TypeScript SDK | `src/protocol/v2.ts`, generated schemas/fixtures and client state | Changed | Extend shared open/create result; cache palettes by runtime independently of snapshot replacement |
| Chat | Proposed theme boundary inside [App](../../src/web/app/App.tsx), [provider setup](../../src/web/app/main.tsx), [shared colors](../../src/web/ui/theme.ts) | Changed | Derive provider configuration from selected runtime's cached palette; wrap shell and overlay providers; map semantic colors centrally |
| Chat | [WidgetBlock](../../src/web/extensions/widgets/WidgetPanel.tsx) | Reused | Render existing ANSI strings unchanged |

Theme instances are runtime-scoped, not Pi module-global state. Browser selection remains Chat-owned; the SDK keeps a small in-memory palette map keyed by runtime ID. No new backend endpoint, request, event or persistent store is needed.

## Runtime flow
1. On creation/replacement, the adapter reads effective `settingsManager.getTheme()` and trusted `resourceLoader.getThemes()`. Resolve an exact custom resource or built-in using the isolated Pi loader in truecolor mode, without global registration or terminal initialization.
2. Construct the runtime UI context with that instance, preserving the existing headless decoration workaround. Serialize its resolved colors and appearance. Resolve optional `export.pageBg/cardBg/infoBg` with Pi's validation/color primitives at the same compatibility seam; never implement a competing variable/color parser.
3. `ServerPublisher.opened` returns the runtime's cached serialized palette alongside the existing summary and snapshot. This covers successful open/create, including an open that reuses a running runtime. No other wire payload gains theme data.
4. The SDK records the palette under the returned runtime ID. Chat's theme boundary reads the selected runtime's cached palette, builds Mantine configuration and forces its declared scheme. Background open/create responses do not change the active palette. Without a cached palette, including on Home with no selected palette, use current auto-scheme defaults.
5. Ordinary snapshots, presentation changes, explicit `/reload` and same-server reconnect leave the palette cache untouched. Reload retains the server's current theme instance; theme refresh is deferred. Clear client entries on close or server-instance change. A browser reload/new client or replacement runtime without open/create delivery uses defaults until it receives an open/create result; initialization does not restore theme data.

## Contracts & API changes
| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| Pi → server UI binding | Shared fixed-dark `Theme` → runtime-owned resolved `Theme` | Extension method signatures and ANSI widget contract unchanged |
| Server → SDK | Open/create result `{ summary, snapshot }` → add sibling `theme` with bounded name, `appearance`, fixed semantic colors and page/panel/info surfaces | Updated servers always supply a concrete palette; client schema permits absence solely for older-server compatibility, never intermittent/null delivery |
| SDK → Chat | No palette cache → runtime-keyed in-memory palette populated by open/create responses | Missing theme in an open/create result clears that runtime's entry; snapshots/presentation updates do not touch it. Older TypeScript clients strip the unknown result field |
| Chat → Mantine | Default provider → selected-theme override plus CSS-variable resolver | Internal only; fonts, spacing and component interactions unchanged |

All transmitted colors are validated six-digit RGB hex, not source expressions, paths or CSS. Send only roles consumed by the adapter, not the full Pi theme schema. Include `accent`, `text`, `muted`, `border`, `selectedBg`, `mdLink`, `success`, `warning`, `error`, `userMessageBg/Text`, `thinkingText` and `toolDiffAdded/Removed`. Snapshots, summaries, presentation schemas/revisions and initialization remain unchanged. Cache lifetime is governed by runtime identity and existing close/server-instance handling, not a new revision mechanism.

## Decisions & Trade-offs
- **Confirmed current gap:** widgets use a deterministic Pi dark instance; they do not currently follow the configured custom theme. Mantine currently uses `defaultColorScheme="auto"` without a Pi palette.
- Resolve theme names against runtime-discovered resources, not global `initTheme`/`setRegisteredThemes`; those globals would couple concurrent sessions. Keep non-public Pi loader/validation/color helpers in the existing pinned compatibility seam and test packed installs.
- A missing/`system` selection uses deterministic Pi dark. For `light/dark` settings choose the dark member; browser-controlled pair selection is deferred. Explicit themes control their own appearance.
- Prefer Pi export page/card/info surfaces when supplied; otherwise use Pi's export surface-derivation policy based on `userMessageBg`. Reuse Pi helpers/primitives rather than duplicating its color math.
- Map `accent` to primary controls/focus, `mdLink` to links, `text`/`muted`/`border` to corresponding variables, and semantic status colors to the existing shared vocabulary. Use message/thinking/diff roles where already represented in Chat. Audit direct named-palette references so status dots/cards are not left in stock Mantine colors.
- Keep mapped semantic anchor colors exact. Derive ten-shade Mantine palettes and missing hover/disabled/tinted states locally; accessible button labels may need a contrasting foreground rather than the Pi body-text color. User-defined low-contrast source palettes are not silently rewritten.
- Delivery only on open/create is the user's chosen first scope. Accept missing automatic restoration after browser refresh and no theme refresh on `/reload`; do not add hidden requests, local storage or lifecycle-specific snapshot fields to compensate. Existing cached palettes survive same-server reconnect. Runtime replacements without open/create delivery fall back to defaults.
- No new runtime dependency is planned. No automatic publication, Swift UI theming, live service replacement, theme selector/editor, or syntax-highlighting overhaul. Swift clients may ignore optional metadata; verify decoding compatibility separately from implementing native theme support.

## Verification
Planned, not executed:
- SDK fixtures/schema/cache: concrete theme in open/create, older responses without it, invalid hex, bounded names, cache update/clearing, snapshots leaving cache unchanged and older-client unknown-field behavior; check pinned Swift decoder against representative added-field payloads.
- Server: custom variables/color formats and export surfaces without a TTY; trusted-resource selection; missing/invalid/system/pair fallbacks; two runtimes with different palettes; open of an existing runtime; cached instance retained through reload; unchanged widget clearing/ANSI semantics. Assert palette is absent from snapshots/presentation/initialization. Check internal Pi seam in a fresh packed install.
- Chat unit/DOM: exact semantic mappings, derived shades, scheme forcing, portal inheritance, selected/background sessions, Home/no-session fallback, missing open/create metadata, close/server-instance cache clearing and default appearance after browser refresh/replacement without delivery. Preserve composer focus and dialog behavior.
- Before production edits, obtain approval of the isolated S1 visual mockup. Browser automation for mockup review remains opt-in.
- After implementation, run relevant builds/suites and isolated end-to-end custom-theme → widget + interface verification, including cache retention through reload/same-server reconnect and the explicitly deferred theme-refresh behavior. Consume verified package artifacts without editing installed sources; publication requires separate authorization.

## Open Questions
None. The user approved this revised open/create-only design and mockup revision 1 with “yes approve and continue with S2”. The explicit reload/reconnect limitations remain in scope.
