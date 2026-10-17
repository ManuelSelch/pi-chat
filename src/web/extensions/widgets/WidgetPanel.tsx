import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import type { Widget } from "../../app/state/view-types.js";
import { Markdown } from "../../chat/markdown/Markdown.js";
import { Panel } from "../../ui/Panel.js";

/**
 * Widget lines come from Pi's terminal-oriented API, but are joined and rendered
 * as Markdown in the browser. Nothing here knows which extension sent them: an
 * extension that speaks Pi's widget protocol renders without special support.
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
        <Box mt={6} className="markdown markdown-widget" style={{ overflowWrap: "anywhere" }}>
          <Markdown>{widget.lines.join("  \n")}</Markdown>
        </Box>
      ) : null}
    </Panel>
  );
}

export function WidgetPanel({ widgets }: { widgets: readonly Widget[] }) {
  if (widgets.length === 0) return null;
  return (
    <Box>
      {widgets.map((widget) => (
        <WidgetBlock key={widget.key} widget={widget} />
      ))}
    </Box>
  );
}
