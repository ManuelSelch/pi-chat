// Review-only preview of the above-composer widget grid.
// Fake widget output; no backend, no persistence.

const WIDGETS = {
  "git-status": [
    "pi-chat · main ⇡2",
    "main ↑5",
    "✓ 2 branches",
  ],
  pipeline: [
    "● Local 0/4 · stale · just now",
    "⚠ build stale (✓ 1m ago)",
    "⚠ unit stale (✓ 3m ago)",
    "› e2e running 3s",
    "⚠ production-smoke stale (✓ 1h ago)",
    "✕ GitHub Tests · 2/4 · 8m ago",
    "   └ ✕ e2e failed",
    "   └ ○ sonar skipped",
    "✕ deploy-preview · skipped",
    "   └ ○ waiting on e2e",
    "○ release-drafter · queued",
    "✓ lint · 12s",
    "✓ typecheck · 41s",
    "✓ dependencies · 2s",
    "○ coverage upload · queued",
    "⚠ two jobs report stale",
  ],
  "worktree-cleanup": [
    "Cleanup 3/4 · Removing feat/settings-features · 19s",
  ],
  memory: [
    "Project context loaded",
    "4 notes available",
  ],
  todo: [
    "○ Check responsive layout",
    "○ Review widget spacing",
  ],
};

const SCENARIOS = {
  three: ["git-status", "pipeline", "worktree-cleanup"],
  two: ["pipeline", "git-status"],
  five: ["git-status", "pipeline", "worktree-cleanup", "memory", "todo"],
};

const state = {
  scenario: "three",
  layout: "proposed",
  odd: "half",
  collapsed: new Set(),
};

const widgetsRoot = document.querySelector("#widgets");

function widgetElement(key) {
  const lines = WIDGETS[key];
  const collapsed = state.collapsed.has(key);

  const article = document.createElement("article");
  article.className = "widget";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "widget-toggle";
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.innerHTML =
    `<span class="chevron">${collapsed ? "›" : "⌄"}</span>${key}` +
    (collapsed ? `<span class="count">${lines.length} line${lines.length === 1 ? "" : "s"}</span>` : "");
  toggle.addEventListener("click", () => {
    if (collapsed) state.collapsed.delete(key);
    else state.collapsed.add(key);
    render();
  });

  const body = document.createElement("pre");
  body.className = "widget-body";
  body.textContent = lines.join("\n");
  body.hidden = collapsed;

  article.append(toggle, body);
  return article;
}

function render() {
  widgetsRoot.dataset.layout = state.layout;
  widgetsRoot.dataset.odd = state.odd;
  widgetsRoot.replaceChildren(...SCENARIOS[state.scenario].map(widgetElement));
}

function pressed(group, value) {
  for (const button of document.querySelectorAll(`.demo button[data-${group}]`)) {
    button.setAttribute("aria-pressed", String(button.dataset[group] === value));
  }
}

for (const button of document.querySelectorAll(".demo button[data-scenario]")) {
  button.addEventListener("click", () => {
    state.scenario = button.dataset.scenario;
    pressed("scenario", state.scenario);
    render();
  });
}

for (const button of document.querySelectorAll(".demo button[data-layout]")) {
  button.addEventListener("click", () => {
    state.layout = button.dataset.layout;
    pressed("layout", state.layout);
    render();
  });
}

for (const button of document.querySelectorAll(".demo button[data-odd]")) {
  button.addEventListener("click", () => {
    state.odd = button.dataset.odd;
    pressed("odd", state.odd);
    render();
  });
}

document.querySelector("#composer").addEventListener("submit", (event) => event.preventDefault());

render();
