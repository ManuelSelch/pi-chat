# Composer widget grid mockup

- Revision: 3
- Review status: approved for production implementation
- Goal: keep the above-composer widget grid tidy when a tall panel sits next to short ones (for example three panels where one prints 15+ lines).

## Revision 3 scope (proposed)

- Cards stay bottom-aligned (`align-items: end`), exactly as in production today.
- The grid is limited to **at most two cards per row**. Today's `repeat(auto-fit, minmax(min(100%, 230px), 1fr))` fits three cards as soon as the composer column reaches 702px, which is why a tall card can share a row with two short ones on a wide window.
- Two columns require 466px of composer width (2 × 230px + 6px gap); below that the cards stack in a single column.
- Because the threshold depends on the composer width rather than the viewport, the wrapper is a size container (`container-type: inline-size`) and the column rule is a container query. A viewport media query would be wrong while the projects sidebar is open.
- One open question: when the count is odd, the last card either keeps half the row (current packing, one empty cell) or spans the full row. The mockup exposes both.
- Approved: the odd card spans the full row.

## Rejected in review

- Revision 2 (top-align plus a per-panel height cap with inner scroll) was declined by the user in favour of keeping bottom alignment and limiting the row to two cards.

## Unchanged from revision 1

- 230px minimum card width, 6px gaps, natural card heights, compact headers, wrapping text, independent keyboard-accessible collapse.
- Below-composer panels stay stacked; the desktop right-hand dock is unchanged.
- No height cap and no internal scroll area inside a card.

## Review states

- Review controls switch scenario (2, 3 or 5 panels), layout (current auto-fit versus proposed max-two) and the odd-panel rule (half width versus full width) live; there are no query parameters.
- The default view reproduces the reported case: `git-status` (3 lines), `pipeline` (16 lines), `worktree-cleanup` (1 line), in that order, in a 720px column.

## Fake or omitted behaviour

- Fake widget output only; no backend, no persistence, no real extensions.
- Transcript, composer and footer are approximate stand-ins.
- The desktop dock and below-composer widgets are not shown.

## Approval evidence

- Revision 1: user explicitly said "approve. implement" (implemented in `4dc0d03`, alignment changed in `284f473`).
- Revision 2: rejected by the user.
- Revision 3: user said "I like the odd panel full width idea. This is good. max 2 and full width for odd panels. approved" — approval covers bottom alignment, at most two cards per row, and a full-width lone card in the last row.
