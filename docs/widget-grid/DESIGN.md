# Above-composer widget grid — Design

## Overview
Use a container-width-responsive CSS grid only for widgets above the composer. Leave docked and below-composer widgets stacked, without a height cap.

## Components
| Module | Component | Change | Responsibility |
|---|---|---|---|
| Web composer | [ComposerView](../../src/web/chat/composer/ComposerView.tsx) | Changed | Opt only widgetsAbove into grid layout |
| Web widgets | [WidgetPanel / WidgetBlock](../../src/web/extensions/widgets/WidgetPanel.tsx) | Changed | Grid wrapper, spacing and shrinkable cards |
| Web widgets | [WidgetDock](../../src/web/extensions/widgets/WidgetDock.tsx) | Reused | Keep existing stacked dock |

Disclosure state remains local to each keyed WidgetBlock; no new application state.

## Runtime flow
1. Existing placement logic separates above, below and docked widgets.
2. ComposerView opts its above-composer WidgetPanel into the proposed grid layout.
3. CSS fits as many 230px minimum columns as the container allows, with 6px gaps.
4. Narrow containers fall back to one column; cards below 230px shrink to fit. Source order and independent collapse behavior remain unchanged.

## Contracts & API changes
| Provider → consumer | Current → proposed contract | Compatibility |
|---|---|---|
| ComposerView → WidgetPanel | Widgets only → optional grid opt-in | Default remains stacked |
| WidgetPanel → WidgetBlock | Fixed bottom margin → grid cards omit bottom margin | Dock and stacked cards preserve existing spacing |

Wire protocol, server, SDK and dependencies remain unchanged.

## Decisions & Trade-offs
- Use auto-fit, minimum min(100%, 230px), equal flexible columns and start alignment.
- Apply min-width: 0 to grid cards; preserve text wrapping.
- Grid gap replaces card bottom margins only in grid mode; retain 6px separation before composer.
- No height cap, scrolling region, content-length heuristic or special full-width cards. Every above-composer widget participates; long content may wrap more.

## Verification
Planned: focused DOM tests for above-only opt-in, source order, card spacing and disclosure regression; TypeScript and build checks. Browser layout checks at widths below and above the 466px two-column threshold should confirm wrapping and no horizontal overflow. Mockup review is user-led; no automated visual checks have run.

## Open Questions
None.
