import { useState } from 'react';
import { ActionIcon, Button, Drawer, Text, TextInput, Title, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconFolder, IconHome, IconLayoutSidebar, IconPlus, IconSearch, IconSettings } from '@tabler/icons-react';
import { sessions as seed, type Session } from '../ui-directions/data';
import { SessionCard } from './SessionCard';

export function App() {
  const state = new URLSearchParams(location.search).get('state');
  const [sessions, setSessions] = useState(seed.filter(s => state === 'empty' ? false : state === 'running' ? s.status === 'working' : true));
  const [sidebar, setSidebar] = useState(true);
  const [laterOpen, setLaterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Session>();
  const [notice, setNotice] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const parked = sessions.filter(s => s.status === 'later');
  const matches = query.trim() ? sessions.filter(s => `${s.title} ${s.project} ${s.branch}`.toLowerCase().includes(query.toLowerCase())) : [];
  function open(s: Session) {
    if (s.status === 'later') setSessions(all => all.map(row => row.id === s.id ? { ...row, status: 'ready' } : row));
    setSelected(s);
  }
  function create() { setNotice('New session is simulated. Production keeps its existing creation flow.'); }
  const card = (s: Session) => <SessionCard key={s.id} session={s} onOpen={() => open(s)} onPark={() => setSessions(all => all.map(row => row.id === s.id ? { ...row, status: 'later' } : row))} onArchive={() => setSessions(all => all.filter(row => row.id !== s.id))}/>;
  return <div className={`mock-shell ${sidebar ? '' : 'sidebar-hidden'}`}>
    <header><ActionIcon variant="subtle" color="gray" aria-label="Toggle sidebar" onClick={() => setSidebar(value => !value)}><IconLayoutSidebar size={18}/></ActionIcon><Text size="xs" c="dimmed">Workspace</Text><IconChevronRight size={12}/><Text size="xs">Home</Text><div className="header-actions"><span className="mock-label">MOCKUP</span><ActionIcon variant="subtle" color="gray" aria-label="New session" onClick={create}><IconPlus size={19}/></ActionIcon></div></header>
    {sidebar && <aside><UnstyledButton className="home-navigation" display="flex" px={11} py={10} onClick={() => { setQuery(''); setSelected(undefined); }}><IconHome size={17}/>Home</UnstyledButton><Text size="10px" c="dimmed" tt="uppercase" lts="0.1em" px={10} mt={24} mb={12}>Projects</Text>{['pi-chat', 'pi-server'].map(project => <div key={project} className="project"><UnstyledButton display="flex" w="100%" py={8} className="project-heading" aria-expanded={!collapsed.includes(project)} onClick={() => setCollapsed(all => all.includes(project) ? all.filter(p => p !== project) : [...all, project])}><IconChevronRight size={12} className={collapsed.includes(project) ? '' : 'expanded'}/><IconFolder size={15}/><strong>{project}</strong></UnstyledButton>{!collapsed.includes(project) && sessions.filter(s => s.project === project && s.status !== 'later').map(s => <UnstyledButton key={s.id} className="sidebar-session" display="flex" w="100%" py={9} px={12} onClick={() => open(s)}><span className={`status ${s.status}`}/><span>{s.branch}</span></UnstyledButton>)}</div>)}<div className="sidebar-bottom"><ActionIcon variant="subtle" color="gray" aria-label="Settings" onClick={() => setNotice('Settings remains available here in production.')}><IconSettings size={19}/></ActionIcon></div></aside>}
    <main><div className="home-page"><section className="welcome"><Title order={1} size={32} fw={550}>Lets cook</Title><TextInput mt={22} size="md" leftSection={<IconSearch size={16}/>} aria-label="Search sessions and projects" placeholder="Search sessions and projects" value={query} onChange={event => setQuery(event.currentTarget.value)} onKeyDown={event => { if (event.key !== 'Enter') return; if (!query.trim()) create(); else if (matches[0]) open(matches[0]); }}/></section>
      {notice && <div className="notice"><Text size="xs">{notice}</Text><Button size="compact-xs" variant="subtle" onClick={() => setNotice('')}>Dismiss</Button></div>}
      {query.trim() ? <section className="activity"><Title order={2} size="xs" mb={12}>Search results</Title>{matches.length ? <div className="cards">{matches.map(card)}</div> : <Text size="sm" c="dimmed">No matching sessions</Text>}</section> : <div className="activity">{(['blocked', 'ready'] as const).map(status => {
        const rows = sessions.filter(s => s.status === status);
        if (!rows.length) return null;
        return <section key={status} className="activity-section"><Title order={2} size="xs" fw={600} mb={10}>{status === 'blocked' ? 'Blocked' : 'Ready'}</Title><div className="cards">{rows.map(card)}</div></section>;
      })}{!sessions.some(s => s.status === 'blocked' || s.status === 'ready') && <div className="caught-up"><Text size="sm" c="dimmed">Nothing waiting here. Start a session above.</Text></div>}{parked.length > 0 && <section className="activity-section"><UnstyledButton display="flex" py={10} className="later-toggle" aria-expanded={laterOpen} onClick={() => setLaterOpen(value => !value)}><IconChevronRight size={13} className={laterOpen ? 'expanded' : ''}/><Text size="xs">Later</Text><Text size="xs" c="dimmed">{parked.length}</Text></UnstyledButton>{laterOpen && <div className="cards">{parked.map(card)}</div>}</section>}</div>}
    </div></main>
    <Drawer opened={Boolean(selected)} onClose={() => setSelected(undefined)} title="Session destination (illustrative only)" position="right" size="lg"><Title order={2} size="lg">{selected?.title}</Title><Text c="dimmed" size="sm" mt="md">Clicking this row will open the existing full production session view. That screen is not being redesigned.</Text></Drawer>
  </div>;
}
