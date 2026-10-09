const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get('theme') || 'light';
const empty = params.get('state') === 'empty';
const many = params.get('state') === 'many';

const icon = (paths, cls) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const bubble = icon('<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>', 'row-icon');
const folder = icon('<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>', 'row-icon');
const pinIcon = filled => icon(filled
  ? '<path d="M9 4h6l-1 5 3 3v2h-4v6l-1 1-1-1v-6H7v-2l3-3-1-5z" fill="currentColor" stroke="none"/>'
  : '<path d="M9 4h6l-1 5 3 3v2h-4v6l-1 1-1-1v-6H7v-2l3-3-1-5z"/>', 'pin');
const branch = '<svg class="worktree-mark" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="9" r="2.4"/><path d="M6 8.4v7.2M18 11.4c0 3-2 4-5 4H8"/></svg>';
const plus = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const box = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h16v11H4zM3 4h18v4H3zM10 12h4"/></svg>';
const restore = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/></svg>';

const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const projects = [
  { id: 'quick', name: 'Quick Chats', path: '~', special: true },
  { id: 'pi-chat', name: 'pi-chat', path: '~/.pi/agent/git/pi-chat', pinned: true },
  { id: 'autodeko', name: 'autodeko', path: '~/Projects/autodeko', pinned: true },
  { id: 'dotfield', name: 'dotfield', path: '~/Projects/dotfield' },
  { id: 'extensions', name: 'extensions', path: '~/.pi/agent/extensions' },
  ...many ? [
    { id: 'pi-verify', name: 'pi-verify', path: '~/.pi/agent/git/pi-verify' },
    { id: 'blueflow', name: 'blueflow', path: '~/work/blueflow' },
    { id: 'bcx', name: 'bcx', path: '~/work/bcx' },
    { id: 'notes', name: 'notes', path: '~/Documents/notes' },
  ] : [],
];

let sessions = empty ? [] : [
  { id: 1, project: 'quick', title: 'Plan a weekend trip', date: 'Yesterday, 16:20', messages: 8 },
  { id: 2, project: 'quick', title: 'Explain compound interest', date: 'Oct 7', messages: 16 },
  { id: 3, project: 'quick', title: 'Birthday dinner ideas', date: 'Oct 3', messages: 11, archived: true },

  { id: 4, project: 'pi-chat', title: 'Quick Chats project entry', date: 'Today, 09:15', messages: 24, branch: 'feat/quickchat', worktree: true },
  { id: 5, project: 'pi-chat', title: 'File content styling', date: 'Today, 08:02', messages: 41, branch: 'feat/file-content-styling', worktree: true },
  { id: 6, project: 'pi-chat', title: 'Project archive flow', date: 'Yesterday, 18:44', messages: 63, branch: 'feat/project-archive-flow', worktree: true },
  { id: 7, project: 'pi-chat', title: 'Plan REQUIREMENTS.md skill', date: 'Yesterday, 11:10', messages: 37 },
  { id: 8, project: 'pi-chat', title: 'Websocket transport notes', date: 'Oct 6', messages: 19 },
  { id: 9, project: 'pi-chat', title: 'Old session cleanup', date: 'Oct 1', messages: 7, archived: true },

  { id: 10, project: 'autodeko', title: 'Product gallery improvements', date: 'Yesterday', messages: 38, branch: 'feat/gallery', worktree: true },
  { id: 11, project: 'dotfield', title: 'First playable prototype', date: 'Oct 6', messages: 22 },
  { id: 12, project: 'extensions', title: 'Session cleanup extension', date: 'Oct 2', messages: 14 },
  ...many ? [
    { id: 24, project: 'pi-chat', title: 'Follow-up: pin behaviour', date: 'Today, 07:40', messages: 12, branch: 'feat/quickchat', worktree: true },
    { id: 20, project: 'pi-verify', title: 'Verification bundle format', date: 'Oct 5', messages: 31, branch: 'feat/bundle', worktree: true },
    { id: 21, project: 'blueflow', title: 'OneTouchPanel audit fixes', date: 'Oct 4', messages: 52, branch: 'fix/audit', worktree: true },
    { id: 22, project: 'bcx', title: 'Simulator run explorer grouping', date: 'Oct 3', messages: 44 },
    { id: 23, project: 'notes', title: 'Theo exam flashcards', date: 'Sep 30', messages: 27 },
  ] : [],
];

let current = empty ? null : 4;
let selected = empty ? (params.get('state') === 'project' ? 'dotfield' : 'pi-chat') : (params.get('state') === 'project' ? 'dotfield' : 'pi-chat');
const expanded = new Set(empty ? [] : ['pi-chat']);
const expandedArchives = new Set();
let query = '';
if (empty) expanded.clear();

const active = projectId => sessions.filter(s => s.project === projectId && !s.archived);
const archived = projectId => sessions.filter(s => s.project === projectId && s.archived);
const projectById = id => projects.find(p => p.id === id);

function matches(text) { return !query || text.toLowerCase().includes(query); }

function branchCount(projectId, branch) {
  return sessions.filter(s => s.project === projectId && s.branch === branch).length;
}

function sessionRow(s) {
  const parts = [];
  // One session for a worktree: the worktree (branch) name is the row, since
  // it is already the label the user navigates by. Keeping one session per
  // worktree is the normal workflow, so the session title only appears when
  // several sessions share the same worktree.
  const lone = Boolean(s.branch) && branchCount(s.project, s.branch) === 1;
  if (s.branch && !lone) parts.push(`<span class="branch">${branch}${esc(s.branch)}</span>`);
  const title = lone ? `${branch}${esc(s.branch)}` : esc(s.title);
  return `<div class="session-row ${s.archived ? 'archived' : ''} ${current === s.id ? 'current' : ''}" role="listitem">
    <button class="session-main" data-open="${s.id}" title="${esc(s.title)}" ${current === s.id ? 'aria-current="true"' : ''}>
      <span class="session-title">${title}</span>
      ${parts.length ? `<span class="session-meta">${parts.join(' · ')}</span>` : ''}
    </button>
    <span class="row-actions">
      <button data-archive="${s.id}" aria-label="${s.archived ? 'Restore' : 'Archive'} ${esc(s.title)}" title="${s.archived ? 'Restore' : 'Archive'} session">${s.archived ? restore : box}</button>
    </span>
  </div>`;
}

function isOpen(p) {
  if (expanded.has(p.id)) return true;
  if (!query) return false;
  return active(p.id).some(s => matches(s.title)) || archived(p.id).some(s => matches(s.title));
}

function projectSessions(p) {
  const activeSessions = active(p.id);
  const archivedSessions = archived(p.id);
  const visibleActive = activeSessions.filter(s => matches(s.title) || matches(p.name));
  if (!isOpen(p)) return '';
  const showArchive = expandedArchives.has(p.id);
  const rows = [];
  if (!visibleActive.length) rows.push('<div class="empty">No sessions yet. Start one with the + button.</div>');
  else rows.push(...visibleActive.map(sessionRow));
  if (archivedSessions.length) {
    const visibleArchived = archivedSessions.filter(s => matches(s.title));
    rows.push(`<button class="archived-toggle" data-archive-toggle="${p.id}" aria-expanded="${showArchive}">▸ Archived (${visibleArchived.length})</button>`);
    if (showArchive) rows.push(...visibleArchived.map(sessionRow));
  }
  return `<div class="sessions" role="list">${rows.join('')}</div>`;
}

function projectRow(p) {
  const isSelected = selected === p.id;
  const isExpanded = isOpen(p);
  const total = active(p.id).length;
  const isCurrent = current !== null && sessions.find(s => s.id === current)?.project === p.id;
  const pin = p.special ? '' : `<button data-pin="${p.id}" aria-label="${p.pinned ? 'Unpin' : 'Pin'} ${esc(p.name)}" title="${p.pinned ? 'Unpin' : 'Pin'} project">${pinIcon(p.pinned)}</button>`;
  return `<button class="row project-row ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}" data-project="${p.id}" aria-expanded="${isExpanded}" aria-current="${isSelected ? 'true' : 'false'}" title="${esc(p.path)}">
      <span class="row-chevron" aria-hidden="true">›</span>
      ${p.special ? bubble : folder}
      <span class="row-main">
        <span class="row-title">${esc(p.name)}</span>
      </span>
      ${total ? `<span class="count">${total}</span>` : ''}
      <span class="row-actions">
        ${pin}
        <button data-new="${p.id}" aria-label="New ${p.special ? 'chat' : 'session'} in ${esc(p.name)}" title="${p.special ? 'New chat' : 'New session'}">${plus}</button>
      </span>
    </button>${projectSessions(p)}`;
}

function render() {
  const quick = projectById('quick');
  const rest = projects.filter(p => p.id !== 'quick');
  const visibleProjects = rest.filter(p => matches(p.name) || active(p.id).some(s => matches(s.title)) || archived(p.id).some(s => matches(s.title)));
  const pinned = visibleProjects.filter(p => p.pinned);
  const recent = visibleProjects.filter(p => !p.pinned);

  const chunks = [];
  if (quick && (matches(quick.name) || active('quick').some(s => matches(s.title)) || archived('quick').some(s => matches(s.title)))) {
    chunks.push(projectRow(quick));
    chunks.push('<hr class="divider">');
  }
  chunks.push(...pinned.map(projectRow));
  if (pinned.length && recent.length) chunks.push('<hr class="divider">');
  chunks.push(...recent.map(projectRow));
  if (!pinned.length && !recent.length && !quick) chunks.push('<div class="empty"><strong>Nothing matches</strong>Try a different filter.</div>');
  $('list').innerHTML = chunks.join('');

  const s = sessions.find(s => s.id === current);
  $('tabs').innerHTML = s ? `<span class="tab current">${projectById(s.project)?.special ? bubble : folder}${esc(s.title)}</span>` : '<span class="fine">No open sessions</span>';
  $('conversation-title').textContent = s?.title || 'Start a new session';
  $('conversation-project').textContent = s ? projectById(s.project).name : 'Pi Chat';
}

function panel(show) {
  $('drawer').hidden = $('backdrop').hidden = !show;
  document.querySelector('.conversation').inert = show;
  document.querySelector('.app-header').inert = show;
  $('tabs').inert = show;
  (show ? $('close-panel') : $('open-panel')).focus();
}

$('list').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.pin) {
    const p = projectById(button.dataset.pin);
    p.pinned = !p.pinned;
    render();
    return;
  }
  if (button.dataset.new) {
    const p = projectById(button.dataset.new);
    const s = { id: Math.max(0, ...sessions.map(s => s.id)) + 1, project: p.id, title: p.special ? 'New chat' : 'New session', date: 'Just now', messages: 0 };
    sessions.unshift(s); current = s.id; selected = p.id; expanded.add(p.id); render(); panel(false);
    return;
  }
  if (button.dataset.archive) {
    const s = sessions.find(s => s.id === Number(button.dataset.archive));
    s.archived = !s.archived;
    render();
    return;
  }
  if (button.dataset.archiveToggle) {
    const id = button.dataset.archiveToggle;
    expandedArchives.has(id) ? expandedArchives.delete(id) : expandedArchives.add(id);
    render();
    return;
  }
  if (button.dataset.open) {
    current = Number(button.dataset.open);
    selected = sessions.find(s => s.id === current).project;
    render(); panel(false);
    return;
  }
  if (button.dataset.project) {
    const id = button.dataset.project;
    selected = id;
    expanded.has(id) ? expanded.delete(id) : expanded.add(id);
    render();
  }
});
$('open-panel').onclick = () => panel(true);
$('close-panel').onclick = $('backdrop').onclick = () => panel(false);
$('theme').onclick = () => { document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; };
$('folder').onclick = () => { $('toast').textContent = 'Folder picker is outside this mockup.'; $('toast').hidden = false; setTimeout(() => { $('toast').hidden = true; }, 2500); };
document.addEventListener('keydown', event => {
  if ($('drawer').hidden) return;
  if (event.key === 'Escape') { panel(false); return; }
  if (event.key === 'Tab') {
    const controls = [...$('drawer').querySelectorAll('button, input')].filter(el => el.getClientRects().length && !el.disabled);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
render(); panel(true);
