import { ActionIcon, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { IconArchive, IconArchiveOff, IconGitBranch } from "@tabler/icons-react";
import styles from "./SessionRow.module.css";
import { MANTINE_COLOR } from "../../ui/theme.js";
import type { ChatSessionSummary } from "../../../shared/protocol.js";

interface SessionRowProps {
  session: ChatSessionSummary;
  /** Worktree name shown instead of the session title when it is the only
   *  session in that worktree. */
  label?: string;
  active: boolean;
  disabled: boolean;
  archiveDisabled?: boolean;
  onOpen: () => void;
  onArchive?: () => void;
}

export function SessionRow({ session, label, active, disabled, archiveDisabled, onOpen, onArchive }: SessionRowProps) {
  const archived = session.archivedAt !== undefined;
  return (
    <div className={`${styles.row}${active ? ` ${styles.active}` : ""}`}>
      <UnstyledButton className={styles.content} disabled={disabled} aria-current={active ? "page" : undefined} onClick={onOpen} title={session.title}>
        <Text className={styles.title} fw={archived ? 400 : 500} size="sm">
          {label ? <><IconGitBranch size={12} className={styles.branch} />{label}</> : session.title}
        </Text>
      </UnstyledButton>
      {onArchive ? <Tooltip label={archived ? "Restore session" : "Archive session"}>
        <ActionIcon className={styles.action} size="sm" variant="subtle" color={MANTINE_COLOR.neutral} disabled={archiveDisabled} aria-label={`${archived ? "Restore" : "Archive"} ${session.title}`} onClick={onArchive}>
          {archived ? <IconArchiveOff size={14} /> : <IconArchive size={14} />}
        </ActionIcon>
      </Tooltip> : null}
    </div>
  );
}
