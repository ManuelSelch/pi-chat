// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Widget } from "../../../../../src/shared/protocol.js";
import { WidgetPanel } from "../../../../../src/web/extensions/widgets/WidgetPanel.js";
import {
  WidgetDock,
  WIDGET_DOCK_MAX_WIDTH,
  WIDGET_DOCK_TOP,
} from "../../../../../src/web/extensions/widgets/WidgetDock.js";
import { placeWidgets } from "../../../../../src/web/extensions/widgets/widget-placement.js";

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

  it("renders Markdown syntax as literal widget text", () => {
    show([{ ...todo, lines: ["## Tasks", "", "- **Write** tests", "- Read the docs"] }]);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(document.querySelector(".ansi-widget")?.textContent).toBe("## Tasks\n\n- **Write** tests\n- Read the docs");
    expect(document.querySelector("strong, ul, li")).toBeNull();
    expect(screen.getByText("todo")).toBeTruthy();
  });

  it("preserves indentation, blank lines and Unicode", () => {
    show([{ ...todo, lines: ["First task", "  Second 😀", "", "Third"] }]);
    const content = document.querySelector<HTMLElement>(".ansi-widget")!;
    expect(content.textContent).toBe("First task\n  Second 😀\n\nThird");
    expect(content.style.whiteSpace).toBe("pre-wrap");
  });

  it("keeps Markdown links and URLs literal without linkifying", () => {
    show([{ key: "Preview", lines: ["[Frontend](http://localhost:5174) https://example.com"], placement: "aboveEditor" }]);
    expect(screen.queryByRole("link")).toBeNull();
    expect(document.querySelector(".ansi-widget")?.textContent).toBe("[Frontend](http://localhost:5174) https://example.com");
  });

  it("does not turn unsafe Markdown URLs into links", () => {
    show([{ ...todo, lines: ["[Unsafe](javascript:alert(1))"] }]);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("allows long widget content to wrap", () => {
    show([{ ...todo, lines: [`○ #1 ${"a very long task ".repeat(8)}`] }]);

    expect(document.querySelector(".ansi-widget")?.getAttribute("style")).toContain("overflow-wrap: anywhere");
  });

  it("renders RGB and 256-color foreground/background", () => {
    show([{ ...todo, lines: ["\u001b[38;2;12;34;56mRGB\u001b[0m \u001b[48;5;226m256 background\u001b[0m"] }]);
    expect(screen.getByText("RGB").style.color).toBe("rgb(12, 34, 56)");
    expect(screen.getByText("256 background").style.backgroundColor).toBe("rgb(255, 255, 0)");
  });

  it("combines all decorations and selectively resets them", () => {
    show([{ ...todo, lines: ["\u001b[1;3;4;9mall\u001b[23mno italic\u001b[24mno underline\u001b[29monly bold\u001b[0mplain"] }]);
    const all = screen.getByText("all").style;
    expect(all.fontWeight).toContain("600");
    expect(all.fontStyle).toBe("italic");
    expect(all.textDecoration).toBe("underline line-through");
    expect(screen.getByText("no italic").style.fontStyle).toBe("");
    expect(screen.getByText("no underline").style.textDecoration).toBe("line-through");
    expect(screen.getByText("only bold").style.textDecoration).toBe("");
    expect(document.querySelector(".ansi-widget")?.textContent).toBe("allno italicno underlineonly boldplain");
  });

  it("carries styling across lines but not widgets or subsequent renders", () => {
    const widget = { ...todo, lines: ["\u001b[38;2;12;34;56mfirst", "second"] };
    const { rerender } = render(<MantineProvider><WidgetPanel widgets={[widget, { ...todo, key: "other", lines: ["plain"] }]} /></MantineProvider>);
    const colored = screen.getByText(/first/);
    expect(colored.textContent).toBe("first\nsecond");
    expect(colored.style.color).toBe("rgb(12, 34, 56)");
    expect(screen.getByText("plain").style.color).toBe("");
    rerender(<MantineProvider><WidgetPanel widgets={[{ ...todo, lines: ["fresh"] }]} /></MantineProvider>);
    expect(screen.getByText("fresh").style.color).toBe("");
  });

  it.each([
    ["ST", "\u001b\\", "https://example.com/frontend"],
    ["BEL", "\u0007", "http://localhost:5174"],
  ])("renders a styled HTTP(S) OSC 8 link with %s terminators", (_name, terminator, url) => {
    show([{ ...todo, lines: [`\u001b]8;;${url}${terminator}\u001b[38;2;12;34;56mFrontend\u001b[0m\u001b]8;;${terminator} after`] }]);
    const link = screen.getByRole("link", { name: "Frontend" });
    expect(link.getAttribute("href")).toBe(url);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")?.split(" ")).toEqual(expect.arrayContaining(["noopener", "noreferrer", "nofollow"]));
    expect(screen.getByText("Frontend").style.color).toBe("rgb(12, 34, 56)");
    expect(link.textContent).toBe("Frontend");
    expect(document.querySelector(".ansi-widget")?.textContent).toBe("Frontend after");
  });

  it.each(["javascript:alert(1)", "data:text/html,unsafe", "file:///tmp/example", "mailto:test@example.com"])("keeps OSC 8 destination %s non-clickable", (url) => {
    show([{ ...todo, lines: [`\u001b]8;;${url}\u001b\\link label\u001b]8;;\u001b\\`] }]);
    expect(document.querySelector(".ansi-widget")?.textContent).toBe("link label");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("escapes raw HTML including OSC 8 labels and destinations", () => {
    const html = '<img src=x onerror="alert(1)"><script>alert(1)</script>';
    const url = 'https://example.com/?q="><script>alert(1)</script>';
    show([{ ...todo, lines: ["\u001b[31m" + html + "\u001b[0m", `\u001b]8;;${url}\u001b\\${html}\u001b]8;;\u001b\\`] }]);
    expect(document.querySelector(".ansi-widget")?.textContent).toBe(html + "\n" + html);
    expect(document.querySelector(".ansi-widget img, .ansi-widget script, .ansi-widget [onmouseover]")).toBeNull();
    expect(screen.getByRole("link", { name: html }).getAttribute("href")).toBe(url);
  });

  it("collapses and expands a panel", () => {
    show([todo]);
    const toggle = screen.getByRole("button", { expanded: true });

    fireEvent.click(toggle);

    expect(document.querySelector(".ansi-widget")).toBeNull();
    expect(screen.getByText("3 lines")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(document.querySelector(".ansi-widget")).toBeTruthy();
  });

  it("renders one panel per extension", () => {
    show([todo, { key: "build", lines: ["running…"], placement: "aboveEditor" }]);

    expect(document.querySelectorAll(".ansi-widget")).toHaveLength(2);
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

  it("collapses and expands a docked panel independently", () => {
    dock([todo, below]);

    fireEvent.click(screen.getByRole("button", { name: "todo", expanded: true }));

    expect([...document.querySelectorAll(".ansi-widget")].map((block) => block.textContent)).toEqual(["42k tokens"]);
    expect(screen.getByText("3 lines")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /todo/, expanded: false }));
    expect(document.querySelectorAll(".ansi-widget")).toHaveLength(2);
  });

  it("renders the lines the same way the composer panel does", () => {
    dock([todo, below]);

    const blocks = [...document.querySelectorAll(".ansi-widget")].map((block) => block.textContent);
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

  it("does not mutate the incoming widget order when sorting for the dock", () => {
    const widgets = [under, above];

    expect(placeWidgets(widgets, true).docked.map((widget) => widget.key)).toEqual(["todo", "usage"]);
    expect(widgets.map((widget) => widget.key)).toEqual(["usage", "todo"]);
  });

  it("does not reorder panels that share a placement", () => {
    const first: Widget = { key: "first", lines: ["1"], placement: "aboveEditor" };
    const second: Widget = { key: "second", lines: ["2"], placement: "aboveEditor" };

    expect(placeWidgets([first, second], true).docked.map((widget) => widget.key)).toEqual(["first", "second"]);
  });
});
