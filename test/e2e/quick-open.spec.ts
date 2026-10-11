import { expect, test } from "@playwright/test";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

test("shares session actions between composer and quickswitcher", async ({ page }) => {
  const app = await PiChatBrowserDriver.start(page);
  try {
    await app.Tabs.Create({ responses: [{ prompt: "Hello", reply: "Ready" }] });
    await app.Chat.SendPrompt("Hello");
    await app.Chat.ShouldShowAssistantReply("Ready");
    const composer = page.getByRole("textbox", { name: "Message Pi" });
    await composer.fill("/");
    const commands = page.getByRole("listbox", { name: "Commands" });
    for (const name of ["New session", "Close tab", "Archive session", "Open folder…", "Open settings"]) {
      await expect(commands.getByRole("option", { name: new RegExp(name) })).toBeVisible();
    }
    await composer.press("Escape");
    await composer.fill("");
    await composer.press("Meta+o");
    await page.getByRole("button", { name: "/ Actions", exact: true }).click();
    for (const name of ["New session", "Close tab", "Archive session", "Open folder…", "Open settings"]) {
      await expect(page.getByRole("option", { name: new RegExp(`Action: ${name}`) })).toBeVisible();
    }
    await page.getByRole("option", { name: /Action: Close tab/ }).click();
    await app.Home.ShouldBeVisible();
    await page.locator("body").press("Meta+o");
    await page.getByRole("button", { name: "/ Actions", exact: true }).click();
    await expect(page.getByRole("option", { name: /Action: Close tab/ })).toHaveCount(0);
    await expect(page.getByRole("option", { name: /Action: Archive session/ })).toHaveCount(0);
    await expect(page.getByRole("option", { name: /Action: New session/ })).toBeVisible();
  } finally {
    await app.dispose();
  }
});

// Run against the complete production stylesheet stack, not just component CSS.
test("shows keyboard selection and compact mockup scope controls", async ({ page }) => {
  const app = await PiChatBrowserDriver.start(page);
  try {
    await page.locator("body").press("Meta+o");
    const input = page.getByRole("textbox", { name: "Search folders, worktrees, sessions and actions" });
    await expect(input).toBeFocused();
    const actions = page.getByRole("button", { name: "/ Actions", exact: true });
    await expect(actions).toHaveCSS("font-size", "12px");
    await expect(actions).toHaveCSS("padding", "4px 6px");
    for (const [label, prefix] of [["# Folders", "#"], ["% Worktrees", "%"], ["@ Sessions", "@"], ["/ Actions", "/"], ["All", ""]] as const) {
      await input.press("Tab");
      await expect(input).toBeFocused();
      await expect(input).toHaveValue(prefix);
      await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
    }
    await input.press("Shift+Tab");
    await expect(input).toHaveValue("/");
    await expect(input).toBeFocused();
    await actions.click();
    await expect(input).toBeFocused();
    const rows = page.getByRole("option");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toHaveAttribute("aria-selected", "true");
    await input.press("ArrowDown");
    await expect(rows.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(rows.nth(1)).toHaveCSS("border-top-width", "1px");
    await expect(rows.nth(1)).toHaveCSS("border-top-style", "solid");
    await expect(rows.nth(1)).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const border = await rows.nth(1).evaluate((row) => getComputedStyle(row).borderTopColor);
    expect(border).not.toBe("rgba(0, 0, 0, 0)");
    await input.press("ArrowUp");
    await expect(rows.nth(0)).toHaveAttribute("aria-selected", "true");
    await input.press("Escape");
    await expect(input).not.toBeVisible();
  } finally {
    await app.dispose();
  }
});
