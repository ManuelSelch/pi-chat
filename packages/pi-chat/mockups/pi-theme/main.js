// Isolated review harness only: no production theme loader, network or persistence.
const root = document.documentElement;
const selector = document.querySelector("#palette");
const params = new URLSearchParams(location.search);
selector.value = params.get("theme") === "light" ? "light" : "dark";
const roles = ["page", "panel", "text", "muted", "border", "accent", "link", "success", "warning", "danger"];
function applyTheme() {
  root.dataset.theme = selector.value;
  const url = new URL(location.href);
  url.searchParams.set("theme", selector.value);
  history.replaceState(null, "", url);
  const styles = getComputedStyle(root);
  const list = document.querySelector("#colors");
  list.replaceChildren();
  for (const role of roles) {
    const color = styles.getPropertyValue("--" + role).trim();
    const term = document.createElement("dt");
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.backgroundColor = color;
    term.append(swatch, role);
    const value = document.createElement("dd");
    value.textContent = color;
    list.append(term, value);
  }
}
selector.addEventListener("change", applyTheme);
applyTheme();
const dialog = document.querySelector("#settings");
document.querySelector("#show-dialog").addEventListener("click", () => dialog.showModal());
for (const id of ["close-dialog", "cancel", "save"]) document.getElementById(id).addEventListener("click", () => dialog.close());
document.querySelector("#inspect").addEventListener("click", () => {
  const mapping = document.querySelector("#mapping");
  mapping.hidden = !mapping.hidden;
  if (!mapping.hidden) mapping.scrollIntoView({ block: "center" });
});
if (params.get("state") === "dialog") dialog.showModal();
const message = document.querySelector("#message");
message.addEventListener("input", () => { document.querySelector("#send").disabled = !message.value.trim(); });
document.querySelector("#composer").addEventListener("submit", event => {
  event.preventDefault();
  message.value = "";
  document.querySelector("#send").disabled = true;
  message.focus();
});
