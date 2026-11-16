import { afterEach, it } from "vitest";
import { LoopbackFixtureDriver } from "../infra/loopback-fixture-driver.js";

const fixtures: LoopbackFixtureDriver[] = [];
async function fixture(callerDirectory = false) {
  const driver = await LoopbackFixtureDriver.launch(callerDirectory);
  fixtures.push(driver);
  return driver;
}
afterEach(async () => {
  for (const driver of fixtures.splice(0)) await driver.dispose();
});

it("rejects caller-selected output directories without writing into them", async () => {
  await (await fixture(true)).shouldRejectCallerDirectory();
}, 15_000);

it("announces a private canonical workspace and closes cleanly", async () => {
  await (await fixture()).shouldOwnPrivateWorkspace();
}, 15_000);

it.each(["file", "symlink"] as const)("never overwrites a preexisting cleanup %s", async kind => {
  await (await fixture()).shouldNotOverwriteCleanup(kind);
}, 15_000);
