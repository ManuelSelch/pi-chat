// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Widget } from "../src/shared/protocol.js";
import { WidgetPanel } from "../src/web/chat/WidgetPanel.js";

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
