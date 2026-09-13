import { ActionIcon, Box, Button, Group, Loader, ScrollArea, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
import type { Tab, TabStatus } from "../../shared/protocol.js";

/** Green idle, yellow running, red blocked on a prompt. */
const STATUS_COLOR: Record<TabStatus, string> = {
  idle: "var(--mantine-color-green-6)",
  running: "var(--mantine-color-yellow-6)",
  blocked: "var(--mantine-color-red-6)",
};

const STATUS_LABEL: Record<TabStatus, string> = {
  idle: "Idle",
  running: "Running",
  blocked: "Waiting for you",
};

interface TabBarProps {
  tabs: Tab[];
  /** Sessions whose runtime the server is still creating. */
  opening: number;
  activeSessionId: string;
  onFocus: (sessionId: string) => void;
  onClose: (tab: Tab) => void;
  onNew: () => void;
}

export function TabBar({ tabs, opening, activeSessionId, onFocus, onClose, onNew }: TabBarProps) {
  if (tabs.length === 0 && opening === 0) return null;

  return (
    <Group gap={4} wrap="nowrap" px="xs" py={4} style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
      <ScrollArea type="never" style={{ flex: 1 }}>
        <Group gap={4} wrap="nowrap">
          {tabs.map((tab) => {
            const active = tab.sessionId === activeSessionId;
            return (
              <UnstyledButton
                key={tab.sessionId}
                onClick={() => onFocus(tab.sessionId)}
                // Middle-click closes, matching browser tab behaviour.
                onAuxClick={(event) => { if (event.button === 1) { event.preventDefault(); onClose(tab); } }}
                px="xs"
                py={4}
                maw={220}
                style={{
                  borderRadius: "var(--mantine-radius-sm)",
                  background: active ? "var(--mantine-color-default-hover)" : undefined,
                  borderBottom: `2px solid ${active ? "var(--mantine-primary-color-filled)" : "transparent"}`,
                }}
              >
                <Group gap={6} wrap="nowrap">
                  <Tooltip label={`${STATUS_LABEL[tab.status]} · ${tab.projectName}`}>
                    <Box
                      aria-label={STATUS_LABEL[tab.status]}
                      data-status={tab.status}
                      w={8}
                      h={8}
                      style={{ borderRadius: "50%", background: STATUS_COLOR[tab.status], flexShrink: 0 }}
                    />
                  </Tooltip>
                  <Text size="xs" truncate c={active ? undefined : "dimmed"}>{tab.title}</Text>
                  <ActionIcon
                    component="div"
                    role="button"
                    size="xs"
                    variant="subtle"
                    color="gray"
                    aria-label={`Close ${tab.title}`}
                    onClick={(event) => { event.stopPropagation(); onClose(tab); }}
                  >
                    <IconX size={12} />
                  </ActionIcon>
                </Group>
              </UnstyledButton>
            );
          })}
          {Array.from({ length: opening }, (_, index) => (
            <Group key={`opening-${index}`} gap={6} wrap="nowrap" px="xs" py={4} opacity={0.7}>
              <Loader size={8} />
              <Text size="xs" c="dimmed">Opening…</Text>
            </Group>
          ))}
        </Group>
      </ScrollArea>
      <Tooltip label="New session in this project">
        <Button size="compact-xs" variant="subtle" color="gray" aria-label="New session" onClick={onNew}>
          <IconPlus size={14} />
        </Button>
      </Tooltip>
    </Group>
  );
}
