import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";
import { themeData } from "../infra/v2-fixtures.js";

test("custom Pi palettes color shell, portals and real extension widgets without recoloring old ANSI", async ({ page }) => {
  const app = await PiChatBrowserDriver.start(page, { inboxEnabled: false, probeThemeReconnect: true });
  const dark = themeData();
  dark.name = "browser-plum"; dark.colors.accent = "#b982d3";
  const light = { ...themeData(), name: "browser-pine", appearance: "light" as const,
    colors: { ...themeData().colors, text: "#182d25", accent: "#23614c", success: "#28734c" },
    surfaces: { pageBg: "#f6f3e8", cardBg: "#fffdf4", infoBg: "#e6eee4" } };
  try {
    const first = await app.tabs.create({ responses: [], theme: dark });
    await app.theme.shouldUse(dark);
    const widget = app.widgets.named("palette");
    await widget.show("Pi success", { color: "success", styles: ["bold"] });
    await widget.shouldHaveColor([0, 170, 0]);
    await widget.shouldHaveStyles(["bold"]);
    await app.settings.open();
    await app.theme.shouldThemePortal(dark);
    await app.settings.close();
    await app.skills.reloadResources();
    await app.theme.shouldUse(dark);
    await widget.shouldBeAbsent(); // Pi reload clears presentation, not the palette.
    await widget.show("Pi success", { color: "success", styles: ["bold"] });
    await widget.shouldHaveColor([0, 170, 0]);
    const literal = app.widgets.named("literal");
    await literal.show("Literal RGB", { color: [12, 34, 56] });
    await app.theme.reconnect();
    await app.theme.shouldUse(dark);
    await literal.shouldHaveColor([12, 34, 56]);
    const second = await app.tabs.create({ responses: [], theme: light });
    await app.theme.shouldUse(light);
    await app.settings.open();
    await app.theme.shouldThemePortal(light);
    await app.settings.close();
    await app.tabs.switchTo(first);
    await app.theme.shouldUse(dark);
    await widget.shouldHaveColor([0, 170, 0]);
    await literal.shouldHaveColor([12, 34, 56]);
    await app.tabs.switchTo(second);
    await app.theme.shouldUse(light);
    await app.browser.reload();
    await app.theme.shouldUse(light);
    await app.tabs.close(second);
    // Initialization after refresh has no SDK palettes; remembered appearance stays.
    await app.theme.shouldUse(light);
    await app.tabs.close(first);
    await app.tabs.shouldHaveCount(0);
    await app.home.shouldBeVisible();
    await app.theme.shouldUseShell(light);
    await app.settings.open();
    await app.theme.shouldThemePortal(light);
    await app.settings.close();
  } finally { await app.dispose(); }
});
