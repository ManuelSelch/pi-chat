import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";
import { themeData } from "../infra/v2-fixtures.js";

test("custom Pi palettes color shell, portals and real extension widgets without recoloring old ANSI", async ({ page }) => {
  const app = await PiChatBrowserDriver.start(page, { probeThemeReconnect: true });
  const dark = themeData();
  dark.name = "browser-plum"; dark.colors.accent = "#b982d3";
  const light = { ...themeData(), name: "browser-pine", appearance: "light" as const,
    colors: { ...themeData().colors, text: "#182d25", accent: "#23614c", success: "#28734c" },
    surfaces: { pageBg: "#f6f3e8", cardBg: "#fffdf4", infoBg: "#e6eee4" } };
  try {
    const first = await app.Tabs.Create({ responses: [], theme: dark });
    await app.Theme.shouldUse(dark);
    const widget = app.Widgets.named("palette");
    await widget.show("Pi success", { color: "success", styles: ["bold"] });
    await widget.shouldHaveColor([0, 170, 0]);
    await widget.shouldHaveStyles(["bold"]);
    await app.Settings.Open();
    await app.Theme.shouldThemePortal(dark);
    await app.Settings.Close();
    await app.Skills.ReloadResources();
    await app.Theme.shouldUse(dark);
    await widget.shouldBeAbsent(); // Pi reload clears presentation, not the palette.
    await widget.show("Pi success", { color: "success", styles: ["bold"] });
    await widget.shouldHaveColor([0, 170, 0]);
    const literal = app.Widgets.named("literal");
    await literal.show("Literal RGB", { color: [12, 34, 56] });
    await app.Theme.reconnect();
    await app.Theme.shouldUse(dark);
    await literal.shouldHaveColor([12, 34, 56]);
    const second = await app.Tabs.Create({ responses: [], theme: light });
    await app.Theme.shouldUse(light);
    await app.Settings.Open();
    await app.Theme.shouldThemePortal(light);
    await app.Settings.Close();
    await app.Tabs.SwitchTo(first);
    await app.Theme.shouldUse(dark);
    await widget.shouldHaveColor([0, 170, 0]);
    await literal.shouldHaveColor([12, 34, 56]);
    await app.Tabs.SwitchTo(second);
    await app.Theme.shouldUse(light);
    await app.Browser.Reload();
    await app.Theme.shouldUseDefaults();
  } finally { await app.dispose(); }
});
