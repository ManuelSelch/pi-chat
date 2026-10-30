import { Box, Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import { AnsiHtml } from "fancy-ansi/react";
import type { Widget } from "../../app/state/view-types.js";
import { Panel } from "../../ui/Panel.js";

/**
 * Widget lines come from Pi's terminal-oriented API, but are joined and rendered
 * as ANSI-styled plain text in the browser. Nothing here knows which extension
 * sent them: Pi's widget protocol renders without per-extension support.
 */
export function WidgetBlock({ widget, grid = false, span = false }: { widget: Widget; grid?: boolean; span?: boolean }) {
  const [open, setOpen] = useState(true);
  // The key is the extension's own identifier, and it is all the browser has to
  // label the panel with.
  const title = widget.key;

  return (
    <Panel
      py={6}
      px={8}
      mb={grid ? 0 : 6}
      miw={grid ? 0 : undefined}
      style={span ? { gridColumn: "1 / -1" } : undefined}
    >
      <UnstyledButton onClick={() => setOpen((value) => !value)} w="100%" aria-expanded={open}>
        <Group gap={6} wrap="nowrap">
          {open ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          <Text size="11px" lh={1.3} c="dimmed" fw={500}>
            {title}
          </Text>
          {open ? null : (
            <Text size="11px" lh={1.3} c="dimmed" truncate>
              {widget.lines.length} line{widget.lines.length === 1 ? "" : "s"}
            </Text>
          )}
        </Group>
      </UnstyledButton>
      {open ? (
        <Box
          mt={3}
          className="ansi-widget"
          role="region"
          aria-label={`${title} widget`}
          style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "var(--mantine-font-family-monospace)" }}
        >
          <AnsiHtml text={widget.lines.join("\n")} hyperlinks={{ target: "_blank" }} />
        </Box>
      ) : null}
    </Panel>
  );
}

export function WidgetPanel({ widgets, grid = false }: { widgets: readonly Widget[]; grid?: boolean }) {
  if (widgets.length === 0) return null;
  if (!grid) {
    return (
      <Box>
        {widgets.map((widget) => (
          <WidgetBlock key={widget.key} widget={widget} />
        ))}
      </Box>
    );
  }
  // An odd count leaves the last card alone in its row, so it takes the row
  // instead of leaving half of it empty.
  const spansLastCard = widgets.length % 2 === 1;
  return (
    <Box className="widget-grid" mb={6}>
      <Box className="widget-grid-rows">
        {widgets.map((widget, index) => (
          <WidgetBlock
            key={widget.key}
            widget={widget}
            grid
            span={spansLastCard && index === widgets.length - 1}
          />
        ))}
      </Box>
    </Box>
  );
}
