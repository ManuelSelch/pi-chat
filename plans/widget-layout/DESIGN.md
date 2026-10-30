# Composer widget grid — Design

## Overview

Apply visually approved revision 3 of [the mockup](../../mockups/widget-grid/DESIGN.md) to the widgets above the composer. Keep bottom alignment, limit the grid to two cards per row, and let the lone card of an odd count span the full row. The desktop dock, below-composer panels, ANSI rendering, collapse behaviour and widget ordering are unchanged. This supersedes only the column rule in [the original widget grid design](../../docs/architecture.md) (`4dc0d03`, alignment changed in `284f473`).

## Current behaviour (measured from the code)

- The grid lives inside the composer `Container size="sm"`: `max-width: 45rem` (720px) with `padding-inline: var(--mantine-spacing-md)` (16px), so the grid is **at most 688px wide**.
- `repeat(auto-fit, minmax(min(100%, 230px), 1fr))` needs 702px for three columns (3 × 230 + 2 × 6). At 688px it therefore already produces two columns.
- Consequence: the requested "at most two per row" rule is a **guarantee rather than a visible change** today. The visible change is the lone card of an odd count: it currently keeps half the row (empty cell beside it) and will span the row instead.
- The threshold must be measured against the composer column, not the viewport: with the projects sidebar open, `workspaceLayout` reserves 288px of the viewport, so a viewport media query would wrongly allow two columns in a 412px column.

## Decisions & Trade-offs

- `WidgetPanel` gains a wrapper that is a CSS size container (`container-type: inline-size`, class `widget-grid`) and an inner grid element (class `widget-grid-rows`). The column count becomes a `@container (min-width: 466px)` rule in `src/web/app/styles.css`; 466px is exactly 2 × 230px + 6px gap. A container cannot query itself, hence the extra wrapper.
- The lone-card span is computed in TypeScript (`widgets.length % 2 === 1` on the last card) and applied as an inline `grid-column: 1 / -1` rather than a CSS `:last-child:nth-child(odd)` rule: it follows from props, it cannot leak into the stacked layout, and jsdom can assert it.
- `WidgetBlock` keeps a single responsibility: it renders one card, now with an optional `span` flag. It stays unaware of how many cards exist.
- No JavaScript measurement, no `ResizeObserver`, no height cap and no inner scroll area. Card heights stay natural and bottom alignment (`align-items: end`) is preserved, so a short card still sits flush with the bottom of a tall neighbour in the same row.
- Below-composer panels keep the plain stacked box with no container wrapper, so the change cannot affect them.
- jsdom cannot evaluate container queries. The DOM scenario therefore asserts structure, alignment and the span flag; the actual column packing is asserted by real browser geometry (card bottoms, row grouping, card width versus grid width). This limit is intentional and is not silently skipped.

## Verification

- [Component scenarios](../../test/modules/web/extensions/widgets/widget-panel.dom.test.tsx) cover the three-card grid (structure, order, disclosure, no height cap, `1 / -1` on the last card) and the even-count case with no span. They do not prove the column count, and the inline `align-items` assertion was replaced by the class assertion because bottom alignment moved into the stylesheet.
- [Composer scenarios](../../test/modules/web/chat/composer/steering.dom.test.tsx) keep asserting that only above-composer panels use the grid.
- [Browser scenarios](../../test/e2e/widgets.spec.ts) push three real extension widgets through the real runtime at the composer viewport and assert bottom-aligned row packing, that the third card begins a new row and spans the full grid width, and that no row holds more than two cards.
- Run: `npm test` 943 passed / 109 files; `npx tsc --noEmit` clean; `npm run build` clean; `npx playwright test test/e2e/widgets.spec.ts` 7 passed. The new browser scenario failed before the production change (no `.widget-grid-rows` element) and passed after it.

## Open Questions

None.
