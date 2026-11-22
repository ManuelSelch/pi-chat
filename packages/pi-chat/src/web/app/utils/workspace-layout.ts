/** Geometry shared by the transcript, fixed composer and extension widgets. */
export function workspaceLayout(viewportWidth: number, projectsOpen: boolean, panelOpen = false) {
  const compact = viewportWidth >= 640 && viewportWidth < 1400;
  const left = projectsOpen && viewportWidth >= 640 ? (compact ? 288 : "var(--pi-projects-width)") : 0;
  const leftPixels = typeof left === "number" ? left : Math.min(340, (viewportWidth - 720) / 2 - 32);
  const available = viewportWidth - leftPixels;
  const panelStacked = panelOpen && available < 760;
  const right = panelOpen && !panelStacked ? available * 0.46 : 0;
  return {
    left,
    right,
    panelStacked,
    sidebarWidth: viewportWidth >= 1400 ? "min(340px, calc((100vw - 45rem) / 2 - 32px))" : "288px",
    widgetsDocked: available - right >= 1200,
  };
}
