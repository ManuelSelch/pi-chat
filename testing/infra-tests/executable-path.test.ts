import { afterEach, beforeEach, describe, it } from "vitest";
import { ExecutablePathDriver } from "../infra/executable-path-driver.js";

let driver: ExecutablePathDriver;
beforeEach(async () => { driver = await ExecutablePathDriver.create(); });
afterEach(async () => { await driver?.dispose(); });

describe("installation-bound executable resolution", () => {
  it.each([false, true])("supports an installed npm symlink (external package: %s)", async (external) => {
    await driver.shouldResolveInstalledCli(external);
  });
  it("ignores poisoned PATH and npm_execpath while retaining arguments", async () => {
    await driver.shouldIgnorePoisonedLookup();
  });
  it.each(["missing", "metadata", "bin", "json", "filename", "directory", "relative"] as const)("fails closed for %s installation input", async (kind) => {
    await driver.shouldRejectInvalidInstallation(kind);
  });
  it("runs the real npm CLI through native Node with a poisoned PATH", async () => {
    await driver.shouldRunRealNpmWithoutPathLookup();
  });
  it("uses fixed system tools despite poisoned PATH entries", async () => {
    await driver.shouldUseRealSystemTools();
  });
});
