import { ActionIcon, AppShell, Group, Text } from "@mantine/core";
import { IconArchive, IconChevronRight, IconClockPause, IconGitBranch, IconLayoutSidebar, IconPlus, IconX } from "@tabler/icons-react";
import type { PiChatBadge, PiChatButton, Tab } from "../../../../app/state/view-types.js";
import { Slot } from "../../../../extensions/Slot.js";
import { InboxStatus } from "./InboxStatus.js";
import styles from "./Inbox.module.css";

interface InboxHeaderProps {
  session: Tab | undefined; branch: string | undefined; title: string;
  opened: boolean; disabled: boolean; pending: boolean; saved: boolean;
  buttons: readonly PiChatButton[]; badges: readonly PiChatBadge[];
  onToggle(): void; onNew(): void; onPark(): void; onArchive(): void; onCloseView(): void; onAction(id: string): void;
}
export function InboxHeader(p: InboxHeaderProps) {
  return <AppShell.Header>
    <Group h={58} px={{ base: "xs", sm: "lg" }} gap="sm" wrap="nowrap">
      <ActionIcon style={{ flexShrink: 0 }} variant="subtle" color="gray" aria-label="Sessions" data-projects-toggle aria-expanded={p.opened} onClick={p.onToggle}><IconLayoutSidebar size={18} /></ActionIcon>
      <div className={styles.breadcrumb}>
        <Text size="sm" fw={600} style={{ flexShrink: 0 }}>Pi Chat</Text>
        {p.session && <><Text size="xs" c="dimmed" visibleFrom="sm" maw={128} miw={0} truncate>{p.session.projectName}</Text><IconChevronRight size={12} className="hidden shrink-0 sm:block" /></>}
        <Text size="xs" miw={0} flex={1} truncate title={p.title}>{p.title}</Text>
      </div>
      {p.session && <>
        {p.branch && <span className={styles.headerBranch} title={`Branch: ${p.branch}`}><IconGitBranch size={13} className="shrink-0" /><span className="truncate">{p.branch}</span></span>}
        <span className={styles.headerStatus}><InboxStatus status={p.session.status} label /></span>
        <div className={styles.headerExtras}>
          <Slot name="session.status" buttons={p.buttons} badges={p.badges} onAction={p.onAction} />
          <Slot name="session.header.right" buttons={p.buttons} badges={p.badges} onAction={p.onAction} />
        </div>
        <div className={styles.headerActions}>
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Move current session to Later" title="Move to Later" disabled={p.disabled || p.pending || p.session.status !== "idle" || !p.saved} onClick={p.onPark}><IconClockPause size={17} /></ActionIcon>
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Archive current session" title="Archive session" disabled={p.disabled || p.pending || p.session.status !== "idle" || !p.saved} onClick={p.onArchive}><IconArchive size={17} /></ActionIcon>
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Close current session view" title="Close view · discard empty session" onClick={p.onCloseView}><IconX size={17} /></ActionIcon>
        </div>
      </>}
      <ActionIcon style={{ flexShrink: 0 }} variant="subtle" color="gray" aria-label="New session" title="New session" disabled={p.disabled} onClick={p.onNew}><IconPlus size={19} /></ActionIcon>
    </Group>
  </AppShell.Header>;
}
