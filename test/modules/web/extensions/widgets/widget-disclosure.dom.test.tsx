// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, type RenderResult } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { Widget } from "../../../../../src/shared/protocol.js";
import { WidgetDisclosureProvider } from "../../../../../src/web/extensions/widgets/app/WidgetDisclosureProvider.js";
import { WidgetPanel } from "../../../../../src/web/extensions/widgets/WidgetPanel.js";
import { WidgetDock } from "../../../../../src/web/extensions/widgets/WidgetDock.js";

class WidgetDisclosureDriver {
  private view?: RenderResult;

  showSession(session: string, keys = ["todo"], docked = false) {
    const widgets: Widget[] = keys.map(key => ({ key, lines: [`${session} content`], placement: "aboveEditor" }));
    const tree = <MantineProvider><WidgetDisclosureProvider>{docked
      ? <WidgetDock key={session} widgets={widgets} />
      : <WidgetPanel key={session} widgets={widgets} grid />}</WidgetDisclosureProvider></MantineProvider>;
    if (this.view) this.view.rerender(tree);
    else this.view = render(tree);
  }

  toggle(key: string) {
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${key}(?:$| )`) }));
  }

  shouldBeOpen(key: string, open: boolean) {
    expect(screen.getByRole("button", { name: new RegExp(`^${key}(?:$| )`) }).getAttribute("aria-expanded")).toBe(String(open));
    expect(screen.queryByRole("region", { name: `${key} widget` }) !== null).toBe(open);
  }

  reload() {
    this.view?.unmount();
    this.view = undefined;
  }
}

let app: WidgetDisclosureDriver;
beforeEach(() => { app = new WidgetDisclosureDriver(); });
afterEach(cleanup);

it("remembers a widget's disclosure across sessions and explicit reopening", () => {
  app.showSession("first", ["todo", "build"]);
  app.shouldBeOpen("todo", true);
  app.toggle("todo");
  app.shouldBeOpen("build", true);

  app.showSession("second");
  app.shouldBeOpen("todo", false);
  app.toggle("todo");

  app.showSession("first");
  app.shouldBeOpen("todo", true);
});

it("retains collapsed preferences when a widget disappears and returns with new content", () => {
  app.showSession("first");
  app.toggle("todo");
  app.showSession("empty", []);

  app.showSession("updated");
  app.shouldBeOpen("todo", false);
});

it("retains disclosure when moving between inline and docked layouts", () => {
  app.showSession("first");
  app.toggle("todo");

  app.showSession("first", ["todo"], true);
  app.shouldBeOpen("todo", false);

  app.showSession("first");
  app.shouldBeOpen("todo", false);
});

it("starts expanded again after a page-lifetime reset", () => {
  app.showSession("first");
  app.toggle("todo");

  app.reload();
  app.showSession("first");
  app.shouldBeOpen("todo", true);
});
