// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Widget } from "../src/shared/protocol.js";
import {
  placeWidgets,
  WidgetDock,
  WidgetPanel,
  WIDGET_DOCK_MAX_WIDTH,
  WIDGET_DOCK_TOP,
} from "../src/web/chat/WidgetPanel.js";

afterEach(cleanup);

function show(widgets: Widget[]) {
  render(
    <MantineProvider>
      <WidgetPanel widgets={widgets} />
    </MantineProvider>,
  );
}

const todo: Widget = {
  key: "todo",
  lines: ["── Todos ──", "○ #1 Write tests", "✓ #2 Read the docs"],
  placement: "aboveEditor",
};

describe("WidgetPanel", () => {
  it("shows nothing when no extension pushed a panel", () => {
    const { container } = render(
      <MantineProvider>
        <WidgetPanel widgets={[]} />
      </MantineProvider>,
    );
    expect(container.querySelector("pre")).toBeNull();
  });

  it("renders the lines verbatim, as the terminal laid them out", () => {
    show([todo]);

    const block = document.querySelector("pre");
    expect(block?.textContent).toBe("── Todos ──\n○ #1 Write tests\n✓ #2 Read the docs");
    // The extension's own key is the only label the browser has for it.
    expect(screen.getByText("todo")).toBeTruthy();
  });

  it("wraps a long row instead of running it off the side", () => {
    show([{ ...todo, lines: [`○ #1 ${"a very long task ".repeat(8)}`] }]);

    const block = document.querySelector("pre");
    // The alignment spaces a widget draws with still have to survive: it is the
    // overflow that wraps, not every space that collapses.
    expect(block?.style.whiteSpace).toBe("pre-wrap");
    expect(block?.style.overflowWrap).toBe("anywhere");
  });

  it("collapses and expands a panel", () => {
    show([todo]);
    const toggle = screen.getByRole("button", { expanded: true });

    fireEvent.click(toggle);

    expect(document.querySelector("pre")).toBeNull();
    expect(screen.getByText("3 lines")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(document.querySelector("pre")).toBeTruthy();
  });

  it("renders one panel per extension", () => {
    show([todo, { key: "build", lines: ["running…"], placement: "aboveEditor" }]);

    expect(document.querySelectorAll("pre")).toHaveLength(2);
    expect(screen.getByText("build")).toBeTruthy();
  });
});

describe("WidgetDock", () => {
  const below: Widget = { key: "usage", lines: ["42k tokens"], placement: "belowEditor" };

  function dock(widgets: Widget[]) {
    return render(
      <MantineProvider>
        <WidgetDock widgets={widgets} />
      </MantineProvider>,
    );
  }

  it("shows nothing when no extension pushed a panel", () => {
    const { container } = dock([]);
    expect(container.querySelector("pre")).toBeNull();
  });

  it("pins the panels clear of the header rather than letting them scroll", () => {
    dock([todo]);

    const panel = screen.getByLabelText("Extension panels");
    expect(panel.style.position).toBe("fixed");
    // Mantine turns the numbers into scaled rem, so the offset is checked in
    // the unit it actually emits. Sits below the 96px header, not under it.
    expect(panel.style.top).toContain(`${WIDGET_DOCK_TOP / 16}rem`);
    expect(panel.style.right).toContain("1rem");
  });

  it("takes its width from the gutter beside the transcript", () => {
    dock([todo]);

    const width = screen.getByLabelText("Extension panels").style.width;
    // Never wider than the space the centred column leaves over, and never so
    // narrow that the terminal rows are unreadable.
    expect(width).toContain("clamp(200px");
    expect(width).toContain("45rem");
    expect(width).toContain(WIDGET_DOCK_MAX_WIDTH);
  });

  it("scrolls instead of running off the bottom of the window", () => {
    dock([todo]);

    const panel = screen.getByLabelText("Extension panels");
    expect(panel.style.overflowY).toBe("auto");
    expect(panel.style.maxHeight).toContain("100vh");
  });

  it("renders the lines the same way the composer panel does", () => {
    dock([todo, below]);

    const blocks = [...document.querySelectorAll("pre")].map((block) => block.textContent);
    expect(blocks).toEqual(["── Todos ──\n○ #1 Write tests\n✓ #2 Read the docs", "42k tokens"]);
  });
});

describe("choosing where the panels go", () => {
  const above: Widget = { key: "todo", lines: ["a"], placement: "aboveEditor" };
  const under: Widget = { key: "usage", lines: ["b"], placement: "belowEditor" };

  it("keeps the terminal's arrangement when the window is too narrow to dock", () => {
    const placed = placeWidgets([above, under], false);

    expect(placed.above.map((widget) => widget.key)).toEqual(["todo"]);
    expect(placed.below.map((widget) => widget.key)).toEqual(["usage"]);
    expect(placed.docked).toEqual([]);
  });

  it("moves every panel to the dock when there is room beside the transcript", () => {
    const placed = placeWidgets([under, above], true);

    // Nothing is left by the composer, or the panels would show twice.
    expect(placed.above).toEqual([]);
    expect(placed.below).toEqual([]);
    expect(placed.docked.map((widget) => widget.key)).toEqual(["todo", "usage"]);
  });

  it("does not reorder panels that share a placement", () => {
    const first: Widget = { key: "first", lines: ["1"], placement: "aboveEditor" };
    const second: Widget = { key: "second", lines: ["2"], placement: "aboveEditor" };

    expect(placeWidgets([first, second], true).docked.map((widget) => widget.key)).toEqual(["first", "second"]);
  });
});
