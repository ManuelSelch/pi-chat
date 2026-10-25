import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

const statusStyle = { text: "Status", bold: true, italic: true, underline: true, strikethrough: true };
const details = [
  { text: "first\n  second 😀", foreground: [12, 34, 56] as const },
  { text: "" },
  { text: "[Frontend](https://example.com)" },
  { text: '<img src=x onerror="alert(1)">' },
  { text: "longword".repeat(30) },
];

for (const layout of ["docked", "composer"] as const) {
  test(`renders real extension theme colors, updates, reconnect and clearing in ${layout} widgets`, async ({ page }) => {
    const app = await PiChatBrowserDriver.start(page);
    try {
      await app.Widgets.useLayout(layout);
      await app.Tabs.Create({ responses: [] });
      await app.Extensions.setWidget("status", [{ ...statusStyle, foreground: "success" }, ...details]);
      await app.Widgets.shouldShowStyledWidget("success", layout);
      await app.Browser.Reload();
      await app.Widgets.shouldShowStyledWidget("success", layout);
      await app.Extensions.setWidget("status", [{ ...statusStyle, foreground: "error" }, ...details]);
      await app.Widgets.shouldShowStyledWidget("error", layout);
      await app.Extensions.clearWidget("status");
      await app.Widgets.shouldHaveNoWidgets();
    } finally { await app.dispose(); }
  });
}
