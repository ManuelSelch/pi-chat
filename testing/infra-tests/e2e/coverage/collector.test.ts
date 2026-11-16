import { expect, it, vi } from "vitest";
import { BrowserCoverage } from "../../../infra/e2e/coverage/browser-coverage.js";

it("saves independent intervals before reload and at teardown", async () => {
  const calls: string[] = [];
  let interval = 0;
  const page = { coverage: {
    startJSCoverage: vi.fn(async () => { calls.push("start"); }),
    stopJSCoverage: vi.fn(async () => { calls.push("stop"); return [{ interval: interval++ }]; }),
  } };
  const saved: unknown[] = [];
  const collector = new BrowserCoverage(page as never, async (entries) => { calls.push("save"); saved.push(entries); });
  await collector.start();
  await collector.checkpoint();
  calls.push("reload");
  await collector.finish();
  await collector.finish();
  expect(calls).toEqual(["start", "stop", "save", "start", "reload", "stop", "save"]);
  expect(saved).toEqual([[{ interval: 0 }], [{ interval: 1 }]]);
});

it("does not restart collection when persisting a segment fails", async () => {
  const page = { coverage: { startJSCoverage: vi.fn(async () => {}), stopJSCoverage: vi.fn(async () => []) } };
  const collector = new BrowserCoverage(page as never, async () => { throw new Error("disk full"); });
  await collector.start();
  await expect(collector.checkpoint()).rejects.toThrow("disk full");
  expect(page.coverage.startJSCoverage).toHaveBeenCalledTimes(1);
});
