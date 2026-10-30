import { ActionIcon, Group, Text, UnstyledButton } from "@mantine/core";
import { IconArchive, IconArrowUpRight, IconClockPause } from "@tabler/icons-react";
import { relativeTime } from "../../../../ui/relative-time.js";
import type { InboxRow } from "../../domain/inbox-model.js";
import { InboxStatus } from "./InboxStatus.js";
import styles from "./Inbox.module.css";

interface InboxRowViewProps {
  row: InboxRow;
  active: boolean;
  later?: boolean;
  pending: boolean;
  onSelect(): void;
  onPark(): void;
  onArchive(): void;
}
export function InboxRowView({ row, active, later = false, pending, onSelect, onPark, onArchive }: InboxRowViewProps) {
  const actionSpace = row.status === "running" ? 0 : later ? 24 : 52;
  return <div className={`${styles.row} rounded-md border border-transparent ${active ? styles.selected : ""}`} data-session-inbox-row={row.key} data-session-path={row.path}>
    <UnstyledButton display="block" w="100%" px={10} py={8} style={{ borderRadius: "var(--mantine-radius-md)", textAlign: "left" }} aria-label={`${later ? "Resume" : "Open"} ${row.title}`}
      aria-current={active ? "true" : undefined} disabled={pending && (later || !row.sessionId)} onClick={onSelect}>
      <Group mb={4} wrap="nowrap" justify="space-between" gap={8}>
        <InboxStatus status={row.status} />
        <Text component="span" size="xs" c="dimmed" truncate miw={0} flex={1}>{row.project}</Text>
        {!later && row.modified !== undefined && <Text component="span" size="xs" c="dimmed" style={{ flexShrink: 0 }}>{relativeTime(row.modified)}</Text>}
      </Group>
      <Group wrap="nowrap" gap={8} pr={actionSpace}>
        <Text component="span" size="sm" truncate miw={0} flex={1} title={row.primaryLabel}>{row.primaryLabel}</Text>
        {later && <IconArrowUpRight size={14} className="shrink-0" />}
      </Group>
      {row.secondaryLabel && <Text size="xs" c="dimmed" truncate mt={4} pr={actionSpace} title={row.secondaryLabel}>{row.secondaryLabel}</Text>}
    </UnstyledButton>
    {row.status !== "running" && <div className={`${styles.actions} absolute right-1 top-7 flex items-center gap-0.5`}>
      {!later && <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Move ${row.title} to Later`} title="Move to Later"
        disabled={pending || row.status !== "idle" || !row.path} onClick={onPark}><IconClockPause size={15} /></ActionIcon>}
      <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Archive ${row.title}`} title="Archive session"
        disabled={pending || row.status !== "idle" || !row.path} onClick={onArchive}><IconArchive size={15} /></ActionIcon>
    </div>}
  </div>;
}
