import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import { Panel } from "../../ui/Panel.js";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import type { Widget } from "../../../shared/protocol.js";

/**
 * A widget an extension pushed with `ctx.ui.setWidget`, e.g. a todo overlay.
 *
 * The terminal draws these as fixed-width rows above the editor, so the lines
 * arrive pre-formatted and are shown verbatim in a monospace block rather than
 * re-laid out. Nothing here knows which extension sent them: an extension that
 * speaks Pi's widget protocol renders without any support code of its own.
 */
export function WidgetBlock({ widget }: { widget: Widget }) {
  const [open, setOpen] = useState(true);
  // The key is the extension's own identifier, and it is all the browser has to
  // label the panel with.
  const title = widget.key;

  return (
    <Panel p="xs" mb="xs">
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
    </Panel>
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
