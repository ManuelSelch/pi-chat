import { useEffect, useRef } from "react";
import { Badge, Group, Paper, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { THEME } from "../../theme.js";
import type { MenuItem } from "./command-menu.js";

interface CommandMenuProps {
  commands: MenuItem[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (command: MenuItem) => void;
}

export function CommandMenu({ commands, activeIndex, onHover, onSelect }: CommandMenuProps) {
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const mouseActive = useRef<number | null>(null);

  useEffect(() => {
    if (mouseActive.current !== activeIndex) activeRef.current?.scrollIntoView({ block: "nearest" });
    mouseActive.current = null;
  }, [activeIndex]);

  if (commands.length === 0) return null;

  return (
    <Paper withBorder radius="md" shadow="md" mb="xs" p={4} role="listbox" aria-label="Commands">
      <ScrollArea.Autosize mah={260}>
        <Stack gap={0}>
          {commands.map((command, index) => (
            <UnstyledButton
              key={command.name}
              ref={index === activeIndex ? activeRef : undefined}
              role="option"
              aria-selected={index === activeIndex}
              onMouseMove={(event) => {
                const last = pointer.current;
                if (last && last.x === event.clientX && last.y === event.clientY) return;
                pointer.current = { x: event.clientX, y: event.clientY };
                if (index !== activeIndex) {
                  mouseActive.current = index;
                  onHover(index);
                }
              }}
              // The composer keeps focus, so selection must happen before blur.
              onMouseDown={(event) => { event.preventDefault(); onSelect(command); }}
              p="6px 10px"
              style={{
                borderRadius: "var(--mantine-radius-sm)",
                background: index === activeIndex ? THEME.surface.panelHover : undefined,
              }}
            >
              <Group gap={6} wrap="nowrap">
                <Text size="sm" fw={600}>{command.kind === "action" ? command.name : `/${command.name}`}</Text>
                {command.kind === "command" && command.argumentHint ? <Text size="xs" c="dimmed">{command.argumentHint}</Text> : null}
                <Badge size="xs" variant="light">{command.kind === "action" ? "session" : command.source ?? "command"}</Badge>
              </Group>
              {command.description ? (
                <Text size="xs" c="dimmed" lineClamp={1}>{command.description}</Text>
              ) : null}
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea.Autosize>
    </Paper>
  );
}
