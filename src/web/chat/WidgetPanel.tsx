import { Box, Group, Paper, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import type { Widget } from "../../shared/protocol.js";

/**
 * A widget an extension pushed with `ctx.ui.setWidget`, e.g. a todo overlay.
 *
 * The terminal draws these as fixed-width rows above the editor, so the lines
 * arrive pre-formatted and are shown verbatim in a monospace block rather than
 * re-laid out. Nothing here knows which extension sent them: an extension that
 * speaks Pi's widget protocol renders without any support code of its own.
 */
function WidgetBlock({ widget }: { widget: Widget }) {
  const [open, setOpen] = useState(true);
  // The key is the extension's own identifier, and it is all the browser has to
  // label the panel with.
  const title = widget.key;

  return (
    <Paper withBorder radius="md" p="xs" mb="xs">
      <UnstyledButton onClick={() => setOpen((value) => !value)} w="100%" aria-expanded={open}>
        <Group gap={6} wrap="nowrap">
          {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          <Text size="xs" c="dimmed" fw={600} style={{ textTransform: "uppercase", letterSpacing: 0.4 }}>
            {title}
          </Text>
          {open ? null : (
            <Text size="xs" c="dimmed" truncate>
              {widget.lines.length} line{widget.lines.length === 1 ? "" : "s"}
            </Text>
          )}
        </Group>
      </UnstyledButton>
      {open ? (
        <Box
          component="pre"
          mt={6}
          mb={0}
          style={{
            font: "var(--mantine-font-family-monospace)",
            fontSize: "var(--mantine-font-size-xs)",
            lineHeight: 1.45,
            // Terminal rows are wrapped for a width this panel does not have:
            // the dock is a gutter, not a terminal. Kept as written they scroll
            // sideways, which hides the end of every long row, so the runs of
            // spaces that align a row are preserved while an over-long row is
            // allowed to wrap. `overflowX` stays as the escape hatch for what
            // cannot be broken, e.g. an unspaced path or a rule of box glyphs.
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            overflowX: "auto",
            margin: 0,
          }}
        >
          {widget.lines.join("\n")}
        </Box>
      ) : null}
    </Paper>
  );
}

export function WidgetPanel({ widgets }: { widgets: Widget[] }) {
  if (widgets.length === 0) return null;
  return (
    <Box>
      {widgets.map((widget) => (
        <WidgetBlock key={widget.key} widget={widget} />
      ))}
    </Box>
  );
}

/** Clears the header, and is pinned so a long transcript scrolls underneath. */
export const WIDGET_DOCK_TOP = 96 + 12;

/**
 * The transcript column, `Container size="sm"`. Mantine scopes
 * `--container-size-sm` to the container itself, so the dock outside it has to
 * be told the width to reason about the gutter.
 */
const TRANSCRIPT_COLUMN = "45rem";

/**
 * Below this the gutter cannot hold the narrowest useful panel clear of the
 * transcript, so the caller leaves the panels by the composer instead.
 */
export const WIDGET_DOCK_QUERY = "(min-width: 1200px)";

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
 * Where each panel goes. Docked, the terminal's above/below split has no
 * meaning left, so the panels are simply kept in that order; otherwise they
 * stay around the composer exactly as the terminal arranges them.
 */
export function placeWidgets(widgets: Widget[], docked: boolean): {
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
