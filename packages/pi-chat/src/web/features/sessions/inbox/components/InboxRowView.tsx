import { ActionIcon, Group, Text, UnstyledButton } from "@mantine/core";
import { IconArchive, IconArrowUpRight, IconClockPause } from "@tabler/icons-react";
import type { InboxRow } from "../utils/inbox-model.js";
import { InboxStatus } from "./InboxStatus.js";
import styles from "./Inbox.module.css";
import { worktreeLabel } from "../../utils/worktree-label.js";

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
  return <div className={`${styles.row} rounded-md border border-transparent ${active ? styles.selected : ""}`} data-session-inbox-row={row.key} data-session-path={row.path} data-later={later || undefined}>
    <UnstyledButton display="block" w="100%" px={10} py={8} style={{ borderRadius: "var(--mantine-radius-md)", textAlign: "left" }} aria-label={`${later ? "Resume" : "Open"} ${row.title}`}
      aria-current={active ? "true" : undefined} disabled={pending && (later || !row.sessionId)} onClick={onSelect}>
      {later && <Text component="span" display="block" size="xs" c="dimmed" truncate mb={4}>{row.project}</Text>}
      <Group className={styles.primary} wrap="nowrap" gap={8}>
        <InboxStatus status={row.status} later={later} />
        <Text component="span" size="sm" truncate miw={0} flex={1}>{row.primaryLabel === row.branch ? worktreeLabel(row.primaryLabel) : row.primaryLabel}</Text>
        {later && <IconArrowUpRight size={14} className="shrink-0" />}
      </Group>
      {row.secondaryLabel && <Text size="xs" c="dimmed" truncate mt={4} pl={14}>{row.secondaryLabel}</Text>}
    </UnstyledButton>
    {row.status !== "running" && <div className={`${styles.actions} flex items-center gap-0.5`}>
      {!later && <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Move ${row.title} to Later`}
        disabled={pending || row.status !== "idle" || !row.path} onClick={onPark}><IconClockPause size={15} /></ActionIcon>}
      <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Archive ${row.title}`}
        disabled={pending || row.status !== "idle" || !row.path} onClick={onArchive}><IconArchive size={15} /></ActionIcon>
    </div>}
  </div>;
}
