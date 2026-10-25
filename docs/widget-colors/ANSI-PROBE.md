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
