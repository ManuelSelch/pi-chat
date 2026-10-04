import type { KeyboardEvent } from "react";
import { ActionIcon, Group, Text, Tooltip } from "@mantine/core";
import styles from "./SessionRow.module.css";
import { IconMessage, IconTrash } from "@tabler/icons-react";
import { MANTINE_COLOR } from "../../ui/theme.js";
import { StatusBadge } from "../../ui/StatusBadge.js";
import type { ChatSessionSummary } from "../../../shared/protocol.js";

interface SessionRowProps {
  session: ChatSessionSummary;
  active: boolean;
  disabled: boolean;
  deleteDisabled: boolean;
  onOpen: () => void;
  onDelete: () => void;
}

function formatSessionDate(value: string | number): string {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function SessionRow({ session, active, disabled, deleteDisabled, onOpen, onDelete }: SessionRowProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      className={`${styles.row}${active ? ` ${styles.active}` : ""}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-current={active ? "page" : undefined}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onOpen}
      onKeyDown={disabled ? undefined : handleKeyDown}
    >
      <div className={styles.content}>
        <Text className={styles.title} fw={600} size="sm" title={session.title}>
          {session.title}
        </Text>
        <Group className={styles.meta} gap={5} wrap="nowrap">
          <Text size="xs" c="dimmed">{formatSessionDate(session.modified)}</Text>
          <Text size="xs" c="dimmed" aria-hidden="true">·</Text>
          <Text size="xs" c="dimmed">{session.messageCount} messages</Text>
        </Group>
      </div>
      <Tooltip label="Delete session">
        <ActionIcon
          className={styles.delete}
          size="sm"
          variant="subtle"
          color={MANTINE_COLOR.neutral}
          disabled={deleteDisabled}
          aria-label={`Delete ${session.title}`}
          onClick={(event) => { event.stopPropagation(); onDelete(); }}
        >
          <IconTrash size={14} />
        </ActionIcon>
      </Tooltip>
    </div>
  );
}
