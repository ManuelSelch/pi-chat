import { expect, test } from "@playwright/test";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

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
