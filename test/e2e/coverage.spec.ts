import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "../infra/e2e/coverage/fixtures.js";
import { pageCoverage } from "../infra/e2e/coverage/browser-coverage.js";
import { PiChatBrowserDriver } from "../infra/e2e/pi-chat-browser-driver.js";

// Infrastructure regression: inspect the collector, not application scenario behavior.
test("coverage retains executed scripts across a real browser reload", async ({ page }, testInfo) => {
  test.skip(process.env.PI_CHAT_COVERAGE !== "1", "Only exercises the opt-in collector");
  const app = await PiChatBrowserDriver.start(page);
  try {
    await page.evaluate("(() => { function coverageBeforeReload() { return 41; } coverageBeforeReload(); })();\n//# sourceURL=coverage-probe-before.js");
    await app.Tabs.Create({ responses: [{ prompt: "Before reload", reply: "Saved" }] });
    await app.Chat.SendPrompt("Before reload");
    await app.Chat.ShouldShowAssistantReply("Saved");
    await app.Browser.Reload();
    await page.evaluate("(() => { function coverageAfterReload() { return 42; } coverageAfterReload(); })();\n//# sourceURL=coverage-probe-after.js");
    await app.Chat.ShouldShowAssistantReply("Saved");
    await pageCoverage.get(page)!.checkpoint();
    const dir = "coverage-e2e/raw/browser";
    const files = (await readdir(dir)).filter((name) => name.includes(testInfo.testId));
    expect(files).toHaveLength(2);
    const segments = await Promise.all(files.map(async (name) => JSON.parse(await readFile(join(dir, name), "utf8")) as Array<{ url: string; functions: Array<{ functionName: string; ranges: Array<{ count: number }> }> }>));
    for (const name of ["coverageBeforeReload", "coverageAfterReload"]) {
      const containing = segments.filter((entries) => entries.some((entry) => entry.functions.some((fn) => fn.functionName === name && fn.ranges.some((range) => range.count > 0))));
      expect(containing).toHaveLength(1);
    }
    // Both intervals also contain the real source-mapped application bundle.
    for (const entries of segments) expect(entries.some((entry) => new URL(entry.url, "http://localhost").pathname.startsWith("/assets/"))).toBe(true);
  } finally {
    await app.dispose();
  }
});
