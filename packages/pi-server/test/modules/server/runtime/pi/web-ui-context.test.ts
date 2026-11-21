import { describe, expect, it, vi } from "vitest";
import type { UiPromptResult } from "@manuelselch/pi-sdk/protocol";
import { createWebUiContext } from "../../../../../src/runtime/pi/web-ui-context.js";

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

  it("provides deterministic real theme colors and combined decorations for widgets", () => {
    const { ui } = contextAnswering({ cancelled: true });
    const other = contextAnswering({ cancelled: true }).ui;
    const text = ui.theme.bold(ui.theme.italic(ui.theme.underline(ui.theme.strikethrough("styled"))));
    expect(text).toContain("\u001b[1m");
    expect(text).toContain("\u001b[3m");
    expect(text).toContain("\u001b[4m");
    expect(text).toContain("\u001b[9m");
    expect(ui.theme.fg("success", "ok")).toMatch(/\u001b\[38;2;\d+;\d+;\d+m/);
    expect(ui.theme.fg("success", "ok")).toBe(other.theme.fg("success", "ok"));
    expect(ui.theme).not.toBe(other.theme);
    expect(ui.theme.getColorMode()).toBe("truecolor");
  });

  it("keeps themed notifications plain text", () => {
    const onNotify = vi.fn();
    const ui = createWebUiContext({ onNotify, onPrompt: async () => ({ cancelled: true }) });
    ui.notify(ui.theme.fg("warning", ui.theme.bold("Warning")), "warning");
    expect(onNotify).toHaveBeenCalledWith("Warning", "warning");
  });

  it("asks the browser and returns the chosen value", async () => {
    const { ui, onPrompt } = contextAnswering({ cancelled: false, value: "second" });

    await expect(ui.select("Pick one", ["first", "second"])).resolves.toBe("second");
    expect(onPrompt).toHaveBeenCalledWith({ kind: "select", title: "Pick one", options: ["first", "second"], submission: "immediate" });
  });

  it("keeps themed dialog content plain text", async () => {
    const { ui, onPrompt } = contextAnswering({ cancelled: true });
    const styled = ui.theme.bold("label");
    await ui.select(styled, [styled]);
    await ui.confirm(styled, styled);
    await ui.input(styled, styled);
    await ui.editor(styled, styled);
    expect(onPrompt.mock.calls.map(([request]) => request)).toEqual([
      { kind: "select", title: "label", options: ["label"], submission: "immediate" },
      { kind: "confirm", title: "label", message: "label" },
      { kind: "input", title: "label", placeholder: "label" },
      { kind: "editor", title: "label", prefill: "label" },
    ]);
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

  /**
   * Throwing here used to abort the extension mid-flight: a `tool_call` hook
   * that asks for confirmation this way failed the tool call outright instead
   * of falling back to its own default, which blocked `rm -rf` entirely.
   */
  it("returns undefined from custom(), as Pi's own RPC mode does", async () => {
    const { ui } = contextAnswering({ cancelled: true });

    await expect(ui.custom(() => ({ render: () => [] }) as never)).resolves.toBeUndefined();
  });

  describe("widgets", () => {
    function contextWithWidgets() {
      const onWidget = vi.fn();
      const ui = createWebUiContext({
        onNotify: vi.fn(),
        onPrompt: vi.fn(async () => ({ cancelled: true as const })),
        onWidget,
      });
      return { ui, onWidget };
    }

    it("forwards lines and defaults to the placement the terminal uses", () => {
      const { ui, onWidget } = contextWithWidgets();

      ui.setWidget("todo", ["○ #1 Write tests"]);
      ui.setWidget("build", ["running…"], { placement: "belowEditor" });

      expect(onWidget.mock.calls).toEqual([
        ["todo", ["○ #1 Write tests"], "aboveEditor"],
        ["build", ["running…"], "belowEditor"],
      ]);
    });

    it("forwards a clear", () => {
      const { ui, onWidget } = contextWithWidgets();

      ui.setWidget("todo", undefined);

      expect(onWidget).toHaveBeenCalledWith("todo", undefined, "aboveEditor");
    });

    it("ignores component factories, which have no serialized form", () => {
      const { ui, onWidget } = contextWithWidgets();

      ui.setWidget("todo", () => ({ render: () => ["○ #1"] }) as never);

      expect(onWidget).not.toHaveBeenCalled();
    });

    it("stays inert when the host wires no widget handler", () => {
      const { ui } = contextAnswering({ cancelled: true });

      expect(() => ui.setWidget("todo", ["○ #1"])).not.toThrow();
    });
  });
});
