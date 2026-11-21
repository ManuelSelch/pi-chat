const preview = document.querySelector('#readme-preview');
const layoutButtons = [...document.querySelectorAll('.direction-button')];
const layoutNames = new Set(['product', 'editorial']);

function applyLayout(layout, updateUrl = true) {
  const selected = layoutNames.has(layout) ? layout : 'product';
  preview.dataset.layout = selected;
  for (const button of layoutButtons) {
    const active = button.dataset.layout === selected;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('layout', selected);
    window.history.replaceState({}, '', url);
  }
}

for (const button of layoutButtons) {
  button.addEventListener('click', () => applyLayout(button.dataset.layout));
}

applyLayout(new URLSearchParams(window.location.search).get('layout'), false);
