import { describe, expect, it, vi } from "vitest";
import type { UiPromptResult } from "../src/shared/protocol.js";
import { createWebUiContext } from "../src/server/web-ui-context.js";

function contextAnswering(result: UiPromptResult) {
  const onPrompt = vi.fn(async () => result);
  return { ui: createWebUiContext({ onNotify: vi.fn(), onPrompt }), onPrompt };
}

describe("createWebUiContext", () => {
  it("forwards notify to the host, defaulting to info", () => {
    const onNotify = vi.fn();
    const ui = createWebUiContext({ onNotify, onPrompt: vi.fn(async () => ({ cancelled: true as const })) });

    ui.notify("Memory: clean");
    ui.notify("Something failed", "error");

    expect(onNotify.mock.calls).toEqual([
      ["Memory: clean", "info"],
      ["Something failed", "error"],
    ]);
  });

  it("asks the browser and returns the chosen value", async () => {
    const { ui, onPrompt } = contextAnswering({ cancelled: false, value: "second" });

    await expect(ui.select("Pick one", ["first", "second"])).resolves.toBe("second");
    expect(onPrompt).toHaveBeenCalledWith({ kind: "select", title: "Pick one", options: ["first", "second"] });
  });

  it("maps confirm and input answers", async () => {
    const confirmed = contextAnswering({ cancelled: false, value: true });
    await expect(confirmed.ui.confirm("Delete?", "This cannot be undone")).resolves.toBe(true);
    expect(confirmed.onPrompt).toHaveBeenCalledWith({ kind: "confirm", title: "Delete?", message: "This cannot be undone" });

    const named = contextAnswering({ cancelled: false, value: "notes" });
    await expect(named.ui.input("Name", "session name")).resolves.toBe("notes");
    expect(named.onPrompt).toHaveBeenCalledWith({ kind: "input", title: "Name", placeholder: "session name" });
  });

  it("maps a cancelled prompt to the terminal's cancelled values", async () => {
    const { ui } = contextAnswering({ cancelled: true });

    await expect(ui.select("Pick", ["a"])).resolves.toBeUndefined();
    await expect(ui.confirm("Sure?", "really")).resolves.toBe(false);
    await expect(ui.input("Name")).resolves.toBeUndefined();
    await expect(ui.editor("Edit")).resolves.toBeUndefined();
  });

  it("keeps terminal-only chrome inert", () => {
    const { ui } = contextAnswering({ cancelled: true });

    expect(() => ui.setStatus("k", "v")).not.toThrow();
    expect(() => ui.setTitle("x")).not.toThrow();
    expect(ui.getEditorText()).toBe("");
  });
});
