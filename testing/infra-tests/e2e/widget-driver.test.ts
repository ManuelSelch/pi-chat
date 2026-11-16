import type { Page } from "@playwright/test";
import { expect, it, vi } from "vitest";
import { BrowserWidgetsDriver } from "../../infra/e2e/browser-widgets-driver.js";
import type { WidgetText } from "../../infra/pi-chat/fixtures/widget-extension-fixture.js";

function setup() {
  const extensions = {
    setWidget: vi.fn(async (_key: string, _content: WidgetText | readonly WidgetText[]) => {}),
    clearWidget: vi.fn(async (_key: string) => {}),
  };
  // Input operations do not touch the page; browser assertions are tested in E2E.
  const widgets = new BrowserWidgetsDriver({} as Page, extensions);
  return { widgets, extensions };
}

it("updates only the requested style while retaining text and decorations", async () => {
  const { widgets, extensions } = setup();
  const widget = widgets.named("status");
  await widget.show("Status", { color: "success", styles: ["bold", "italic", "underline", "strikethrough"] });
  await widget.updateStyle({ color: "error" });
  expect(extensions.setWidget).toHaveBeenLastCalledWith("status", {
    text: "Status", foreground: "error", bold: true, italic: true, underline: true, strikethrough: true,
  });
});

it("shares a named handle and keeps different widgets independent", async () => {
  const { widgets, extensions } = setup();
  const status = widgets.named("status");
  expect(widgets.named("status")).toBe(status);
  await status.show("Status", { color: "success", styles: ["bold"] });
  await widgets.named("other").show("Other", { color: "error" });
  await widgets.named("status").updateStyle({ styles: ["italic"] });
  expect(extensions.setWidget).toHaveBeenLastCalledWith("status", {
    text: "Status", foreground: "success", bold: false, italic: true, underline: false, strikethrough: false,
  });
});

it("replaces styling on show and can explicitly clear color and decorations", async () => {
  const { widgets, extensions } = setup();
  const widget = widgets.named("status");
  await widget.show("Styled", { color: "success", styles: ["bold"] });
  await widget.show("Fresh");
  await widget.updateStyle({ color: undefined, styles: [] });
  expect(extensions.setWidget).toHaveBeenLastCalledWith("status", {
    text: "Fresh", foreground: undefined, bold: false, italic: false, underline: false, strikethrough: false,
  });
});

it("copies caller-owned styles and colors instead of retaining mutable inputs", async () => {
  const { widgets, extensions } = setup();
  const styles: ["bold"] = ["bold"];
  const color: [number, number, number] = [12, 34, 56];
  const widget = widgets.named("status");
  await widget.show("Status", { color, styles });
  styles.pop(); color[0] = 200;
  await widget.updateStyle({});
  expect(extensions.setWidget.mock.lastCall?.[1]).toMatchObject({ foreground: [12, 34, 56], bold: true });
});

it("rejects updates before show or after clear", async () => {
  const { widgets, extensions } = setup();
  const widget = widgets.named("status");
  await expect(widget.updateStyle({ color: "error" })).rejects.toThrow("Show widget status before updating its style");
  await widget.show("Status");
  await widget.clear();
  expect(extensions.clearWidget).toHaveBeenCalledWith("status");
  await expect(widget.updateStyle({ color: "error" })).rejects.toThrow("Show widget status before updating its style");
});

it("does not retain a failed style update", async () => {
  const { widgets, extensions } = setup();
  const widget = widgets.named("status");
  await widget.show("Status", { color: "success" });
  extensions.setWidget.mockRejectedValueOnce(new Error("Fixture rejected update"));
  await expect(widget.updateStyle({ color: "error" })).rejects.toThrow("Fixture rejected update");
  await widget.updateStyle({ styles: ["bold"] });
  expect(extensions.setWidget.mock.lastCall?.[1]).toMatchObject({ text: "Status", foreground: "success", bold: true });
});
