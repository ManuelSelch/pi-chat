import { useState } from 'react';
import { ActionIcon, Button } from '@mantine/core';
import { IconChevronRight, IconClockPause, IconGitBranch, IconInbox } from '@tabler/icons-react';
import { labels, type Session } from './data';

export function SessionRow({ session: s, onOpen, onLater }: { session: Session; onOpen: () => void; onLater: () => void }) {
  const [added, removed] = s.changes?.split(' ') ?? [];
  return <article className={`session-row ${s.status}`}>
    <button className="row-open" onClick={onOpen}>
      <span className={`mini-dot session-status ${s.status}`} role="img" aria-label={labels[s.status]}/>
      <span className="row-content">
        <span className="row-title">{s.title}</span>
        <span className="row-time">{s.time}</span>
        <span className="row-meta"><span>{s.project}</span><span className="branch"><IconGitBranch size={12}/>{s.branch}</span></span>
        {s.changes && <span className="loc-summary" aria-label={`${added?.slice(1)} lines added, ${removed?.slice(1)} lines removed`}><span className="loc-added">{added}</span><span className="loc-removed">{removed}</span></span>}
      </span>
    </button>
    {s.status !== 'later' && <ActionIcon className="later-action" variant="subtle" color="gray" aria-label={`Move ${s.title} to Later`} onClick={onLater}><IconClockPause size={16}/></ActionIcon>}
  </article>;
}

export function Inbox({ sessions, onOpen, onLater, onNew }: { sessions: Session[]; onOpen: (s: Session) => void; onLater: (s: Session) => void; onNew: () => void }) {
  const [laterOpen, setLaterOpen] = useState(false);
  const attention = sessions.filter(s => s.status === 'ready' || s.status === 'blocked');
  const later = sessions.filter(s => s.status === 'later');
  const row = (s: Session) => <SessionRow key={s.id} session={s} onOpen={() => onOpen(s)} onLater={() => onLater(s)}/>;
  return <div className="inbox-page relaxed-inbox">
    <div className="page-heading"><h1>Inbox</h1></div>
    <div className="inbox-groups">
      {(['blocked', 'ready'] as const).map(status => {
        const rows = attention.filter(s => s.status === status);
        if (!rows.length) return null;
        return <section key={status} aria-label={status === 'blocked' ? 'Blocked' : 'Ready to review'}><div className="section-heading"><span>{status === 'blocked' ? 'Blocked' : 'Ready to review'}</span></div>{rows.map(row)}</section>;
      })}
      {!attention.length && <div className="empty"><IconInbox size={36}/><h2>Nothing waiting here</h2><p>We’ll bring your agents here when they finish or need a decision.</p><Button variant="default" onClick={onNew}>Start a session</Button></div>}
      {later.length > 0 && <section className="later-section" aria-label="Later"><button className="later-toggle" aria-expanded={laterOpen} aria-controls="later-sessions" onClick={() => setLaterOpen(open => !open)}><IconChevronRight size={15} className={laterOpen ? 'expanded' : ''}/><IconClockPause size={15}/><span>Later</span><small>{later.length}</small></button><div id="later-sessions" hidden={!laterOpen}>{later.map(row)}</div></section>}
    </div>
  </div>;
}
