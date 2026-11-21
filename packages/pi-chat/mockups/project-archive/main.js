const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get('theme') || 'light';
const projects = [
  { id: 'pi-chat', name: 'pi-chat', path: '~/.pi/agent/git/pi-chat', pinned: true, branch: 'main' },
  { id: 'autodeko', name: 'autodeko', path: '~/Projects/autodeko', pinned: true, branch: 'main' },
  { id: 'notes', name: 'study-notes', path: '~/Documents/study-notes', pinned: true, branch: '' },
  { id: 'dotfield', name: 'dotfield', path: '~/Projects/dotfield', pinned: false, branch: 'main' },
];
let sessions = [
  { id: 1, project: 'pi-chat', title: 'Project archive flow', date: 'Today, 10:42', messages: 28, archived: false },
  { id: 2, project: 'pi-chat', title: 'Improve command completion', date: 'Yesterday, 16:20', messages: 46, archived: false },
  { id: 3, project: 'pi-chat', title: 'Worktree project grouping', date: 'Oct 7', messages: 64, archived: true },
  { id: 4, project: 'pi-chat', title: 'Fix reconnect after reload', date: 'Oct 4', messages: 32, archived: true },
  { id: 5, project: 'pi-chat', title: 'Add bash command cards', date: 'Sep 28', messages: 52, archived: true },
  { id: 6, project: 'autodeko', title: 'Product gallery improvements', date: 'Sep 25', messages: 38, archived: true },
  { id: 7, project: 'dotfield', title: 'First playable prototype', date: 'Yesterday, 12:10', messages: 22, archived: false },
];
let selected = params.get('state') === 'empty' ? 'autodeko' : 'pi-chat';
let current = 1;
let tabs = [1, 2, 7];
let undo = null;
const esc = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function notify(text, action) { $('toast-text').textContent = text; undo = action; $('undo').hidden = !action; $('toast').hidden = false; }
function row(session) {
  return `<div class="session-row ${session.archived ? 'archived' : ''} ${current === session.id ? 'current' : ''}"><button class="session-open" data-open="${session.id}"><span class="session-title">${esc(session.title)}</span><span class="session-meta">${session.archived ? 'Archived ' : ''}${session.date} · ${session.messages} messages</span></button><button class="row-action" data-action="${session.id}" title="${session.archived ? 'Restore' : 'Archive'} session" aria-label="${session.archived ? 'Restore' : 'Archive'} ${esc(session.title)}">${session.archived ? '↶' : '▤'}</button></div>`;
}
function render() {
  for (const [container, pinned] of [['pinned-projects', true], ['recent-projects', false]]) {
    $(container).innerHTML = projects.filter(p => p.pinned === pinned).map(p => `<button class="project-row ${selected === p.id ? 'selected' : ''}" data-project="${p.id}" ${selected === p.id ? 'aria-current="true"' : ''}><span class="folder-icon" aria-hidden="true">▱</span><span class="project-text"><span class="project-name">${p.name}</span><span class="project-sub">${p.branch || 'Folder'}</span></span><span class="count">${sessions.filter(s => s.project === p.id && !s.archived).length}</span></button>`).join('');
  }
  const project = projects.find(p => p.id === selected);
  $('project-title').textContent = project.name;
  $('project-path').textContent = project.path;
  $('pin-project').textContent = project.pinned ? '◆' : '◇';
  $('pin-project').title = $('pin-project').ariaLabel = project.pinned ? 'Unpin project' : 'Pin project';
  const active = sessions.filter(s => s.project === selected && !s.archived);
  const archived = sessions.filter(s => s.project === selected && s.archived);
  $('active-count').textContent = active.length;
  $('archive-count').textContent = archived.length;
  $('active-sessions').innerHTML = active.length ? active.map(row).join('') : '<div class="empty"><strong>No active sessions</strong>Start a new session when you’re ready.</div>';
  $('archived-sessions').innerHTML = archived.length ? archived.map(row).join('') : '<div class="empty">No archived sessions yet.</div>';
  $('tabs').innerHTML = tabs.map(id => { const s = sessions.find(s => s.id === id); return `<div class="tab ${id === current ? 'current' : ''}"><button class="session-open" data-tab="${id}"><span class="dot"></span> ${esc(s.title)}</button><button class="tab-close" data-close="${id}" aria-label="Close ${esc(s.title)} tab">×</button></div>`; }).join('');
  const session = sessions.find(s => s.id === current);
  $('conversation-title').textContent = session?.title || 'No open sessions';
  const cp = projects.find(p => p.id === session?.project);
  $('conversation-project').textContent = cp ? `${cp.name}${cp.branch ? ' · ' + cp.branch : ''}` : 'Open a project to get started';
  $('archive-notice').hidden = !session?.archived;
  $('composer').hidden = !session;
}
function showPanel(show) {
  $('drawer').hidden = $('backdrop').hidden = !show;
  (show ? $('close-panel') : $('open-panel')).focus();
}
function openSession(id) { if (!tabs.includes(id)) tabs.push(id); current = id; render(); showPanel(false); }
document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.project) { selected = button.dataset.project; $('archive').open = false; render(); }
  if (button.dataset.open) openSession(Number(button.dataset.open));
  if (button.dataset.tab) { current = Number(button.dataset.tab); render(); }
  if (button.dataset.close) { const id = Number(button.dataset.close); tabs = tabs.filter(t => t !== id); if (current === id) current = tabs[0]; render(); }
  if (button.dataset.action) {
    const session = sessions.find(s => s.id === Number(button.dataset.action));
    const before = session.archived;
    session.archived = !before;
    if (session.archived) { tabs = tabs.filter(id => id !== session.id); if (current === session.id) current = tabs[0]; }
    notify(session.archived ? 'Session archived. History kept.' : 'Session restored to Active.', () => { session.archived = before; render(); });
    render();
  }
});
$('open-panel').onclick = () => showPanel(true);
$('close-panel').onclick = $('backdrop').onclick = () => showPanel(false);
$('theme').onclick = () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; };
$('pin-project').onclick = () => { const p = projects.find(p => p.id === selected); p.pinned = !p.pinned; render(); };
$('undo').onclick = () => { undo?.(); $('toast').hidden = true; undo = null; };
$('new-session').onclick = () => { const s = { id: Math.max(...sessions.map(s => s.id)) + 1, project: selected, title: 'New session', date: 'Today', messages: 0, archived: false }; sessions.push(s); openSession(s.id); };
$('folder').onclick = () => notify('Folder picker is not part of this mockup.');
$('composer').onsubmit = (event) => {
  event.preventDefault();
  if (!$('prompt').value.trim()) return;
  const session = sessions.find(s => s.id === current);
  if (session.archived) { session.archived = false; notify('Session returned to Active.'); }
  else notify('Message simulated — no agent is connected.');
  $('prompt').value = ''; render();
};
document.addEventListener('keydown', (event) => {
  if ($('drawer').hidden) return;
  if (event.key === 'Escape') showPanel(false);
  if (event.key === 'Tab') {
    const controls = [...$('drawer').querySelectorAll('button, summary')].filter(el => el.getClientRects().length && !el.disabled);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
render();
$('archive').open = params.get('state') === 'expanded';
showPanel(true);
