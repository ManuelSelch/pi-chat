import { useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { ActionIcon, Badge, Button, Drawer, Group, SegmentedControl, Stack, Switch, Text, Textarea, UnstyledButton } from '@mantine/core';
import { IconArchive, IconArrowUp, IconCheck, IconClockPause, IconChevronRight, IconGitBranch, IconLayoutSidebar, IconPlayerPlay, IconPlus, IconX } from '@tabler/icons-react';
import { Sidebar } from './Sidebar';
import { concepts, initialSessions, statusLabels, type Concept, type Session } from './data';

export function App() {
  const mobile = useMediaQuery('(max-width: 760px)');
  const params = new URLSearchParams(location.search);
  const initialConcept = params.get('concept');
  const [concept, setConcept] = useState<Concept>(initialConcept === 'a' || initialConcept === 'c' ? initialConcept : 'b');
  const empty = params.get('state') === 'empty';
  const [sessions, setSessions] = useState<Session[]>(() => initialSessions.map(s => ({ ...s, later: empty || s.later })));
  const [active, setActive] = useState(empty ? '' : 'inbox');
  const [sidebarMode, setSidebarMode] = useState(params.get('tabs') !== 'true');
  const [panelOpen, setPanelOpen] = useState(true);
  const [settings, setSettings] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState('');
  const [lastArchived, setLastArchived] = useState<string | null>(null);
  const open = sessions.filter(s => !s.later && !s.archived);
  const session = sessions.find(s => s.id === active && !s.later && !s.archived);
  function changeConcept(value: string) {
    const next = value as Concept;
    setConcept(next);
    const url = new URL(location.href); url.searchParams.set('concept', next); history.replaceState(null, '', url);
  }
  function choose(id: string) { setActive(id); setNotice(''); }
  function deferSession(id: string) {
    const item = sessions.find(s => s.id === id);
    if (!item || item.status === 'working') return;
    setSessions(old => old.map(s => s.id === id ? { ...s, later: true } : s));
    if (id === active) setActive(open.find(s => s.id !== id)?.id ?? '');
    setNotice(`“${item.title}” moved to Later. Expand Later to pick it up again.`);
  }
  function archiveSession(id: string) {
    const item = sessions.find(s => s.id === id);
    if (!item || item.status === 'working') return;
    setSessions(old => old.map(s => s.id === id ? { ...s, archived: true, later: false } : s));
    if (id === active) setActive(open.find(s => s.id !== id)?.id ?? '');
    setLastArchived(id);
    setNotice(`“${item.title}” archived. It is no longer in your Inbox or Later; the conversation is kept.`);
  }
  function undoArchive() {
    if (!lastArchived) return;
    setSessions(old => old.map(s => s.id === lastArchived ? { ...s, archived: false } : s));
    setActive(lastArchived); setLastArchived(null); setNotice('Session restored to Inbox.');
  }
  function restore(id: string) {
    setSessions(old => old.map(s => s.id === id ? { ...s, later: false } : s)); setActive(id); setNotice('Session returned to your open queue.');
  }
  function create(project = session?.project ?? 'Quick Chats') {
    const id = `draft-${Date.now()}`;
    setSessions(old => [{ id, title: 'New session', project, branch: project === 'Quick Chats' ? '' : 'main', status: 'ready', detail: 'Ready to continue', time: 'now' }, ...old]);
    setActive(id); setNotice('New local session. No agent or backend is connected.');
  }
  function send() {
    if (!session || !drafts[session.id]?.trim()) return;
    const value = drafts[session.id].trim();
    setMessages(old => ({ ...old, [session.id]: [...(old[session.id] ?? []), value] }));
    setDrafts(old => ({ ...old, [session.id]: '' }));
    setSessions(old => old.map(s => s.id === session.id ? { ...s, status: 'working', detail: 'Working on your message', time: 'now' } : s));
  }
  function finish() {
    if (!session) return;
    setSessions(old => old.map(s => s.id === session.id ? { ...s, status: 'attention', detail: 'Response ready for your review', time: 'now' } : s));
    setNotice('Simulated agent completion. The session now needs you.');
  }
  function reset() { setSessions(initialSessions.map(s => ({ ...s }))); setActive('inbox'); setDrafts({}); setMessages({}); setNotice(''); setLastArchived(null); }
  const sidebar = <Sidebar concept={concept} sessions={sessions} active={active} sidebarMode={sidebarMode} choose={choose} deferSession={deferSession} archiveSession={archiveSession} restore={restore} close={() => setPanelOpen(false)} openSettings={() => { if (mobile) setPanelOpen(false); setSettings(true); }}/>;
  return <div className="review-page">
    <div className="review-toolbar"><div className="review-brand"><span className="eyebrow">PI CHAT / DESIGN STUDY 01</span><strong>Sessions, without tabs</strong></div><SegmentedControl aria-label="Mockup concept" value={concept} onChange={changeConcept} data={Object.entries(concepts).map(([value, c]) => ({ value, label: c.label }))}/><Button size="xs" variant="subtle" color="gray" onClick={reset}>Reset demo</Button></div>
    <div className="concept-caption"><span>{concepts[concept].title}</span><p>{concepts[concept].description}</p><Badge variant="light" color={concept === 'b' ? 'blue' : 'gray'} size="sm">{concept === 'b' ? 'Recommended starting point' : 'Alternative direction'}</Badge></div>
    <div className={`app-shell ${panelOpen ? 'panel-open' : ''} ${!sidebarMode ? 'has-tabs' : ''}`}>
      <header className="app-header"><Group gap={10}><ActionIcon variant="subtle" color="gray" aria-label="Toggle sidebar" aria-expanded={panelOpen} onClick={() => setPanelOpen(v => !v)}><IconLayoutSidebar size={19}/></ActionIcon><strong>Pi Chat</strong></Group><div className="breadcrumb"><span>{session?.project ?? 'Workspace'}</span><IconChevronRight size={12}/><span title={session?.title}>{session?.title ?? (open.length ? 'Select a session' : 'Inbox clear')}</span></div>{session && <div className="header-session-info">{session.branch && <span className="header-branch" title={`Branch: ${session.branch}`}><IconGitBranch size={13}/><span>{session.branch}</span></span>}<span className="header-status" title={statusLabels[session.status]}><span className={`dot ${session.status}`}/><span>{statusLabels[session.status]}</span></span><ActionIcon variant="subtle" color="gray" aria-label="Move current session to Later" title="Move to Later" disabled={session.status === 'working'} onClick={() => deferSession(session.id)}><IconClockPause size={17}/></ActionIcon><ActionIcon variant="subtle" color="gray" aria-label="Archive current session" title="Archive session" disabled={session.status === 'working'} onClick={() => archiveSession(session.id)}><IconArchive size={17}/></ActionIcon><ActionIcon variant="subtle" color="gray" aria-label="Close current session view" title="Close view · keep in Inbox" onClick={() => { setActive(''); setNotice(''); }}><IconX size={17}/></ActionIcon></div>}<ActionIcon variant="subtle" color="gray" aria-label="New session" title="New session" onClick={() => create()}><IconPlus size={19}/></ActionIcon></header>
      {!sidebarMode && <div className="tabs" aria-label="Open session tabs">{open.map(s => <div className={`tab ${s.id === active ? 'active-tab' : ''}`} key={s.id}><UnstyledButton onClick={() => choose(s.id)}><span className={`dot ${s.status}`}/>{s.title}</UnstyledButton><ActionIcon size="xs" variant="subtle" color="gray" aria-label={`Close ${s.title}`} disabled={s.status === 'working'} onClick={() => deferSession(s.id)}><IconX size={12}/></ActionIcon></div>)}</div>}
      {panelOpen && <div className="desktop-sidebar">{sidebar}</div>}
      {mobile && <Drawer className="mobile-navigation" opened={panelOpen} onClose={() => setPanelOpen(false)} withCloseButton={false} padding={0} size={320} aria-label="Sessions">{sidebar}</Drawer>}
      <main className="workspace">
        <div className="conversation-scroll"><div className="conversation">
          {notice && <div className="notice" role="status">{notice}{lastArchived && <Button size="compact-xs" variant="subtle" ml="xs" onClick={undoArchive}>Undo archive</Button>}</div>}
          {!session ? <div className="empty-conversation">{open.length ? <IconLayoutSidebar size={38}/> : <IconCheck size={38}/>}<h2>{open.length ? 'Choose a session.' : "You’re all caught up."}</h2><p>{open.length ? 'Your sessions are still in the sidebar. Select one to continue; drafts and run states are unchanged.' : 'Your parked conversations are waiting in Later. Expand it to resume one, or start something new.'}</p><Button variant="light" onClick={() => create()}>New session</Button></div> : <>
            <div className="user-message">{session.id === 'inbox' ? 'I want to hide the tabs and manage my open sessions in the sidebar. Something that feels like an inbox.' : session.id === 'pdf' ? 'Help me improve the PDF thumbnail rendering. Let’s decide on a fallback first.' : `Let’s continue with ${session.title.toLowerCase()}.`}</div>
            <article className="assistant-message"><div className="assistant-label"><span className="pi-avatar">π</span><strong>Pi</strong><span>{session.status === 'working' ? 'Working' : 'Just now'}</span></div>
              {session.status === 'working' ? <><p>I’m working on this in the background. You can switch to another session; this one stays in your queue.</p><div className="tool-line"><span className="dot working"/><span>{session.detail}</span><code>in progress</code></div><Button className="simulate" size="xs" variant="light" leftSection={<IconPlayerPlay size={13}/>} onClick={finish}>Simulate response ready</Button></> : <>
                <p>{session.id === 'pdf' ? 'The thumbnail pipeline is ready. Before I continue, which fallback should we use when a PDF page cannot be rendered?' : 'Your open conversations can become a work queue rather than a row of tabs.'}</p>
                <div className="response-summary"><div><span className="dot attention"/><strong>Needs you</strong><span>Review a response or answer a question.</span></div><div><span className="dot working"/><strong>Working</strong><span>The agent is running. No action needed yet.</span></div><div><span className="dot ready"/><strong>Ready</strong><span>Idle, still open, and ready to continue.</span></div></div>
                <p>Not working on this right now? Choose <strong>Move to Later</strong>. It leaves your Inbox until you explicitly pick it up again.</p><p className="muted">Later starts collapsed. Expand it to see a short, flat list with project names. Click a session to resume it; no timer, no automatic wake-up, and no archiving.</p>
              </>}
            </article>
            {(messages[session.id] ?? []).map((message, i) => <div className="user-message" key={i}>{message}</div>)}
          </>}
        </div></div>
        {session && <div className="composer-wrap"><form className="composer" onSubmit={e => { e.preventDefault(); send(); }}><Textarea variant="unstyled" aria-label="Message Pi" placeholder="Message Pi…" minRows={2} maxRows={5} autosize value={drafts[session.id] ?? ''} onChange={e => { const value = e.currentTarget.value; setDrafts(old => ({ ...old, [session.id]: value })); }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}/><div className="composer-tools"><span>Claude Sonnet <span className="muted">· Medium thinking</span></span><ActionIcon type="submit" aria-label="Send message" disabled={!drafts[session.id]?.trim() || session.status === 'working'}><IconArrowUp size={17}/></ActionIcon></div></form><div className="composer-caption"><span>Drafts stay with their session</span><span>Local mockup · no messages sent</span></div></div>}
      </main>
    </div>
    <Drawer opened={settings} onClose={() => setSettings(false)} position="right" title="Settings" size={390}><Stack gap="xl"><div><Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="md">Session navigation</Text><Switch label="Show open sessions in sidebar" description="Hide the tab bar and use the sidebar as your open-session queue. Conversations and drafts stay open." checked={sidebarMode} onChange={e => { setSidebarMode(e.currentTarget.checked); if (e.currentTarget.checked) setPanelOpen(true); }}/></div><div className="settings-note"><IconInboxMark/><Text size="sm">{sidebarMode ? 'Sidebar navigation is on. The same open sessions are now in your queue.' : 'Tabs are visible. Turn on sidebar navigation to remove the tab strip.'}</Text></div><Text size="xs" c="dimmed">Prototype only: this preference resets on reload. Choosing a concept is a review control, not a proposed production setting.</Text><Button variant="default" onClick={() => setSettings(false)}>Back to workspace</Button></Stack></Drawer>
  </div>;
}
function IconInboxMark() { return <IconLayoutSidebar size={22}/>; }
