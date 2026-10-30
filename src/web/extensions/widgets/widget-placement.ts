import type { Widget } from "../../app/state/view-types.js";

/**
 * Where each panel goes. Docked, the terminal's above/below split has no
 * meaning left, so the panels are simply kept in that order; otherwise they
 * stay around the composer exactly as the terminal arranges them.
 */
export function placeWidgets(widgets: readonly Widget[], docked: boolean): {
  above: Widget[];
  below: Widget[];
  docked: Widget[];
} {
  if (!docked) {
    return {
      above: widgets.filter((widget) => widget.placement === "aboveEditor"),
      below: widgets.filter((widget) => widget.placement === "belowEditor"),
      docked: [],
    };
  }
  const rank = (widget: Widget) => (widget.placement === "belowEditor" ? 1 : 0);
  return { above: [], below: [], docked: [...widgets].sort((left, right) => rank(left) - rank(right)) };
}
