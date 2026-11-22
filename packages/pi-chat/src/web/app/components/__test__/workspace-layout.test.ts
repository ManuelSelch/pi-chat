import { describe, expect, it } from "vitest";
import { workspaceLayout } from "../../utils/workspace-layout.js";

describe("workspaceLayout", () => {
  it("stacks the plugin panel when navigation leaves too little room for parallel columns", () => {
    expect(workspaceLayout(1000, true, true)).toMatchObject({ right: 0, panelStacked: true, widgetsDocked: false });
    expect(workspaceLayout(1000, false, true)).toMatchObject({ right: 460, panelStacked: false, widgetsDocked: false });
  });
  it("keeps the composer and widgets in the remaining transcript width", () => {
    expect(workspaceLayout(1800, false, true)).toMatchObject({ right: 828, panelStacked: false, widgetsDocked: false });
  });
  it.each([
    [390, true, 0, false],
    [639, true, 0, false],
    [640, true, 288, false],
    [1024, true, 288, false],
    [1200, true, 288, false],
    [1399, true, 288, false],
    [1400, true, "var(--pi-projects-width)", false],
    [1680, true, "var(--pi-projects-width)", true],
    [1024, false, 0, false],
    [1200, false, 0, true],
  ] as const)("reserves safe workspace at %ipx with Projects %s", (width, open, left, widgetsDocked) => {
    expect(workspaceLayout(width, open)).toMatchObject({ left, widgetsDocked });
  });
});
