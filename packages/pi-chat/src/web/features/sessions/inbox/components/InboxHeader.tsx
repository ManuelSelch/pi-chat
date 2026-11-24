import { ActionIcon, AppShell, Group, Text } from "@mantine/core";
import { IconArchive, IconChevronRight, IconClockPause, IconLayoutSidebar, IconPlus, IconX } from "@tabler/icons-react";
import type { Tab } from "../../../../types/view-types.js";
import { InboxStatus } from "./InboxStatus.js";
import styles from "./Inbox.module.css";
import { SidePanelToggle } from "../../../../app/plugins/SidePanelProvider.js";

interface InboxHeaderProps {
  session: Tab | undefined; branch: string | undefined; title: string | undefined;
  opened: boolean; disabled: boolean; pending: boolean; saved: boolean;
  onToggle(): void; onNew(): void; onPark(): void; onArchive(): void; onCloseView(): void;
}
export function InboxHeader(p: InboxHeaderProps) {
  const title = p.session ? p.branch?.trim() || p.title : p.title;
  return <AppShell.Header>
    <Group h={58} px={{ base: "xs", sm: "lg" }} gap="sm" wrap="nowrap">
      <ActionIcon style={{ flexShrink: 0 }} variant="subtle" color="gray" aria-label="Sessions" data-projects-toggle aria-expanded={p.opened} onClick={p.onToggle}><IconLayoutSidebar size={18} /></ActionIcon>
      <div className={styles.breadcrumb}>
        {p.session && <><Text size="xs" c="dimmed" visibleFrom="sm" maw="70%" miw={0} truncate>{p.session.projectName}</Text><IconChevronRight size={12} className="hidden shrink-0 sm:block" /></>}
        {title && <Text size="xs" miw={0} flex={1} truncate>{title}</Text>}
      </div>
      {p.session && <>
        <span className={styles.headerStatus}><InboxStatus status={p.session.status} label /></span>
        <div className={styles.headerActions}>
          {p.session.status !== "running" && <>
            <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Move current session to Later" disabled={p.disabled || p.pending || p.session.status !== "idle" || !p.saved} onClick={p.onPark}><IconClockPause size={17} /></ActionIcon>
            <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Archive current session" disabled={p.disabled || p.pending || p.session.status !== "idle" || !p.saved} onClick={p.onArchive}><IconArchive size={17} /></ActionIcon>
          </>}
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Close current session view" onClick={p.onCloseView}><IconX size={17} /></ActionIcon>
        </div>
      </>}
      <ActionIcon style={{ flexShrink: 0 }} variant="subtle" color="gray" aria-label="New session" disabled={p.disabled} onClick={p.onNew}><IconPlus size={19} /></ActionIcon>
      <SidePanelToggle />
    </Group>
  </AppShell.Header>;
}
