# OSC 8 Widget Links — Design

## Overview

Enable Fancy-ANSI's existing OSC 8 hyperlink support in widget panels. Markdown links and bare URLs remain literal text; ordinary chat Markdown is unchanged.

## Components

| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| Chat widgets | [`WidgetBlock`](../../src/web/extensions/widgets/WidgetPanel.tsx) | Changed | Enable HTTP(S) OSC 8 anchors with a new-tab target |
| Fancy-ANSI | Existing `AnsiHtml` | Reused | Parse OSC 8, escape HTML and reject non-HTTP(S) destinations |
| Server / SDK | Existing widget transport | Reused | Preserve widget strings; no dependency or protocol changes |
| Browser tests | Existing widget driver and scenarios | Reused | Click emitted OSC 8 links and verify destination content in both layouts |

Widget content remains server-owned. Disclosure state remains local to each widget.

## Runtime flow

1. An extension emits an OSC 8 label/destination using pi-tui's `hyperlink` helper.
2. Existing server and SDK paths deliver the widget strings.
3. `WidgetBlock` joins lines and enables `AnsiHtml` hyperlinks with `target: _blank`.
4. Clicking the generated anchor opens its HTTP(S) destination in a new tab. Unsupported schemes remain non-clickable labels.

## Contracts & API changes

| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| WidgetBlock → AnsiHtml | Hyperlinks disabled → enabled with new-tab target | OSC 8 becomes clickable; Markdown and bare URLs remain literal |
| Extensions → server → SDK → Chat | Existing string-array widget content | Wire shape and package pins unchanged |

## Decisions & Trade-offs

- Reuse Fancy-ANSI rather than adding a parser, Markdown compatibility or a dependency.
- Keep its HTTP(S)-only policy and `noopener noreferrer nofollow` attributes. Link labels need not match destinations, as with ordinary links.
- Do not implement other OSC commands or claim comprehensive terminal-control sanitization.
- Updating external extensions such as Preview to emit OSC 8 is separate from this repository-local change.

## Verification

- The existing E2E cases were confirmed red in both docked and composer layouts: labels render but anchors are absent.
- Make those cases pass without weakening their click, popup URL or destination-content assertions; destinations are intercepted locally, not fetched externally.
- Update DOM coverage for safe OSC 8 anchors, both BEL and ST terminators, retained styling, unsafe scheme rejection and inert HTML. Retain literal Markdown/bare-URL assertions.
- Run full unit tests, build/typecheck and browser tests. No live service restart.

## Open Questions

None.
