const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get('theme') || 'light';
const empty = params.get('state') === 'empty';
const projects = [
  { id: 'quick', name: 'Quick Chats', path: '~', special: true },
  { id: 'pi-chat', name: 'pi-chat', path: '~/.pi/agent/git/pi-chat', pinned: true },
  { id: 'autodeko', name: 'autodeko', path: '~/Projects/autodeko', pinned: true },
  { id: 'dotfield', name: 'dotfield', path: '~/Projects/dotfield', pinned: false },
];
let sessions = [
  ...empty ? [] : [
    { id: 1, project: 'quick', title: 'Plan a weekend trip', date: 'Today, 10:42', messages: 12 },
    { id: 2, project: 'quick', title: 'Explain compound interest', date: 'Yesterday, 16:20', messages: 8 },
    { id: 3, project: 'quick', title: 'Ideas for a birthday dinner', date: 'Oct 7', messages: 16, archived: true },
  ],
  { id: 4, project: 'pi-chat', title: 'Quick Chats project entry', date: 'Today, 09:15', messages: 24 },
  { id: 5, project: 'autodeko', title: 'Product gallery improvements', date: 'Yesterday', messages: 38 },
  { id: 6, project: 'dotfield', title: 'First playable prototype', date: 'Oct 6', messages: 22 },
];
let selected = params.get('state') === 'project' ? 'pi-chat' : 'quick';
let current = empty ? null : 1;
const bubble = '<svg class="project-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>';
const folder = '<svg class="project-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>';
const esc = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
function projectRow(p) {
  const count = sessions.filter(s => s.project === p.id && !s.archived).length;
  return `<button class="project-row ${selected === p.id ? 'selected' : ''}" data-project="${p.id}" ${selected === p.id ? 'aria-current="true"' : ''}>${p.special ? bubble : folder}<span class="project-text"><span class="project-name">${p.name}</span></span><span class="count">${count}</span></button>`;
}
function sessionRow(s) {
  return `<div class="session-row ${s.archived ? 'archived' : ''} ${current === s.id ? 'current' : ''}"><button class="session-open" data-open="${s.id}"><span class="session-title">${esc(s.title)}</span><span class="session-meta">${s.date} · ${s.messages} messages</span></button><button class="row-action" data-archive="${s.id}" aria-label="${s.archived ? 'Restore' : 'Archive'} ${esc(s.title)}" title="${s.archived ? 'Restore' : 'Archive'} session">${s.archived ? '↶' : '▤'}</button></div>`;
}
function render() {
  $('quick-project').innerHTML = projectRow(projects[0]);
  $('pinned-projects').innerHTML = projects.filter(p => !p.special && p.pinned).map(projectRow).join('');
  $('recent-projects').innerHTML = projects.filter(p => !p.special && !p.pinned).map(projectRow).join('');
  const p = projects.find(p => p.id === selected);
  $('project-title').textContent = p.name;
  $('project-path').textContent = p.path;
  $('pin-project').hidden = !!p.special;
  $('pin-project').textContent = p.pinned ? '◆' : '◇';
  $('pin-project').ariaLabel = $('pin-project').title = p.pinned ? 'Unpin project' : 'Pin project';
  $('new-session').textContent = p.special ? '＋ New chat' : '＋ New session';
  const active = sessions.filter(s => s.project === selected && !s.archived);
  const archived = sessions.filter(s => s.project === selected && s.archived);
  $('active-count').textContent = active.length;
  $('archive-count').textContent = archived.length;
  $('active-sessions').innerHTML = active.length ? active.map(sessionRow).join('') : `<div class="empty"><strong>${p.special ? 'No quick chats yet' : 'No active sessions'}</strong>${p.special ? 'Start a chat without choosing a project.' : 'Start a new session when you’re ready.'}</div>`;
  $('archived-sessions').innerHTML = archived.length ? archived.map(sessionRow).join('') : '<div class="empty">No archived sessions yet.</div>';
  const s = sessions.find(s => s.id === current);
  $('tabs').innerHTML = s ? `<span class="tab current">${s.project === 'quick' ? bubble : folder}${esc(s.title)}</span>` : '<span class="fine">No open sessions</span>';
  $('conversation-title').textContent = s?.title || 'Start a quick chat';
  $('conversation-project').textContent = projects.find(p => p.id === s?.project)?.name || 'Quick Chats';
}
function panel(show) {
  $('drawer').hidden = $('backdrop').hidden = !show;
  document.querySelector('.conversation').inert = show;
  document.querySelector('.app-header').inert = show;
  $('tabs').inert = show;
  (show ? $('close-panel') : $('open-panel')).focus();
}
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.project) { selected = button.dataset.project; $('archive').open = false; render(); }
  if (button.dataset.open) { current = Number(button.dataset.open); render(); panel(false); }
  if (button.dataset.archive) { const s = sessions.find(s => s.id === Number(button.dataset.archive)); s.archived = !s.archived; render(); }
});
$('new-session').onclick = () => {
  const s = { id: Math.max(0, ...sessions.map(s => s.id)) + 1, project: selected, title: selected === 'quick' ? 'New chat' : 'New session', date: 'Just now', messages: 0 };
  sessions.unshift(s); current = s.id; render(); panel(false);
};
$('pin-project').onclick = () => { const p = projects.find(p => p.id === selected); if (!p.special) p.pinned = !p.pinned; render(); };
$('open-panel').onclick = () => panel(true);
$('close-panel').onclick = $('backdrop').onclick = () => panel(false);
$('theme').onclick = () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; };
$('folder').onclick = () => { $('toast').textContent = 'Folder picker is outside this mockup.'; $('toast').hidden = false; setTimeout(() => { $('toast').hidden = true; }, 2500); };
document.addEventListener('keydown', event => {
  if ($('drawer').hidden) return;
  if (event.key === 'Escape') panel(false);
  if (event.key === 'Tab') {
    const controls = [...$('drawer').querySelectorAll('button, summary')].filter(el => el.getClientRects().length && !el.disabled);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
render(); panel(true);
