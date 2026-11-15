import { useState } from 'react';
import { ActionIcon, Button, Drawer, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { IconArchive, IconChevronRight, IconClockPause, IconFolder, IconLayoutSidebar, IconPlus, IconSearch, IconSettings, IconX } from '@tabler/icons-react';
import { sessions as seed, type Session } from '../ui-directions/data';
import { SessionCard } from './SessionCard';

export function App() {
  const state = new URLSearchParams(location.search).get('state');
  const [sessions, setSessions] = useState([...seed, { ...seed[1], id: 7, title: 'Review sidebar accessibility', time: '1h ago' }].filter(s => state === 'empty' ? false : state === 'running' ? s.status === 'working' : true));
  const [sidebar, setSidebar] = useState(true);
  const [laterOpen, setLaterOpen] = useState(false);
  const [workingOpen, setWorkingOpen] = useState(false);
  const [sidebarLaterOpen, setSidebarLaterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Session>();
  const [notice, setNotice] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const parked = sessions.filter(s => s.status === 'later');
  const working = sessions.filter(s => s.status === 'working');
  const matches = query.trim() ? sessions.filter(s => `${s.title} ${s.project} ${s.branch}`.toLowerCase().includes(query.toLowerCase())) : [];
  function open(s: Session) {
    if (s.status === 'later') setSessions(all => all.map(row => row.id === s.id ? { ...row, status: 'ready' } : row));
    setSelected(s);
  }
  function create() { setNotice('New session is simulated. Production keeps its existing creation flow.'); }
  const card = (s: Session) => <SessionCard key={s.id} session={s} onOpen={() => open(s)} onPark={() => setSessions(all => all.map(row => row.id === s.id ? { ...row, status: 'later' } : row))} onArchive={() => setSessions(all => all.filter(row => row.id !== s.id))}/>;
  const sidebarRow = (s: Session) => <div key={s.id} className="sidebar-row"><UnstyledButton className="sidebar-session" onClick={() => open(s)}><div className="sidebar-primary"><span className={`status ${s.status}`}/><span>{s.branch}</span></div>{sessions.filter(row => row.project === s.project && row.branch === s.branch && row.status !== 'later').length > 1 && <div className="sidebar-secondary">{s.title}</div>}</UnstyledButton>{s.status !== 'working' && <div className="sidebar-actions">{s.status !== 'later' && <ActionIcon size="sm" variant="subtle" color="gray" aria-label={`Move ${s.title} to Later`} disabled={s.status !== 'ready'} onClick={() => setSessions(all => all.map(row => row.id === s.id ? { ...row, status: 'later' } : row))}><IconClockPause size={15}/></ActionIcon>}<ActionIcon size="sm" variant="subtle" color="gray" aria-label={`Archive ${s.title}`} disabled={s.status === 'blocked'} onClick={() => setSessions(all => all.filter(row => row.id !== s.id))}><IconArchive size={15}/></ActionIcon></div>}</div>;
  return <div className={`mock-shell ${sidebar ? '' : 'sidebar-hidden'}`}>
    <header><ActionIcon variant="subtle" color="gray" aria-label="Toggle sidebar" onClick={() => setSidebar(value => !value)}><IconLayoutSidebar size={18}/></ActionIcon><Text size="xs" c="dimmed">Workspace</Text><IconChevronRight size={12}/><Text size="xs">Home</Text><div className="header-actions"><span className="mock-label">MOCKUP</span><ActionIcon variant="subtle" color="gray" aria-label="New session" onClick={create}><IconPlus size={19}/></ActionIcon></div></header>
    {sidebar && <aside><div className="sidebar-close"><ActionIcon variant="subtle" color="gray" aria-label="Close sessions" onClick={() => setSidebar(false)}><IconX size={18}/></ActionIcon></div><div className="sidebar-projects"><div className="sidebar-heading"><Text size="10px" c="dimmed" tt="uppercase" lts="0.1em">Projects</Text><Text size="10px" c="dimmed">{new Set(sessions.filter(s => s.status !== 'later').map(s => s.project)).size}</Text></div>{['pi-chat', 'pi-server'].map(project => { const rows = sessions.filter(s => s.project === project && s.status !== 'later'); if (!rows.length) return null; return <div key={project} className="project"><UnstyledButton display="flex" w="100%" py={8} className="project-heading" aria-expanded={!collapsed.includes(project)} onClick={() => setCollapsed(all => all.includes(project) ? all.filter(p => p !== project) : [...all, project])}><IconChevronRight size={12} className={collapsed.includes(project) ? '' : 'expanded'}/><IconFolder size={15}/><strong>{project}</strong></UnstyledButton>{!collapsed.includes(project) && rows.map(sidebarRow)}</div>; })}</div>{parked.length > 0 && <div className="sidebar-later"><UnstyledButton className="sidebar-later-toggle" aria-expanded={sidebarLaterOpen} onClick={() => setSidebarLaterOpen(value => !value)}><IconChevronRight size={14} className={sidebarLaterOpen ? 'expanded' : ''}/><IconClockPause size={14}/><Text size="xs" c="dimmed">Later</Text><Text size="xs" c="dimmed" ml="auto">{parked.length}</Text></UnstyledButton>{sidebarLaterOpen && parked.map(sidebarRow)}</div>}<div className="sidebar-bottom"><ActionIcon variant="subtle" color="gray" aria-label="Settings" onClick={() => setNotice('Settings remains available here in production.')}><IconSettings size={19}/></ActionIcon></div></aside>}
    <main><div className="home-page"><section className="welcome"><Title order={1} size={32} fw={550}>Lets cook</Title><TextInput mt={22} size="md" leftSection={<IconSearch size={16}/>} aria-label="Search sessions and projects" placeholder="Search sessions and projects" value={query} onChange={event => setQuery(event.currentTarget.value)} onKeyDown={event => { if (event.key !== 'Enter') return; if (!query.trim()) create(); else if (matches[0]) open(matches[0]); }}/></section>
      {notice && <div className="notice"><Text size="xs">{notice}</Text><Button size="compact-xs" variant="subtle" onClick={() => setNotice('')}>Dismiss</Button></div>}
      {query.trim() ? <section className="activity"><Title order={2} size="xs" mb={12}>Search results</Title>{matches.length ? <div className="cards">{matches.map(card)}</div> : <Text size="sm" c="dimmed">No matching sessions</Text>}</section> : <div className="activity">{(['blocked', 'ready'] as const).map(status => {
        const rows = sessions.filter(s => s.status === status);
        if (!rows.length) return null;
        return <section key={status} className="activity-section"><Title order={2} size="xs" fw={600} mb={10}>{status === 'blocked' ? 'Blocked' : 'Ready'}</Title><div className="cards">{rows.map(card)}</div></section>;
      })}{!sessions.some(s => s.status === 'blocked' || s.status === 'ready') && <div className="caught-up"><Text size="sm" c="dimmed">Nothing waiting here. Start a session above.</Text></div>}{working.length > 0 && <section className="activity-section"><UnstyledButton display="flex" py={10} className="later-toggle" aria-expanded={workingOpen} onClick={() => setWorkingOpen(value => !value)}><IconChevronRight size={13} className={workingOpen ? 'expanded' : ''}/><Text size="xs">Working</Text><Text size="xs" c="dimmed">{working.length}</Text></UnstyledButton>{workingOpen && <div className="cards">{working.map(card)}</div>}</section>}{parked.length > 0 && <section className="activity-section"><UnstyledButton display="flex" py={10} className="later-toggle" aria-expanded={laterOpen} onClick={() => setLaterOpen(value => !value)}><IconChevronRight size={13} className={laterOpen ? 'expanded' : ''}/><Text size="xs">Later</Text><Text size="xs" c="dimmed">{parked.length}</Text></UnstyledButton>{laterOpen && <div className="cards">{parked.map(card)}</div>}</section>}</div>}
    </div></main>
    <Drawer opened={Boolean(selected)} onClose={() => setSelected(undefined)} title="Session destination (illustrative only)" position="right" size="lg"><Title order={2} size="lg">{selected?.title}</Title><Text c="dimmed" size="sm" mt="md">Clicking this row will open the existing full production session view. That screen is not being redesigned.</Text></Drawer>
  </div>;
}
