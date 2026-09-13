import { describe, expect, it, vi } from "vitest";
import { createWebUiContext } from "../src/server/web-ui-context.js";

describe("createWebUiContext", () => {
  it("forwards notify to the host, defaulting to info", () => {
    const onNotify = vi.fn();
    const ui = createWebUiContext({ onNotify });

    ui.notify("Memory: clean");
    ui.notify("Something failed", "error");

    expect(onNotify.mock.calls).toEqual([
      ["Memory: clean", "info"],
      ["Something failed", "error"],
    ]);
  });

  it("answers dialogs as cancelled so a command cannot hang", async () => {
    const ui = createWebUiContext({ onNotify: vi.fn() });

    await expect(ui.select("Pick", ["a"])).resolves.toBeUndefined();
    await expect(ui.confirm("Sure?", "really")).resolves.toBe(false);
    await expect(ui.input("Name")).resolves.toBeUndefined();
  });

  it("keeps terminal-only chrome inert", () => {
    const ui = createWebUiContext({ onNotify: vi.fn() });

    expect(() => ui.setStatus("k", "v")).not.toThrow();
    expect(() => ui.setTitle("x")).not.toThrow();
    expect(ui.getEditorText()).toBe("");
  });
});
