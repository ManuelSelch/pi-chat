import { useState } from 'react';
import { ActionIcon, Button, TextInput, UnstyledButton } from '@mantine/core';
import { IconArrowUpRight, IconClockPause, IconChevronDown, IconChevronRight, IconFolder, IconInbox, IconMessage, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { statusLabels, type Concept, type Session } from './data';

interface Props {
  concept: Concept; sessions: Session[]; active: string; sidebarMode: boolean;
  choose: (id: string) => void; deferSession: (id: string) => void;
  restore: (id: string) => void; create: (project?: string) => void; close: () => void;
}
function SessionRow({ session, active, choose, deferSession, compact = false }: { session: Session; active: string; choose: Props['choose']; deferSession: Props['deferSession']; compact?: boolean }) {
  return <div className={`session-item ${active === session.id ? 'selected' : ''} ${compact ? 'compact' : ''}`}>
    <UnstyledButton className="session-main" onClick={() => choose(session.id)} aria-current={active === session.id ? 'page' : undefined}>
      {!compact && <div className="session-context"><span>{session.project}</span><span>{session.time}</span></div>}
      <div className="session-title"><span className={`dot ${session.status}`} aria-label={statusLabels[session.status]} /><span>{session.title}</span></div>
      {!compact && session.status === 'ready' && <div className="session-detail">{session.branch || 'Personal conversation'}</div>}
    </UnstyledButton>
    <ActionIcon className="later-action" size="sm" variant="subtle" color="gray" aria-label={`Move ${session.title} to Later`} title={session.status === 'working' ? 'Wait for the run to finish' : 'Move to Later · not archived'} disabled={session.status === 'working'} onClick={() => deferSession(session.id)}><IconClockPause size={15}/></ActionIcon>
  </div>;
}
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <section className="session-section"><div className="section-label"><span>{title}</span><span>{count}</span></div>{children}</section>;
}
export function Sidebar(props: Props) {
  const { concept, sessions, active, choose, deferSession, restore, create, close, sidebarMode } = props;
  const [query, setQuery] = useState('');
  const [laterOpen, setLaterOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const open = sessions.filter(s => !s.later);
  const matches = (s: Session) => `${s.title} ${s.project} ${s.branch}`.toLowerCase().includes(query.toLowerCase());
  const visible = open.filter(matches);
  const later = sessions.filter(s => s.later);
  const visibleLater = later.filter(matches);
  const row = (session: Session, compact = false) => <SessionRow key={session.id} session={session} active={active} choose={choose} deferSession={deferSession} compact={compact}/>;
  const projects = [...new Set(['Quick Chats', 'pi-chat', 'pi-studio', 'notesToGo', ...open.map(s => s.project)])];
  return <aside className="sidebar" aria-label="Session navigation">
    <div className="sidebar-heading"><div><IconInbox size={18}/><strong>{!sidebarMode ? 'Projects' : concept === 'a' ? 'Open sessions' : 'Inbox'}</strong><span className="count">{open.length}</span></div><ActionIcon variant="subtle" color="gray" aria-label="Close sidebar" onClick={close}><IconX size={17}/></ActionIcon></div>
    <Button variant="default" fullWidth leftSection={<IconPlus size={15}/>} onClick={() => create()}>New session</Button>
    <TextInput className="session-search" aria-label="Search sessions" placeholder="Find a session…" size="xs" leftSection={<IconSearch size={14}/>} value={query} onChange={e => setQuery(e.currentTarget.value)}/>
    <div className="sidebar-scroll">
      {!sidebarMode ? <><div className="sidebar-note">Open sessions appear in the tab bar.</div>{projects.map(project => <UnstyledButton key={project} className="project-line" onClick={() => choose(open.find(s => s.project === project)?.id ?? active)}><IconFolder size={15}/>{project}<span className="count">{open.filter(s => s.project === project).length}</span></UnstyledButton>)}</> : <>
        {concept === 'a' && <Section title="Open" count={visible.length}>{visible.map(s => row(s))}</Section>}
        {concept === 'b' && (['attention', 'working', 'ready'] as const).map(status => <Section key={status} title={statusLabels[status]} count={visible.filter(s => s.status === status).length}>
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
      {sidebarMode && <><UnstyledButton className="footer-link" aria-expanded={projectsOpen} onClick={() => setProjectsOpen(v => !v)}>{projectsOpen ? <IconChevronDown size={14}/> : <IconChevronRight size={14}/>}Browse projects<IconFolder size={14}/></UnstyledButton>{projectsOpen && <div className="project-chips">{projects.map(project => <UnstyledButton key={project} title={`Start session in ${project}`} onClick={() => create(project)}>{project === 'Quick Chats' ? <IconMessage size={12}/> : <IconFolder size={12}/>} {project}<IconPlus size={12}/></UnstyledButton>)}</div>}</>}
      <div className="sidebar-note">{sidebarMode ? 'Later is for “not now”. Archive is for finished work.' : 'Mockup · local data only'}</div>
    </div>
  </aside>;
}
