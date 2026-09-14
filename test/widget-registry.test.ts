import { describe, expect, it, vi } from "vitest";
import { createWebUiContext } from "../src/server/web-ui-context.js";
import { stripAnsi, WidgetRegistry } from "../src/server/widget-registry.js";

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

  it("strips terminal colour, which the browser would otherwise show verbatim", () => {
    const { widgets } = registry();

    widgets.set("todo", ["\u001B[32m✓\u001B[0m done"]);

    expect(widgets.list()[0]!.lines).toEqual(["✓ done"]);
    expect(stripAnsi("\u001B[1;31mred\u001B[0m")).toBe("red");
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
