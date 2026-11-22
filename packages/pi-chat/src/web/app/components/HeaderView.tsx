import { ActionIcon, AppShell, Group, Text } from "@mantine/core";
import { IconLayoutSidebar, IconSettings } from "@tabler/icons-react";
import type { Tab } from "../../types/view-types.js";
import { TabBar } from "../../features/sessions/tabs/components/TabBar.js";
import { MANTINE_COLOR } from "../../config/theme.js";

interface HeaderViewProps {
  home: boolean;
  title: string;
  tabs: readonly Tab[];
  openingTabs: number;
  activeSessionId: string;
  projectsOpened: boolean;
  onOpenProjects: () => void;
  onOpenSettings: () => void;
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
  projectsOpened,
  onOpenProjects,
  onOpenSettings,
  onFocusTab,
  onCloseTab,
  onNewSession,
}: HeaderViewProps) {
  return (
    <AppShell.Header>
      <Group h={58} px="lg" justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" miw={0}>
          <ActionIcon variant="subtle" color={MANTINE_COLOR.neutral} aria-label="Projects and sessions" data-projects-toggle aria-expanded={projectsOpened} onClick={onOpenProjects}>
              <IconLayoutSidebar size={18} />
            </ActionIcon>
          {home ? null : <Text c="dimmed" size="xs" truncate>{title}</Text>}
        </Group>
        <Group gap="sm" wrap="nowrap">
          <ActionIcon variant="subtle" color={MANTINE_COLOR.neutral} aria-label="Settings" onClick={onOpenSettings}>
              <IconSettings size={18} />
            </ActionIcon>
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
