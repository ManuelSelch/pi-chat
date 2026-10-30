import { describe, expect, it } from "vitest";
import { workspaceLayout } from "../../../../../../src/web/app/shell/domain/workspace-layout.js";

describe("workspaceLayout", () => {
  it.each([
    [390, true, 0, false],
    [639, true, 0, false],
    [640, true, 288, false],
    [1024, true, 288, false],
    [1200, true, 288, false],
    [1399, true, 288, false],
    [1400, true, 0, true],
    [1680, true, 0, true],
    [1024, false, 0, false],
    [1200, false, 0, true],
  ] as const)("reserves safe workspace at %ipx with Projects %s", (width, open, left, widgetsDocked) => {
    expect(workspaceLayout(width, open)).toMatchObject({ left, widgetsDocked });
  });
});
