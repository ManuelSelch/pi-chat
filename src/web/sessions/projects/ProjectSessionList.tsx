import { Group, Stack, Text } from "@mantine/core";
import { IconArchive, IconChevronRight } from "@tabler/icons-react";
import type { ChatProjectSummary, ChatSessionSummary } from "../../../shared/protocol.js";
import { StatusBadge } from "../../ui/StatusBadge.js";
import { SessionRow } from "./SessionRow.js";
import styles from "./ProjectSessionList.module.css";

interface Props {
  project: ChatProjectSummary;
  currentSessionId: string;
  busySessionIds: readonly string[];
  pending: boolean;
  openSession: (path: string) => void;
  onArchive?: (session: ChatSessionSummary, archived: boolean) => void;
}

export function ProjectSessionList({ project, currentSessionId, busySessionIds, pending, openSession, onDelete, onArchive }: Props) {
  const active = project.sessions.filter(session => session.archivedAt === undefined);
  const archived = project.sessions.filter(session => session.archivedAt !== undefined).sort((a, b) => b.archivedAt! - a.archivedAt! || a.path.localeCompare(b.path));
  const row = (session: ChatSessionSummary) => (
    <SessionRow key={session.path} session={session} active={session.id === currentSessionId} disabled={!project.exists}
      archiveDisabled={pending || busySessionIds.includes(session.id)}
      onOpen={() => openSession(session.path)}
      onArchive={onArchive ? () => onArchive(session, session.archivedAt === undefined) : undefined} />
  );
  return <>
    <Group gap={6} mt="sm"><Text size="xs" c="dimmed" fw={600}>Active</Text><StatusBadge>{active.length}</StatusBadge></Group>
    {active.length ? <Stack gap={3}>{active.map(row)}</Stack> : <Text c="dimmed" size="sm">No active sessions in this checkout.</Text>}
    <details className={styles.archive} key={project.path}>
      <summary className={styles.summary}>
        <IconChevronRight size={14} className={styles.chevron} /><IconArchive size={14} />
        <Text component="span" size="xs" fw={500}>Archived</Text>
        <span className={styles.count}><StatusBadge>{archived.length}</StatusBadge></span>
      </summary>
      <Text size="xs" c="dimmed" px={7} mb="xs">Finished work, kept for later.</Text>
      {archived.length ? <Stack gap={3}>{archived.map(row)}</Stack> : <Text size="sm" c="dimmed" px={7}>No archived sessions yet.</Text>}
    </details>
  </>;
}
