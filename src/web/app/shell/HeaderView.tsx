import { ActionIcon, AppShell, Group, Text, Tooltip } from "@mantine/core";
import { IconLayoutSidebar, IconSettings } from "@tabler/icons-react";
import type { PiChatBadge, PiChatButton, Tab } from "../state/view-types.js";
import { Slot } from "../../extensions/Slot.js";
import { TabBar } from "../../sessions/tabs/TabBar.js";
import { MANTINE_COLOR } from "../../ui/theme.js";

interface HeaderViewProps {
  home: boolean;
  title: string;
  tabs: readonly Tab[];
  openingTabs: number;
  activeSessionId: string;
  buttons: readonly PiChatButton[];
  badges: readonly PiChatBadge[];
  projectsOpened: boolean;
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
  tabs,
  openingTabs,
  activeSessionId,
  buttons,
  badges,
  projectsOpened,
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
            <ActionIcon variant="subtle" color={MANTINE_COLOR.neutral} aria-label="Projects and sessions" data-projects-toggle aria-expanded={projectsOpened} onClick={onOpenProjects}>
              <IconLayoutSidebar size={18} />
            </ActionIcon>
          </Tooltip>
          {home ? null : <Text c="dimmed" size="xs" truncate>{title}</Text>}
        </Group>
        <Group gap="sm" wrap="nowrap">
          {home ? null : <Slot name="session.status" buttons={buttons} badges={badges} onAction={onAction} />}
          {home ? null : <Slot name="session.header.right" buttons={buttons} badges={badges} onAction={onAction} />}
          <Tooltip label="Settings">
            <ActionIcon variant="subtle" color={MANTINE_COLOR.neutral} aria-label="Settings" onClick={onOpenSettings}>
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
