import { Box } from "@mantine/core";
import type { Widget } from "../../../shared/protocol.js";
import { WidgetBlock } from "./WidgetPanel.js";

/** Clears the header, and is pinned so a long transcript scrolls underneath. */
export const WIDGET_DOCK_TOP = 96 + 12;

/**
 * The transcript column, `Container size="sm"`. Mantine scopes
 * `--container-size-sm` to the container itself, so the dock outside it has to
 * be told the width to reason about the gutter.
 */
const TRANSCRIPT_COLUMN = "45rem";

/**
 * How wide a docked panel may get on a large screen.
 *
 * Lines are shown as written rather than re-wrapped, so this is what decides
 * how much of a long row is readable without scrolling sideways. The gutter is
 * usually the binding constraint anyway; this only stops a very wide window
 * from stretching the panels out of proportion with the transcript.
 */
export const WIDGET_DOCK_MAX_WIDTH = "420px";

/**
 * The transcript is a centred column, so on a wide screen the space beside it
 * is empty while the panels crowd the composer. Docked here they keep still
 * instead of moving as the conversation grows.
 *
 * The width is taken from whatever gutter that column leaves over, capped so a
 * very wide window does not stretch the panels, and the caller only mounts this
 * when the gutter is big enough to hold it without covering the transcript.
 */
export function WidgetDock({ widgets }: { widgets: Widget[] }) {
  if (widgets.length === 0) return null;
  return (
    <Box
      aria-label="Extension panels"
      pos="fixed"
      top={WIDGET_DOCK_TOP}
      right={16}
      style={{
        width: `clamp(200px, calc((100vw - ${TRANSCRIPT_COLUMN}) / 2 - 32px), ${WIDGET_DOCK_MAX_WIDTH})`,
        maxHeight: `calc(100vh - ${WIDGET_DOCK_TOP + 16}px)`,
        overflowY: "auto",
        zIndex: 100,
      }}
    >
      {widgets.map((widget) => (
        <WidgetBlock key={widget.key} widget={widget} />
      ))}
    </Box>
  );
}
