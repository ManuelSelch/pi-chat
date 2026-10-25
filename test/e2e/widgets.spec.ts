import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

for (const layout of ["docked", "composer"] as const) {
  test.describe(`${layout} widgets`, () => {
    let app: PiChatBrowserDriver;
    test.beforeEach(async ({ page }) => {
      app = await PiChatBrowserDriver.start(page);
      await app.Widgets.useLayout(layout);
      await app.Tabs.Create({ responses: [] });
    });
    test.afterEach(async () => { await app?.dispose(); });

    test("retains text and decorations through color-only updates, reload and clearing", async () => {
      const widget = app.Widgets.named("status");
      const styles = ["bold", "italic", "underline", "strikethrough"] as const;

      await widget.show("Status", { color: "success", styles });
      await widget.shouldHaveText("Status");
      await widget.shouldHaveColor("success");
      await widget.shouldHaveStyles(styles);
      await app.Widgets.shouldUseLayout(layout);

      await app.Browser.Reload();
      await widget.shouldHaveText("Status");
      await widget.shouldHaveColor("success");
      await widget.shouldHaveStyles(styles);

      await widget.updateStyle({ color: "error" });
      await widget.shouldHaveText("Status");
      await widget.shouldHaveColor("error");
      await widget.shouldHaveStyles(styles);

      await widget.updateStyle({ styles: [] });
      await widget.shouldHaveColor("error");
      await widget.shouldHaveStyles([]);
      await widget.clear();
      await widget.shouldBeAbsent();
    });

    test("opens an OSC 8 hyperlink destination in a new tab", async () => {
      const widget = app.Widgets.named("preview");
      const url = "https://widget-link.test/frontend";

      await widget.showHyperlink("Frontend", url);
      await widget.shouldHaveText("Frontend");
      await app.Widgets.shouldUseLayout(layout);
      await widget.shouldOpenLinkInNewTab("Frontend", url);
    });

    test("preserves multiline text and wraps without interpreting Markdown or HTML", async () => {
      const widget = app.Widgets.named("details");
      const text = 'first\n  second 😀\n\n[Frontend](https://example.com)\n<img src=x onerror="alert(1)">\n' + "longword".repeat(30);

      await widget.show(text, { color: [12, 34, 56] });
      await widget.shouldHaveText(text);
      await widget.shouldHaveColor([12, 34, 56]);
      await widget.shouldWrapText();
      await widget.shouldContainNoMarkupOrLinks();
      await app.Widgets.shouldUseLayout(layout);
    });
  });
}
