# ANSI Styling in Markdown Widgets — Design

## Proposed Design
- Add an opt-in `ansi` prop to `src/web/chat/markdown/Markdown.tsx`; enable it in `WidgetBlock`. Reuse the current Markdown pipeline, safe links, hard breaks, disclosure and dock. Ordinary chat rendering stays unchanged.
- Keep a pure ANSI extractor in the Markdown feature's Domain layer. Scan the complete joined widget source once; remove terminal controls and return clean Markdown plus non-overlapping style ranges indexed by clean-source UTF-16 offsets. Maintain style across lines, but never across widgets or renders.
- Add a remark adapter beside the existing Markdown plugins. After Markdown parsing, split eligible text nodes at style boundaries and create internal span nodes. Map source offsets to decoded text, including escapes and entities; do not assume source length equals displayed length. Preserve Markdown structure across color changes.
- Render only internally generated, validated style properties as React spans. Do not enable raw HTML or inject ANSI-generated HTML.
- In independent `pi-server`, replace the no-op theme with Pi's real headless theme and preserve supported SGR sequences in widget normalization. Retain trailing-blank trimming, empty clearing and change suppression; compare styled content so color-only updates publish. Keep non-widget normalization unchanged. Release the verified server change through its independent npm package, then update Chat's pinned npm version and lockfile; never patch installed compiled sources directly. Publishing requires separate user approval.

## Decisions & Trade-offs
- Support foreground/background colors (16-color, 256-color and RGB), bold, italic, underline, strikethrough and corresponding resets. Ignore unsupported styling; discard cursor controls, OSC commands and other terminal operations without executing them.
- Use a deterministic Pi dark palette for headless theme output initially; do not query a terminal or synchronize browser appearance. Literal RGB colors remain literal; exact terminal-palette matching and adaptive contrast are outside scope.
- Apply styling to visible prose and link labels, not destinations, attributes, image alternatives, inline/fenced code or math. Those retain existing rendering after control removal. Markdown semantics take precedence over ANSI resets.
- Keep existing string-based widget transport; no new protocol fields or SDK API are proposed. Verify existing schema limits with ANSI-bearing strings before implementation.
- Reject rendering ANSI segments independently as Markdown: it breaks syntax spanning segments. Source-aware decoration costs more but preserves existing widget behavior. No new runtime dependency is assumed; validate mapping against parser behavior before choosing implementation details.

## Verification
- Unit-test colors, selective/full resets, multiline state, malformed controls, Unicode, escapes/entities and source mapping.
- Extend Markdown/widget DOM tests for styled bold text, links, lists/tables, hard breaks, code/math exclusions, unsafe URLs/HTML and unchanged non-ANSI rendering.
- Server tests cover theme output, control filtering, color-only updates, clearing and snapshot delivery. A driven isolated browser test verifies clean/dirty git-status styling without extension changes. Run build, focused/full suites and artifact verification after implementation.

## Open Questions
None.
