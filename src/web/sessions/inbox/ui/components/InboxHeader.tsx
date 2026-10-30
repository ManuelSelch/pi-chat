import { ActionIcon, AppShell, Group, Text } from "@mantine/core";
import { IconArchive, IconChevronRight, IconClockPause, IconGitBranch, IconLayoutSidebar, IconPlus, IconX } from "@tabler/icons-react";
import type { PiChatBadge, PiChatButton, Tab } from "../../../../app/state/view-types.js";
import { Slot } from "../../../../extensions/Slot.js";
import { InboxStatus } from "./InboxStatus.js";

interface InboxHeaderProps {
  session: Tab | undefined; branch: string | undefined; title: string;
  opened: boolean; disabled: boolean; pending: boolean; saved: boolean;
  buttons: readonly PiChatButton[]; badges: readonly PiChatBadge[];
  onToggle(): void; onNew(): void; onPark(): void; onArchive(): void; onCloseView(): void; onAction(id: string): void;
}
export function InboxHeader(p: InboxHeaderProps) {
  return <AppShell.Header>
    <Group h={58} px={{ base: "xs", sm: "lg" }} gap="sm" wrap="nowrap">
      <ActionIcon className="shrink-0" variant="subtle" color="gray" aria-label="Sessions" data-projects-toggle aria-expanded={p.opened} onClick={p.onToggle}><IconLayoutSidebar size={18} /></ActionIcon>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Text size="sm" fw={600} className="shrink-0">Pi Chat</Text>
        {p.session && <><Text size="xs" c="dimmed" className="hidden max-w-32 shrink-0 truncate sm:block">{p.session.projectName}</Text><IconChevronRight size={12} className="hidden shrink-0 sm:block" /></>}
        <Text size="xs" truncate title={p.title}>{p.title}</Text>
      </div>
      {p.session && <>
        {p.branch && <span className="flex max-w-20 min-w-0 items-center gap-1 text-xs text-[var(--mantine-color-dimmed)] sm:max-w-40" title={`Branch: ${p.branch}`}><IconGitBranch size={13} className="shrink-0" /><span className="truncate">{p.branch}</span></span>}
        <span className="shrink-0 text-xs text-[var(--mantine-color-dimmed)]"><InboxStatus status={p.session.status} label /></span>
        <Slot name="session.status" buttons={p.buttons} badges={p.badges} onAction={p.onAction} />
        <Slot name="session.header.right" buttons={p.buttons} badges={p.badges} onAction={p.onAction} />
        <div className="flex shrink-0 items-center">
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Move current session to Later" title="Move to Later" disabled={p.disabled || p.pending || p.session.status !== "idle" || !p.saved} onClick={p.onPark}><IconClockPause size={17} /></ActionIcon>
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Archive current session" title="Archive session" disabled={p.disabled || p.pending || p.session.status !== "idle" || !p.saved} onClick={p.onArchive}><IconArchive size={17} /></ActionIcon>
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Close current session view" title="Close view · keep in Inbox" onClick={p.onCloseView}><IconX size={17} /></ActionIcon>
        </div>
      </>}
      <ActionIcon className="shrink-0" variant="subtle" color="gray" aria-label="New session" title="New session" disabled={p.disabled} onClick={p.onNew}><IconPlus size={19} /></ActionIcon>
    </Group>
  </AppShell.Header>;
}
