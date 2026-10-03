import { ActionIcon, AppShell, Group, Text, Tooltip } from "@mantine/core";
import { IconLayoutSidebar, IconSettings } from "@tabler/icons-react";
import type { PiChatBadge, PiChatButton, Tab } from "../../shared/protocol.js";
import { Slot } from "../extensions/Slot.js";
import { TabBar } from "../tabs/TabBar.js";

interface HeaderViewProps {
  home: boolean;
  title: string;
  status: string;
  tabs: Tab[];
  openingTabs: number;
  activeSessionId: string;
  buttons: readonly PiChatButton[];
  badges: readonly PiChatBadge[];
  onOpenProjects: () => void;
  onOpenSettings: () => void;
  onAction: (actionId: string) => void;
  onFocusTab: (sessionId: string) => void;
  onCloseTab: (tab: Tab) => void;
  onNewSession: () => void;
}

export function HeaderView({
  home,
  title,
  status,
  tabs,
  openingTabs,
  activeSessionId,
  buttons,
  badges,
  onOpenProjects,
  onOpenSettings,
  onAction,
  onFocusTab,
  onCloseTab,
  onNewSession,
}: HeaderViewProps) {
  return (
    <AppShell.Header>
      <Group h={58} px="lg" justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" miw={0}>
          <Tooltip label="Projects and sessions">
            <ActionIcon variant="subtle" color="gray" aria-label="Projects and sessions" onClick={onOpenProjects}>
              <IconLayoutSidebar size={18} />
            </ActionIcon>
          </Tooltip>
          <Text c="dimmed" size="xs" truncate title={title}>{title}</Text>
        </Group>
        <Group gap="sm" wrap="nowrap">
          {home ? null : <Slot name="session.status" buttons={buttons} badges={badges} onAction={onAction} />}
          {home ? null : <Slot name="session.header.right" buttons={buttons} badges={badges} onAction={onAction} />}
          {home ? null : (
            <Text c={status === "running" ? "green" : "dimmed"} size="xs" tt="capitalize" data-testid="status">
              {status}
            </Text>
          )}
          <Tooltip label="Settings">
            <ActionIcon variant="subtle" color="gray" aria-label="Settings" onClick={onOpenSettings}>
              <IconSettings size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <TabBar
        tabs={tabs}
        opening={openingTabs}
        activeSessionId={activeSessionId}
        onFocus={onFocusTab}
        onClose={onCloseTab}
        onNew={onNewSession}
      />
    </AppShell.Header>
  );
}
