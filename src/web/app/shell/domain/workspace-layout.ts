/** Geometry shared by the transcript, fixed composer and extension widgets. */
export function workspaceLayout(viewportWidth: number, projectsOpen: boolean) {
  const compact = viewportWidth >= 640 && viewportWidth < 1400;
  const left = projectsOpen && viewportWidth >= 640 ? (compact ? 288 : "var(--pi-projects-width)") : 0;
  return {
    left,
    sidebarWidth: viewportWidth >= 1400 ? "min(340px, calc((100vw - 45rem) / 2 - 32px))" : "288px",
    widgetsDocked: viewportWidth - (typeof left === "number" ? left : 340) >= 1200,
  };
}
