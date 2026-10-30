import { ActionIcon, Text, UnstyledButton } from "@mantine/core";
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
  return <div className={`${styles.row} rounded-md border border-transparent ${active ? styles.selected : ""}`} data-session-inbox-row={row.key} data-session-path={row.path}>
    <UnstyledButton className="block w-full rounded-md px-2.5 py-2 text-left" aria-label={`${later ? "Resume" : "Open"} ${row.title}`}
      aria-current={active ? "true" : undefined} disabled={pending && later} onClick={onSelect}>
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
        <Text component="span" size="xs" c="dimmed" truncate>{row.project}</Text>
        {!later && row.modified !== undefined && <Text component="span" size="xs" c="dimmed" className="shrink-0">{relativeTime(row.modified)}</Text>}
      </div>
      <div className="flex min-w-0 items-center gap-2 pr-12">
        {!later && <InboxStatus status={row.status} />}
        <Text component="span" size="sm" truncate>{row.title}</Text>
        {later && <IconArrowUpRight size={14} className="shrink-0" />}
      </div>
      {!later && row.status === "idle" && row.branch && <Text size="xs" c="dimmed" truncate className="mt-1 pl-3.5">{row.branch}</Text>}
    </UnstyledButton>
    <div className={`${styles.actions} absolute right-1 top-7 flex items-center gap-0.5`}>
      {!later && <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Move ${row.title} to Later`} title="Move to Later"
        disabled={pending || row.status !== "idle" || !row.path} onClick={onPark}><IconClockPause size={15} /></ActionIcon>}
      <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`Archive ${row.title}`} title="Archive session"
        disabled={pending || row.status !== "idle" || !row.path} onClick={onArchive}><IconArchive size={15} /></ActionIcon>
    </div>
  </div>;
}
