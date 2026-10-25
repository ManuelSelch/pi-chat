import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";
import { coloredWidgetExtension } from "../infra/pi-chat/fixtures/colored-widget-extension.js";

for (const layout of ["docked", "composer"] as const) {
  test(`renders real extension theme colors, updates, reconnect and clearing in ${layout} widgets`, async ({ page }) => {
    const app = await PiChatBrowserDriver.start(page, { extensions: [coloredWidgetExtension] });
    try {
      await app.Widgets.useLayout(layout);
      await app.Tabs.Create({ responses: [] });
      await app.Widgets.show();
      await app.Widgets.shouldShowStyledWidget("success", layout);
      await app.Browser.Reload();
      await app.Widgets.shouldShowStyledWidget("success", layout);
      await app.Widgets.changeColor();
      await app.Widgets.shouldShowStyledWidget("error", layout);
      await app.Widgets.clear();
      await app.Widgets.shouldHaveNoWidgets();
    } finally { await app.dispose(); }
  });
}
