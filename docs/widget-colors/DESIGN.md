# Colored Widgets — Design

## Overview

Preserve ANSI styling from extensions in the independent `pi-server`, and render widget strings as styled plain text using Fancy-ANSI in Pi Chat. Replace widget Markdown rendering; leave ordinary chat Markdown unchanged. No custom ANSI parser or Markdown adapter is needed.

## Components

| Package/module | Component | Change | Responsibility |
|---|---|---|---|
| `pi-server` | Headless theme in `src/runtime/pi/web-ui-context.ts` | Changed | Replace the identity theme with Pi's real theme using a deterministic dark palette |
| `pi-server` | `src/extensions/ui/widget-registry.ts` | Changed | Preserve SGR styling, normalize trailing blank lines and detect styled-content changes |
| SDK / transport | Existing widget string schemas, snapshots and presentation events | Reused | Carry styled lines without protocol changes |
| Chat widgets | [`WidgetBlock`](../../src/web/extensions/widgets/WidgetPanel.tsx) | Changed | Render joined lines with Fancy-ANSI instead of Markdown; retain disclosure, placement and dock behavior |
| External library | `AnsiHtml` from `fancy-ansi/react` | New dependency | Convert ANSI to escaped, styled HTML, including simultaneous text decorations |
| Chat packaging | `package.json`, lockfile and temporary server archive | Changed | Consume the independently built server package for reproducible end-to-end testing |

The server owns widget content and update suppression. ANSI state spans the complete joined widget text, including line breaks, but never another widget or render. Fancy-ANSI creates a fresh converter for each render.

## Runtime flow

1. An extension uses the **headless theme** and calls `ctx.ui.setWidget` with styled string lines.
2. **Widget normalization** retains SGR sequences. Trailing lines are considered blank using their unstyled text, preserving existing trimming and empty-widget clearing semantics.
3. **Widget string transport** publishes the normalized content through existing snapshots or presentation events.
4. **`WidgetBlock`** joins lines with literal newlines and passes the complete string to **`AnsiHtml`** with hyperlinks disabled.
5. **`AnsiHtml`** displays colored plain text. Wrapper CSS preserves whitespace, indentation and blank lines and wraps long text.

A color-only change must publish an update. Identical styled content remains suppressed. Clearing removes the panel; reconnect restores its current styled contents.

## Contracts & API changes

| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| Extension → server theme | Theme methods return plain text → return ANSI-styled text | Signatures unchanged; non-widget consumers must retain their current plain-text normalization |
| Server → SDK / Chat | Widget lines lose ANSI → retain SGR styling | String-array wire shape unchanged; schema/WebSocket/TypeScript SDK preservation verified in the probe |
| `WidgetBlock` → renderer | Markdown source → ANSI-styled plain text | Intentional widget behavior change: headings, lists and Markdown links remain literal text; chat messages are unaffected |
| Fancy-ANSI → browser | No dependency → pinned `fancy-ansi@0.2.2` `AnsiHtml` | Library-generated escaped HTML replaces Markdown output; hyperlinks remain disabled |
| Server package → Chat | Registry version → temporary repository-local packed tarball | User-approved for testing; manifest and lockfile must reference the archive, never an absolute sibling path or patched installed sources |

Build and test changes in the independent server repository. Copy its verified `npm pack` archive into Chat's `vendor/` with source revision/checksum provenance, then install normally. This temporary testing pin does not authorize npm publication, project pushing, or live-service replacement. Return to a registry pin after a separately approved server publication; the SDK stays registry-pinned.

## Decisions & Trade-offs

- Use Fancy-ANSI rather than ansi-to-react: the [probe](ANSI-PROBE.md) verified simultaneous bold, italic, underline and strikethrough, colors and resets without a custom renderer.
- Support the verified foreground/background colors (basic, 256-color, RGB), individual/combined decorations and resets. Do not promise exact Pi TUI parity for every SGR code. Literal RGB stays literal; browser-adaptive contrast and terminal theme synchronization are outside scope.
- Use Pi's deterministic dark theme without terminal queries or watchers. Preserve existing normalization for footers, notifications and other non-widget surfaces.
- Accept Fancy-ANSI's generated-HTML boundary; keep hyperlinks off and test HTML-injection regressions. Ordinary chat's raw-HTML policy is unchanged.
- OSC handling is explicitly deferred at the user's request. Do not build a custom OSC sanitizer or claim comprehensive terminal-control filtering. Unsupported OSC payloads, C1 controls and malformed sequences retain the library's known limitations documented in the probe; terminal operations must not be executed.
- Prefer the library's rendering and ordinary wrapper CSS over new application abstractions. Investigate actual build/dependency footprint, including its declared Tailwind peer, without introducing the optional plugin unnecessarily.

## Verification

**Already verified:** the isolated probe preserved ANSI through schema validation, real WebSocket delivery, SDK state, color-only events and reconnect snapshots. Fancy-ANSI passed isolated combined-style/reset, color, multiline/wrapping and representative inert-HTML checks. Those probes bypassed current server normalization and are not production integration results.

**Planned regression coverage:**

- Server unit tests: real theme output, SGR preservation, color-only updates, identical-content suppression, styled blank-line trimming, empty/undefined clearing and unchanged non-widget text behavior.
- Transport tests: actual widget registration → snapshots/presentation events → SDK state, including color-only updates and reconnect, rather than only injecting styled snapshots.
- Chat DOM tests: colors, combined decorations, selective/full resets, multiline state, literal Markdown, inert HTML, disabled links, independent widgets/rerenders and unchanged disclosure/dock behavior.
- Driven isolated browser scenario: extension theme → independent packed server → real transport → Chat widget, checking computed colors/decorations, multiline layout, an update and clearing.
- Run typechecks, builds and focused/full suites in both repositories, package verification and clean tarball installation in Chat. Tests use isolated runtimes and metadata, not live user sessions. Record failures and unverified boundaries explicitly.

## Open Questions

None. Transport compatibility was investigated; removing widget Markdown eliminates source-mapping uncertainty. The user approved temporary packed-server testing and deferred OSC handling. Design approval is required before implementation.
