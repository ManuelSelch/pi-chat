import { useState } from 'react';
import { ActionIcon, TextInput, UnstyledButton } from '@mantine/core';
import { IconArchive, IconArrowUpRight, IconClockPause, IconChevronDown, IconChevronRight, IconFolder, IconSearch, IconSettings, IconX } from '@tabler/icons-react';
import { statusLabels, type Concept, type Session } from './data';

interface Props {
  concept: Concept; sessions: Session[]; active: string; sidebarMode: boolean;
  choose: (id: string) => void; deferSession: (id: string) => void; archiveSession: (id: string) => void;
  restore: (id: string) => void; close: () => void; openSettings: () => void;
}
function SessionRow({ session, active, choose, deferSession, archiveSession, compact = false }: { session: Session; active: string; choose: Props['choose']; deferSession: Props['deferSession']; archiveSession: Props['archiveSession']; compact?: boolean }) {
  return <div className={`session-item ${active === session.id ? 'selected' : ''} ${compact ? 'compact' : ''}`}>
    <UnstyledButton className="session-main" onClick={() => choose(session.id)} aria-current={active === session.id ? 'page' : undefined}>
      {!compact && <div className="session-context"><span>{session.project}</span><span>{session.time}</span></div>}
      <div className="session-title"><span className={`dot ${session.status}`} aria-label={statusLabels[session.status]} /><span>{session.title}</span></div>
      {!compact && session.status === 'ready' && session.branch && <div className="session-detail">{session.branch}</div>}
    </UnstyledButton>
    <div className="session-row-actions"><ActionIcon size="sm" variant="subtle" color="gray" aria-label={`Move ${session.title} to Later`} title={session.status === 'working' ? 'Wait for the run to finish' : 'Move to Later · not archived'} disabled={session.status === 'working'} onClick={() => deferSession(session.id)}><IconClockPause size={15}/></ActionIcon><ActionIcon size="sm" variant="subtle" color="gray" aria-label={`Archive ${session.title}`} title={session.status === 'working' ? 'Wait for the run to finish' : 'Archive session'} disabled={session.status === 'working'} onClick={() => archiveSession(session.id)}><IconArchive size={15}/></ActionIcon></div>
  </div>;
}
function Section({ title, count, children, collapsible = false }: { title: string; count: number; children: React.ReactNode; collapsible?: boolean }) {
  const [expanded, setExpanded] = useState(true);
  return <section className="session-section">
    {collapsible ? <UnstyledButton className="section-label section-toggle" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><span>{expanded ? <IconChevronDown size={12}/> : <IconChevronRight size={12}/>} {title}</span><span>{count}</span></UnstyledButton> : <div className="section-label"><span>{title}</span><span>{count}</span></div>}
    {(!collapsible || expanded) && children}
  </section>;
}
export function Sidebar(props: Props) {
  const { concept, sessions, active, choose, deferSession, archiveSession, restore, close, sidebarMode, openSettings } = props;
  const [query, setQuery] = useState('');
  const [laterOpen, setLaterOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const open = sessions.filter(s => !s.later && !s.archived);
  const matches = (s: Session) => `${s.title} ${s.project} ${s.branch}`.toLowerCase().includes(query.toLowerCase());
  const visible = open.filter(matches);
  const later = sessions.filter(s => s.later && !s.archived);
  const visibleLater = later.filter(matches);
  const row = (session: Session, compact = false) => <SessionRow key={session.id} session={session} active={active} choose={choose} deferSession={deferSession} archiveSession={archiveSession} compact={compact}/>;
  const projects = [...new Set(['Quick Chats', 'pi-chat', 'pi-studio', 'notesToGo', ...open.map(s => s.project)])];
  return <aside className="sidebar" aria-label="Session navigation">
    <div className="sidebar-heading"><ActionIcon variant="subtle" color="gray" aria-label="Close sidebar" onClick={close}><IconX size={17}/></ActionIcon></div>
    <TextInput className="session-search" aria-label="Search sessions" placeholder="Find a session…" size="xs" leftSection={<IconSearch size={14}/>} value={query} onChange={e => setQuery(e.currentTarget.value)}/>
    <div className="sidebar-scroll">
      {!sidebarMode ? <><div className="sidebar-note">Open sessions appear in the tab bar.</div>{projects.map(project => <UnstyledButton key={project} className="project-line" onClick={() => choose(open.find(s => s.project === project)?.id ?? active)}><IconFolder size={15}/>{project}<span className="count">{open.filter(s => s.project === project).length}</span></UnstyledButton>)}</> : <>
        {concept === 'a' && <Section title="Open" count={visible.length}>{visible.map(s => row(s))}</Section>}
        {concept === 'b' && (['attention', 'ready', 'working'] as const).map(status => <Section key={status} title={statusLabels[status]} count={visible.filter(s => s.status === status).length} collapsible={status === 'working'}>
          {visible.filter(s => s.status === status).map(s => row(s))}
          {!visible.some(s => s.status === status) && <div className="section-empty">{status === 'attention' ? 'All caught up.' : 'Nothing here.'}</div>}
        </Section>)}
        {concept === 'c' && <>
          <Section title="Needs you" count={visible.filter(s => s.status === 'attention').length}>{visible.filter(s => s.status === 'attention').map(s => row(s))}{!visible.some(s => s.status === 'attention') && <div className="section-empty">All caught up.</div>}</Section>
          <div className="section-label"><span>Open by project</span><span>{visible.filter(s => s.status !== 'attention').length}</span></div>
          {projects.map(project => {
            const list = visible.filter(s => s.project === project && s.status !== 'attention');
            if (!list.length) return null;
            return <div className="project-group" key={project}><UnstyledButton className="project-line" aria-expanded={!collapsed[project]} onClick={() => setCollapsed(old => ({ ...old, [project]: !old[project] }))}>{collapsed[project] ? <IconChevronRight size={12}/> : <IconChevronDown size={12}/>}<IconFolder size={15}/><span>{project}</span><span className="count">{list.length}</span></UnstyledButton>{!collapsed[project] && list.map(s => row(s, true))}</div>;
          })}
          <p className="sidebar-note">Sessions needing you move to the shelf above—never shown twice.</p>
        </>}
        {query && !visible.length && <div className="section-empty">No open sessions match.</div>}
        {!open.length && <div className="inbox-zero"><IconClockPause size={28}/><strong>Inbox clear</strong><span>Pick something up from Later when you’re ready.</span></div>}
      </>}
    </div>
    <div className="sidebar-footer">
      <UnstyledButton className="footer-link" aria-expanded={laterOpen} onClick={() => setLaterOpen(v => !v)}>{laterOpen ? <IconChevronDown size={14}/> : <IconChevronRight size={14}/>}<IconClockPause size={14}/>Later<span className="count">{query ? visibleLater.length : later.length}</span></UnstyledButton>
      {laterOpen && <div className="later-list">{!visibleLater.length && <p className="sidebar-note">{query ? 'No Later sessions match.' : 'Move a session to Later when you want to come back to it.'}</p>}{visibleLater.map(s => <UnstyledButton className="later-row" key={s.id} onClick={() => restore(s.id)} aria-label={`Resume ${s.title}`} title="Resume in Inbox"><span><span className="later-project">{s.project}</span><span className="later-title">{s.title}</span></span><IconArrowUpRight size={15}/></UnstyledButton>)}</div>}
    </div>
    <div className="sidebar-bottom"><ActionIcon variant="subtle" color="gray" aria-label="Settings" title="Settings" onClick={openSettings}><IconSettings size={19}/></ActionIcon></div>
  </aside>;
}
