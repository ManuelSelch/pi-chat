import { ActionIcon, Text, UnstyledButton } from "@mantine/core";
import { IconArchive, IconClockPause, IconGitBranch } from "@tabler/icons-react";
import type { InboxRow } from "../utils/inbox-model.js";
import { relativeTime } from "../../../../utils/relative-time.js";
import { InboxStatus } from "./InboxStatus.js";
import styles from "./InboxPage.module.css";

interface InboxCardProps {
  row: InboxRow; later: boolean; pending: boolean;
  onOpen(): void; onPark(): void; onArchive(): void;
}
export function InboxCard({ row, later, pending, onOpen, onPark, onArchive }: InboxCardProps) {
  const canMutate = !pending && row.status === "idle" && Boolean(row.path);
  return <div className={styles.card}>
    <UnstyledButton className={styles.open} display="block" w="100%" px={18} py={14} disabled={pending && !row.sessionId}
      aria-label={`${later ? "Resume" : "Open"} ${row.title}`} onClick={onOpen}>
      <div className={styles.title}>
        <InboxStatus status={row.status} later={later} />
        <Text component="span" size="sm" fw={600} truncate title={row.project}>{row.project}</Text>
        {row.branch && <span className={styles.branch} title={row.branch}><IconGitBranch size={14} /><Text component="span" size="sm" fw={600} truncate>{row.branch}</Text></span>}
      </div>
      <Text size="xs" c="dimmed" truncate className={styles.sessionName} title={row.title}>{row.title}</Text>
    </UnstyledButton>
    <div className={styles.tools}>
      {row.modified !== undefined && <Text size="10px" c="dimmed" className={styles.time}>{relativeTime(row.modified).replace(/ ago$/, "")}</Text>}
      {!later && row.status !== "running" && <ActionIcon size={21} variant="subtle" color="gray" aria-label={`Move ${row.title} to Later`} title="Move to Later" disabled={!canMutate} onClick={onPark}><IconClockPause size={14} /></ActionIcon>}
      {row.status !== "running" && <ActionIcon size={21} variant="subtle" color="gray" aria-label={`Archive ${row.title}`} title="Archive session" disabled={!canMutate} onClick={onArchive}><IconArchive size={14} /></ActionIcon>}
    </div>
  </div>;
}
