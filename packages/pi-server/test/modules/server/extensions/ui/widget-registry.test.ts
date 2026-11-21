import { describe, expect, it, vi } from "vitest";
import { createWebUiContext } from "../../../../../src/runtime/pi/web-ui-context.js";
import { stripAnsi, WidgetRegistry } from "../../../../../src/extensions/ui/widget-registry.js";

function registry() {
  const onChange = vi.fn();
  return { widgets: new WidgetRegistry(onChange), onChange };
}

describe("WidgetRegistry", () => {
  it("keeps widgets apart by key, in the order they first appeared", () => {
    const { widgets } = registry();

    widgets.set("todo", ["○ #1 Write tests"]);
    widgets.set("build", ["running…"], "belowEditor");
    widgets.set("todo", ["✓ #1 Write tests"]);

    expect(widgets.list()).toEqual([
      { key: "todo", lines: ["✓ #1 Write tests"], placement: "aboveEditor" },
      { key: "build", lines: ["running…"], placement: "belowEditor" },
    ]);
  });

  it("clears a widget on undefined, per Pi's contract", () => {
    const { widgets, onChange } = registry();
    widgets.set("todo", ["○ #1"]);

    widgets.set("todo", undefined);

    expect(widgets.list()).toEqual([]);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("ignores clearing something that was never set", () => {
    const { widgets, onChange } = registry();

    widgets.set("todo", undefined);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not republish unchanged content", () => {
    const { widgets, onChange } = registry();
    widgets.set("todo", ["○ #1"]);

    // A component-backed widget re-renders far more often than it changes.
    widgets.set("todo", ["○ #1"]);
    widgets.set("todo", ["○ #1"]);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("publishes again when only the placement changes", () => {
    const { widgets, onChange } = registry();
    widgets.set("todo", ["○ #1"]);

    widgets.set("todo", ["○ #1"], "belowEditor");

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(widgets.list()[0]!.placement).toBe("belowEditor");
  });

  it("preserves SGR styling while removing cursor controls", () => {
    const { widgets } = registry();
    const styled = "\u001B[32m✓\u001B[0m done";

    widgets.set("todo", ["\u001B[2J" + styled]);

    expect(widgets.list()[0]!.lines).toEqual([styled]);
    // Plain-text consumers still use the original stripping behavior.
    expect(stripAnsi("\u001B[1;31mred\u001B[0m")).toBe("red");
  });

  it("publishes color-only changes but suppresses identical styled content", () => {
    const { widgets, onChange } = registry();
    widgets.set("todo", ["\u001B[31msame\u001B[0m"]);
    widgets.set("todo", ["\u001B[34msame\u001B[0m"]);
    widgets.set("todo", ["\u001B[34msame\u001B[0m"]);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(widgets.list()[0]!.lines).toEqual(["\u001B[34msame\u001B[0m"]);
  });

  it("trims styled spacers without losing retained line styling", () => {
    const { widgets } = registry();
    const line = "\u001B[38;2;12;34;56mcontent";
    widgets.set("todo", [line, "\u001B[0m", "\u001B[44m  \u001B[49m"]);
    expect(widgets.list()[0]!.lines).toEqual([line]);
    widgets.set("todo", ["\u001B[1m \u001B[0m"]);
    expect(widgets.list()).toEqual([]);
  });

  it("drops the trailing spacer rows a terminal widget pads itself with", () => {
    const { widgets } = registry();

    widgets.set("todo", ["── Todos ──", "○ #1", "", ""]);

    expect(widgets.list()[0]!.lines).toEqual(["── Todos ──", "○ #1"]);
  });

  it("treats a widget with nothing but spacing as cleared", () => {
    const { widgets } = registry();
    widgets.set("todo", ["○ #1"]);

    widgets.set("todo", ["", "  "]);

    expect(widgets.list()).toEqual([]);
  });

  it("clears everything at once when its session goes", () => {
    const { widgets, onChange } = registry();
    widgets.set("todo", ["○ #1"]);
    widgets.set("build", ["running…"]);
    onChange.mockClear();

    widgets.clear();

    expect(widgets.list()).toEqual([]);
    expect(onChange).toHaveBeenCalledTimes(1);
    // Nothing left to clear: a second call is silent.
    widgets.clear();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

/**
 * The point of the feature: an extension speaking Pi's documented widget API
 * reaches the browser without any per-extension code in this repo.
 */
describe("an extension pushing a widget through ctx.ui", () => {
  it("reaches the registry as plain lines", () => {
    const published: unknown[] = [];
    const widgets = new WidgetRegistry((list) => published.push(list));
    const ui = createWebUiContext({
      onNotify: vi.fn(),
      onPrompt: vi.fn(async () => ({ cancelled: true as const })),
      onWidget: (key, lines, placement) => widgets.set(key, lines, placement),
    });

    ui.setWidget("todo", ["── Todos ──", "○ #1 Write tests"]);
    ui.setWidget("todo", undefined);

    expect(published).toEqual([
      [{ key: "todo", lines: ["── Todos ──", "○ #1 Write tests"], placement: "aboveEditor" }],
      [],
    ]);
  });
});
