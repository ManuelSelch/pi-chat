const toggle = document.querySelector('#hide-archived');
const panel = document.querySelector('.project-panel');
const storageKey = 'pi-chat-mockup:hideArchived';

try {
  const saved = localStorage.getItem(storageKey);
  if (saved !== null) toggle.checked = saved === 'true';
} catch { /* Mockup remains usable when storage is unavailable. */ }

function update() {
  panel.classList.toggle('hidden-mode', toggle.checked);
  try { localStorage.setItem(storageKey, String(toggle.checked)); } catch { /* local-only preview */ }
}

toggle.addEventListener('change', update);
document.querySelector('.archive-heading').addEventListener('click', (event) => {
  const block = event.currentTarget.closest('.archived-block');
  const expanded = block.classList.toggle('expanded');
  event.currentTarget.setAttribute('aria-expanded', String(expanded));
});
update();
