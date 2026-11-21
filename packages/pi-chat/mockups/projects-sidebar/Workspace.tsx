import { useRef, useState } from "react";
import { ActionIcon, Button, Modal, Textarea, UnstyledButton } from "@mantine/core";
import { IconArrowUp, IconChevronDown, IconChevronRight, IconFolder, IconLayoutSidebar, IconMessage, IconPlus, IconSettings, IconX } from "@tabler/icons-react";

interface Session { id: string; title: string; project: string }
const initialSessions: Session[] = [
  {id:"sidebar",title:"Projects sidebar UX",project:"pi-chat"},
  {id:"focus",title:"Composer focus",project:"pi-chat"},
  {id:"tests",title:"Integration tests",project:"pi-chat"},
  {id:"studio",title:"Workspace navigation",project:"pi-studio"},
  {id:"notes",title:"PDF thumbnails",project:"notes-to-go"},
  {id:"quick",title:"A quick question",project:"Quick Chats"},
];
export function Workspace() {
  const drawer = new URLSearchParams(location.search).get("mobile") === "drawer";
  const [open, setOpen] = useState(true);
  const [sessions, setSessions] = useState(initialSessions);
  const [active, setActive] = useState("sidebar");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({"pi-chat":true,"Quick Chats":true,"pi-studio":true});
  const [drafts, setDrafts] = useState<Record<string,string>>({});
  const [messages, setMessages] = useState<Record<string,string[]>>({});
  const [settings, setSettings] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const session = sessions.find(s => s.id === active)!;
  function choose(id: string) { setActive(id); }
  function create(project:string) {
    const id = String(Date.now());
    setSessions(value => [...value,{id,title:"New session",project}]);
    setExpanded(value => ({...value,[project]:true}));
    setActive(id);
  }
  function toggle() {
    setOpen(value => !value);
    // The navigation toggle does not take typing ownership from the composer.
    if (!drawer || window.innerWidth > 639) composer.current?.focus();
  }
  function send() {
    const value = drafts[active]?.trim();
    if (!value) return;
    setMessages(old => ({...old,[active]:[...(old[active] ?? []),value]}));
    setDrafts(old => ({...old,[active]:""}));
  }
  return <div className={`workspace ${open ? "panel-open" : ""} ${drawer ? "mobile-drawer" : ""}`}>
    <header className="app-header">
      <div className="brand"><ActionIcon variant={open ? "light" : "subtle"} aria-label="Toggle projects" aria-expanded={open} onClick={toggle}><IconLayoutSidebar size={19}/></ActionIcon><strong>Pi Chat</strong></div>
      <span className="project-path">{session.project}</span>
      <ActionIcon variant="subtle" color="gray" aria-label="Settings" onClick={() => setSettings(true)}><IconSettings size={19}/></ActionIcon>
    </header>
    <div className="tab-strip"><span className="tab"><span className="status-dot"/>{session.title}</span><ActionIcon variant="subtle" color="gray" size="sm" aria-label="New session" onClick={() => create(session.project)}><IconPlus size={15}/></ActionIcon></div>
    {open && drawer && <button className="mobile-shade" aria-label="Close projects" onClick={() => setOpen(false)} />}
    {open && <aside className="projects" aria-label="Projects">
      <div className="panel-heading"><strong>Projects</strong><ActionIcon variant="subtle" color="gray" aria-label="Close projects" onClick={toggle}><IconX size={17}/></ActionIcon></div>
      <nav className="project-list" aria-label="Projects and sessions">
        {[...new Set(["Quick Chats","pi-chat","pi-studio","notes-to-go",...sessions.map(s => s.project)])].map(project => <div className="project-group" key={project}>
          <div className="project-heading"><UnstyledButton onClick={() => setExpanded(old => ({...old,[project]:!old[project]}))} aria-expanded={!!expanded[project]} className="project-toggle">
            {expanded[project] ? <IconChevronDown size={13}/> : <IconChevronRight size={13}/>}
            {project === "Quick Chats" ? <IconMessage size={16}/> : <IconFolder size={16}/>}<span>{project}</span>
          </UnstyledButton><ActionIcon variant="subtle" color="gray" size="sm" aria-label={`New session in ${project}`} onClick={() => create(project)}><IconPlus size={14}/></ActionIcon><span className="count">{sessions.filter(s => s.project === project).length}</span></div>
          {expanded[project] && sessions.filter(s => s.project === project).map(s => <UnstyledButton className={`session-row ${s.id === active ? "selected" : ""}`} key={s.id} aria-current={s.id === active ? "page" : undefined} onClick={() => choose(s.id)}>{s.title}</UnstyledButton>)}
        </div>)}
      </nav>
      <Button className="open-folder" variant="default" leftSection={<IconFolder size={15}/>} onClick={() => create("New folder")}>Open folder</Button>
    </aside>}
    <main className="chat-area">
      <div className="chat-column">
        <div className="transcript" aria-label="Conversation">
          <div className="conversation-meta">{session.project} <span>/</span> {session.title}</div>
          <div className="user-message">I want to keep the projects panel open while working in a session.</div>
          <article className="assistant-message"><span className="speaker">Pi</span><p>Keep your projects nearby without leaving the conversation.</p>
            <p>On a wide screen, the panel fits into the spare left margin. When the window gets narrower, the conversation makes room for it.</p>
            <ul><li>Choose another session without closing Projects.</li><li>Keep typing, selecting text, and scrolling here.</li><li>Close the panel whenever you want more space.</li></ul>
            <p className="muted">This is an interactive layout sketch. Try sending a message below.</p>
          </article>
          {(messages[active] ?? []).map((message,i) => <div className="sent-pair" key={i}><div className="user-message">{message}</div><article className="assistant-message"><span className="speaker">Pi</span><p>Message received in “{session.title}”. Projects is still {open ? "open" : "closed"}.</p></article></div>)}
        </div>
        <form className="composer" onSubmit={event => {event.preventDefault();send();}}>
          <Textarea ref={composer} aria-label="Message" placeholder="Message Pi…" value={drafts[active] ?? ""} onChange={event => setDrafts(old => ({...old,[active]:event.target.value}))} autosize minRows={2} maxRows={4}
            onKeyDown={event => {if(event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {event.preventDefault();send();}}} />
          <div className="composer-tools"><span>Claude Sonnet <span className="muted">· Thinking medium</span></span><ActionIcon type="submit" aria-label="Send message" disabled={!drafts[active]?.trim()}><IconArrowUp size={18}/></ActionIcon></div>
        </form>
        <div className="composer-caption"><span className="status-dot"/> Ready <span>Local mockup · no messages sent</span></div>
      </div>
    </main>
    <Modal opened={settings} onClose={() => setSettings(false)} title="Settings" centered><p>Real dialogs still own focus. Close this dialog to return to the workspace.</p><Button mt="md" onClick={() => setSettings(false)}>Done</Button></Modal>
  </div>;
}
