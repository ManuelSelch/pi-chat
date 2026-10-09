import { ActionIcon, Group, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconArchive, IconArchiveOff } from "@tabler/icons-react";
import styles from "./SessionRow.module.css";
import { MANTINE_COLOR } from "../../ui/theme.js";
import type { ChatSessionSummary } from "../../../shared/protocol.js";

interface SessionRowProps {
  session: ChatSessionSummary;
  active: boolean;
  disabled: boolean;
  archiveDisabled?: boolean;
  onOpen: () => void;
  onArchive?: () => void;
}

function formatSessionDate(value: number): string {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function SessionRow({ session, active, disabled, archiveDisabled, onOpen, onArchive }: SessionRowProps) {
  const archived = session.archivedAt !== undefined;
  return (
    <div className={`${styles.row}${active ? ` ${styles.active}` : ""}`}>
      <UnstyledButton className={styles.content} disabled={disabled} aria-current={active ? "page" : undefined} onClick={onOpen}>
        <Text className={styles.title} fw={archived ? 500 : 600} size="sm" title={session.title}>{session.title}</Text>
        <Group className={styles.meta} gap={5} wrap="nowrap">
          <Text size="xs" c="dimmed">{archived ? "Archived " : ""}{formatSessionDate(session.archivedAt ?? session.modified)}</Text>
          <Text size="xs" c="dimmed" aria-hidden="true">·</Text>
          <Text size="xs" c="dimmed">{session.messageCount} messages</Text>
        </Group>
      </UnstyledButton>
      {onArchive ? <Tooltip label={archived ? "Restore session" : "Archive session"}>
        <ActionIcon className={styles.action} size="sm" variant="subtle" color={MANTINE_COLOR.neutral} disabled={archiveDisabled} aria-label={`${archived ? "Restore" : "Archive"} ${session.title}`} onClick={onArchive}>
          {archived ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
        </ActionIcon>
      </Tooltip> : null}
    </div>
  );
}
