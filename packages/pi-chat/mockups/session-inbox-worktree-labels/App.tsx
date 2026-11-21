import { useState } from 'react';
import { ActionIcon, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconArchive, IconClockPause } from '@tabler/icons-react';

const rows = [
  { id: 'linked', project: 'CSMM-Studiopilot-WS26', branch: 'feature/csmm-6-setup-shadcn', title: 'Set up shadcn components and configure the application theme', linked: true, section: 'Ready' },
  { id: 'linked-second', project: 'CSMM-Studiopilot-WS26', branch: 'feature/csmm-6-setup-shadcn', title: 'Review the component setup and accessibility checks', linked: true, section: 'Ready' },
  { id: 'primary', project: 'pi-chat', branch: 'main', title: 'Composer focus restoration', linked: false, section: 'Ready' },
  { id: 'quick', project: 'Quick Chats', branch: '', title: 'A quick question about Swift', linked: false, section: 'Ready' },
  { id: 'working', project: 'notesToGo', branch: 'feat/pdf-previews', title: 'Generate thumbnails for uploaded PDF documents', linked: true, section: 'Working' },
  { id: 'later', project: 'pi-studio', branch: 'fix/workspace-selection', title: 'Keep the selected workspace after reopening the app', linked: true, section: 'Later' },
];
function SessionRow({ row, selected, onSelect }: { row: typeof rows[number]; selected: boolean; onSelect(): void }) {
  const primary = row.linked ? row.branch : row.title;
  const secondary = row.linked && row.title !== row.branch ? row.title : undefined;
  return <div className={`row ${selected ? 'selected' : ''}`}>
    <UnstyledButton display="block" w="100%" px={10} py={8} onClick={onSelect} aria-current={selected ? 'true' : undefined}>
      <Group gap={8} wrap="nowrap" mb={4}>
        <span className="dot" aria-label={row.section} role="img" style={{ background: row.section === 'Working' ? '#fab005' : '#40c057' }} />
        <Text size="xs" c="dimmed" truncate flex={1} miw={0}>{row.project}</Text>
        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>24m</Text>
      </Group>
      <Group wrap="nowrap" gap={8} pr={row.section === 'Working' ? 0 : 52}>
        <Text size="sm" truncate flex={1} miw={0} title={primary}>{primary}</Text>
      </Group>
      {secondary && <Text size="xs" c="dimmed" truncate pr={row.section === 'Working' ? 0 : 52} mt={4} title={secondary}>{secondary}</Text>}
    </UnstyledButton>
    {row.section !== 'Working' && <Group className="actions" gap={2} wrap="nowrap">
      <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Move to Later"><IconClockPause size={15}/></ActionIcon>
      <ActionIcon size="sm" variant="subtle" color="gray" aria-label="Archive"><IconArchive size={15}/></ActionIcon>
    </Group>}
  </div>;
}
export function App() {
  const [active, setActive] = useState('linked');
  return <main className="review">
    <Stack gap={8} mb="lg">
      <Text fw={600}>Worktree-first session labels</Text>
      <Text size="sm" c="dimmed">Linked worktrees: branch prominent, conversation title below. Main checkout and Quick Chats: conversation title stays prominent.</Text>
    </Stack>
    <nav aria-label="Session label preview" className="panel">
      {['Ready', 'Working', 'Later'].map(section => <section key={section}>
        <Text size="xs" c="dimmed" pl={2} pr={10} py={8}>{section}</Text>
        {rows.filter(row => row.section === section).map(row => <SessionRow key={row.id} row={row} selected={active === row.id} onSelect={() => setActive(row.id)}/>)}
      </section>)}
    </nav>
    <Text size="xs" c="dimmed" mt="md">Local mockup · click rows to select · actions are illustrative · Later expanded for comparison</Text>
  </main>;
}
