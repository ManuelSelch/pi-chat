import { test } from "../infra/e2e/coverage/fixtures.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";
import { themeData } from "../infra/v2-fixtures.js";

test("AppTheme stays fixed while runtime themes color extension widgets and preserve literal ANSI", async ({ page }) => {
  const app = await PiChatBrowserDriver.start(page, { inboxEnabled: false, probeThemeReconnect: true });
  const dark = themeData();
  dark.name = "browser-plum"; dark.colors.accent = "#b982d3";
  const light = { ...themeData(), name: "browser-pine", appearance: "light" as const,
    colors: { ...themeData().colors, text: "#182d25", accent: "#23614c", success: "#28734c" },
    surfaces: { pageBg: "#f6f3e8", cardBg: "#fffdf4", infoBg: "#e6eee4" } };
  try {
    await app.theme.shouldUseAppThemeShell();
    await app.theme.shouldUseNativeTextSelection();
    const first = await app.tabs.create({ responses: [], theme: dark });
    await app.theme.shouldUseAppTheme();
    const widget = app.widgets.named("palette");
    await widget.show("Pi success", { color: "success", styles: ["bold"] });
    await widget.shouldHaveColor([0, 170, 0]);
    await widget.shouldHaveStyles(["bold"]);
    await app.settings.open();
    await app.theme.shouldThemePortalAppTheme();
    await app.settings.close();

    await app.skills.reloadResources();
    await app.theme.shouldUseAppTheme();
    await widget.shouldBeAbsent(); // Pi reload clears presentation, not the runtime palette.
    await widget.show("Pi success", { color: "success", styles: ["bold"] });
    await widget.shouldHaveColor([0, 170, 0]);
    const literal = app.widgets.named("literal");
    await literal.show("Literal RGB", { color: [12, 34, 56] });
    await app.theme.reconnect();
    await app.theme.shouldUseAppTheme();
    await literal.shouldHaveColor([12, 34, 56]);

    const second = await app.tabs.create({ responses: [], theme: light });
    await app.theme.shouldUseAppTheme();
    await app.settings.open();
    await app.theme.shouldThemePortalAppTheme();
    await app.settings.close();

    await app.tabs.switchTo(first);
    await app.theme.shouldUseAppTheme();
    await widget.shouldHaveColor([0, 170, 0]);
    await literal.shouldHaveColor([12, 34, 56]);
    await app.tabs.switchTo(second);
    await app.theme.shouldUseAppTheme();
    await app.theme.rememberLegacyLightAppearance();
    await app.browser.reload();
    await app.theme.shouldUseAppTheme();

    await app.tabs.close(second);
    await app.theme.shouldUseAppTheme();
    await app.tabs.close(first);
    await app.tabs.shouldHaveCount(0);
    await app.home.shouldBeVisible();
    await app.theme.shouldUseAppThemeShell();
    await app.settings.open();
    await app.theme.shouldThemePortalAppTheme();
    await app.settings.close();
  } finally { await app.dispose(); }
});

test("a light runtime palette colors extension output without changing AppTheme", async ({ page }) => {
  const app = await PiChatBrowserDriver.start(page, { inboxEnabled: false });
  const light = { ...themeData(), appearance: "light" as const,
    colors: { ...themeData().colors, accent: "#23614c", success: "#28734c" } };
  try {
    await app.tabs.create({ responses: [], theme: light });
    await app.theme.shouldUseAppTheme();
    const widget = app.widgets.named("light palette");
    await widget.show("Light runtime success", { color: "success" });

    await widget.shouldHaveColor([40, 115, 76]);
    await app.theme.shouldUseAppTheme();
  } finally { await app.dispose(); }
});
