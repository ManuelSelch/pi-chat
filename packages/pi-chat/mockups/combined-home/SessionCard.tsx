import { ActionIcon, Text, UnstyledButton } from '@mantine/core';
import { IconArchive, IconClockPause, IconGitBranch } from '@tabler/icons-react';
import type { Session } from '../ui-directions/data';

export function SessionCard({ session, onOpen, onPark, onArchive }: { session: Session; onOpen(): void; onPark(): void; onArchive(): void }) {
  return <article className="session-card">
    <UnstyledButton className="card-open" display="block" w="100%" px={18} py={14} onClick={onOpen} aria-label={`${session.status === 'later' ? 'Resume' : 'Open'} ${session.title}`}>
      <div className="card-identity"><span className={`status ${session.status}`}/><strong title={session.project}>{session.project}</strong><span className="branch" title={session.branch}><IconGitBranch size={14}/><strong>{session.branch}</strong></span></div>
      <Text size="xs" c="dimmed" truncate className="session-name">{session.title}</Text>
    </UnstyledButton>
    <div className="card-tools"><span>{session.time}</span>{session.status !== 'later' && <ActionIcon size={21} variant="subtle" color="gray" aria-label={`Move ${session.title} to Later`} disabled={session.status !== 'ready'} onClick={onPark}><IconClockPause size={14}/></ActionIcon>}<ActionIcon size={21} variant="subtle" color="gray" aria-label={`Archive ${session.title}`} disabled={session.status === 'blocked'} onClick={onArchive}><IconArchive size={14}/></ActionIcon></div>
  </article>;
}
