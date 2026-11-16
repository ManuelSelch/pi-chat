import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";
import { test as base } from "@playwright/test";
import { BrowserCoverage, pageCoverage } from "./browser-coverage.js";

export { expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    if (process.env.PI_CHAT_COVERAGE !== "1") {
      await use(page);
      return;
    }
    const dir = resolve("coverage-e2e/raw/browser");
    await mkdir(dir, { recursive: true });
    const collector = new BrowserCoverage(page, async (entries) => {
      const name = `${testInfo.workerIndex}-${testInfo.testId}-${testInfo.retry}-${randomUUID()}.json`;
      await writeFile(join(dir, name), JSON.stringify(entries));
    });
    pageCoverage.set(page, collector);
    await collector.start();
    try {
      await use(page);
    } finally {
      try { await collector.finish(); }
      finally { pageCoverage.delete(page); }
    }
  },
});
