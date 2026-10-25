# ANSI widget compatibility probe

## Scope and method

Investigation only; no production code, committed test suites, project dependency files, or installed server/SDK sources changed. The existing DESIGN.md was already modified before the probe and was left untouched.

- Installed packages tested: `@manuelselch/pi-server@0.1.0`, `@manuelselch/pi-sdk@0.1.0`.
- Isolated renderer installation: `ansi-to-react@6.2.6`, React `19.3.1`. Package peer dependencies explicitly accept React 19.
- Local scripts and raw results are in ignored `test-results/widget-colors-probe/` (not permanent regression tests).
- Ran `node test-results/widget-colors-probe/transport.mjs` and `node test-results/widget-colors-probe/render.cjs`.
- Transport used a real loopback Pi server, WebSocket connection and SDK client with the `presentation` capability. A fake runtime supplied ANSI-bearing snapshots directly, deliberately bypassing current widget normalization to isolate the downstream boundary.
- Renderer used React server rendering of the actual published component. Managed Chromium loaded its output and checked computed styles, text, layout, and inert HTML. This was not a production widget integration or client-side mount test.

## Schema and transport: pass, with upstream blockers

Exact string equality passed for foreground SGR, 256-color and RGB controls, combined styles/resets, multiline strings and Unicode:

1. `presentationSchema` validation.
2. Initial session creation snapshot through server → WebSocket → SDK session state.
3. A color-only `presentation.changed` event.
4. An explicit `session.snapshot` response.
5. Reconnect initialization and restored session state.

The current real extension path does **not** preserve styling:

- `WidgetRegistry.normalize()` calls `stripAnsi` for every line. A probe confirmed red text becomes plain text; changing only red to blue produces no second update.
- `createWebUiContext()` exposes an identity/no-op theme. A probe confirmed `theme.fg("warning", "warning")` returns unstyled text.

Conclusion: no protocol shape change is indicated for the tested TypeScript/browser boundary. Server theme generation and widget normalization still require changes before actual extension colors reach Chat. Swift and other consumers were not exercised.

## ansi-to-react rendering

| Behavior | Result |
|---|---|
| Basic foreground/background colors | Pass |
| 256-color foreground/background | Pass |
| Literal RGB foreground/background | Pass |
| Individual bold, italic, underline, strikethrough | Pass |
| Full reset and tested selective resets | Pass; clearing bold retained the foreground color |
| Multiple simultaneous decorations | **Limitation:** bold + italic + underline + strikethrough rendered only strikethrough |
| ANSI state spanning newlines | Pass |
| Indentation, blank lines, tabs, Unicode | Preserved with wrapper CSS |
| Long unbroken text | Wrapped without horizontal overflow at 320px |
| Raw HTML / script payload | Escaped as inert text; no image/script nodes created |
| Linkification | Disabled by default; no anchors created |

Layout requires ordinary integration CSS: `white-space: pre-wrap`, `overflow-wrap: anywhere`, and an appropriate font. The component emits `<code>` and styled `<span>` elements; it does not supply the widget layout.

## Control handling and limitations

- Tested cursor positioning/erase CSI sequences were discarded without executing terminal operations.
- OSC title, clipboard and hyperlink sequences were **not stripped**: control characters and payload text remained in output. They did not change the browser title or create hyperlinks in the tested page. This is not an adequate control-filtering guarantee.
- C1 CSI controls (`U+009B`) remained literal rather than being interpreted/removed.
- Carriage return rewrote `abc\rX` to `Xbc`; backspace rewrote `abc\bX` to `abX`. These are library preprocessing semantics, not simple control removal.
- Hidden SGR applied `visibility: hidden`. The package therefore supports styling beyond the proposed allowlist.
- A malformed/incomplete control sample produced lossy text (`before…text…nfinished`); malformed sequences need an explicit policy and tests.

## Recommendation

`ansi-to-react` is viable for a basic plain-text/color experiment, but is **not a drop-in implementation of the original full styling contract**.

Before production integration:

- Preserve allowed SGR in server widgets and emit real theme colors, while retaining clearing/trimming semantics and detecting color-only updates.
- Define filtering of OSC, C1, malformed controls, carriage returns/backspaces and unwanted SGR styles. Do not rely on this component as a sanitizer.
- Decide whether loss of simultaneous text decorations is acceptable for the trial. If not, choose a renderer with multi-decoration support rather than silently claiming full support.
- Keep linkification off unless a separate safe-link policy is verified.
- Verify the approved approach in the actual widget component and browser with regression tests.

## Follow-up: Fancy-ANSI comparison

Tested published `fancy-ansi@0.2.2` using its actual `AnsiHtml` React component with React 19.3.1. Reused all 17 original samples and added separate style sequences, selective decoration resets, OSC ST terminators, safe hyperlinks, and HTML/entity/attribute injection payloads. Ran `node test-results/widget-colors-probe/fancy.cjs`; generated markup was loaded in managed Chromium and checked with computed styles and DOM assertions. This remains an isolated server-rendering/browser probe, not a production integration or full security audit.

### Improvements verified

- **All four simultaneous decorations work:** bold, italic, underline and strikethrough, both in one SGR sequence and as separate successive sequences.
- Selective resets remove italic, underline and strikethrough independently while retaining remaining styles; full reset also works.
- Basic colors, 256-color and RGB foreground/background render correctly. Basic palette defaults differ from ansi-to-react and are configurable through CSS variables; default bold weight is 600.
- Multiline state, indentation, blank lines, Unicode and long-word wrapping work with the same wrapper CSS.
- Tested HTML, entity, SVG and attribute injection payloads remained inert: no executable elements/attributes were created and no probe flag was set.
- Recognized OSC 8 hyperlink controls are removed by default while preserving labels. Opting into hyperlinks produced an HTTPS anchor with `rel="noopener noreferrer nofollow"`; the tested `javascript:` destination was rejected.

### Remaining limitations

- Unknown OSC title/clipboard sequences still leak payload text; ESC characters were removed, but command contents and some other controls remained. Both BEL and ST title samples were checked.
- C1 CSI sequences remain literal. Hidden styling is supported rather than ignored. Malformed control handling is still lossy.
- Carriage returns and backspaces remain in output rather than being emulated as ansi-to-react does; define normalization explicitly.
- `AnsiHtml` uses `dangerouslySetInnerHTML` with library-generated escaped markup. The tested payloads passed, but this is a different trust boundary from React text/span rendering, not a general sanitization guarantee.
- The published package declares a Tailwind 3/4 peer dependency; the React import worked without configuring its optional Tailwind plugin. Check the final production install/build footprint before adoption.

### Updated recommendation

**Prefer Fancy-ANSI over ansi-to-react for the next widget experiment:** it fixes the verified combined-decoration defect without a custom renderer. Keep hyperlinks off initially, apply explicit server-side control/SGR filtering, bound input/output size, and validate the actual client-side widget integration before production use. The server theme and widget-normalization blockers are unchanged.
