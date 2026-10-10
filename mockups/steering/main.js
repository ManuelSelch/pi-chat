const input = document.querySelector('#input');
const composer = document.querySelector('#composer');
const queue = document.querySelector('#queue');
const messages = document.querySelector('#messages');
const status = document.querySelector('#status');
let running = true;
let pending = [];
function render() {
  composer.classList.toggle('running', running);
  input.placeholder = running ? 'Steer Pi…' : 'Ask Pi anything…';
  status.textContent = `${running ? 'running' : 'idle'} · claude-sonnet`;
  queue.hidden = pending.length === 0;
  messages.replaceChildren(...pending.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
}
function submit() {
  const text = input.value.trim();
  if (!text) return;
  if (running) pending.push(text);
  else { const div = document.createElement('div'); div.className = 'user'; div.textContent = text; document.querySelector('main').append(div); running = true; }
  input.value = '';
  render();
}
composer.addEventListener('submit', event => { event.preventDefault(); submit(); });
input.addEventListener('keydown', event => {
  if (event.isComposing) return;
  if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') { running = false; render(); } });
document.querySelector('#consume').addEventListener('click', () => {
  if (!pending.length) return;
  const div = document.createElement('div'); div.className = 'user'; div.textContent = pending.shift(); document.querySelector('main').append(div); render();
});
document.querySelector('#reset').addEventListener('click', () => location.reload());
if (new URLSearchParams(location.search).get('state') === 'queued') pending = ['Actually, keep the existing keyboard shortcuts.'];
render();
