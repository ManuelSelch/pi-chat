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
            // Terminal rows are already wrapped to a width, so they are kept as
            // written and scrolled rather than re-wrapped into a different shape.
            whiteSpace: "pre",
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
