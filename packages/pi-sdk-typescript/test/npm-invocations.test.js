import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ execFileSync: vi.fn(), resolveNpmCli: vi.fn() }));
vi.mock("node:child_process", () => ({ execFileSync: mocks.execFileSync }));
vi.mock("../scripts/npm-command.ts", () => ({ resolveNpmCli: mocks.resolveNpmCli }));
const cwd = process.cwd();
beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); mocks.resolveNpmCli.mockReturnValue("/installed/npm/bin/npm-cli.js"); });

it("SDK verification permits uncached dependencies while preserving safe install arguments", async () => {
  const stop = new Error("stop before consumer setup");
  mocks.execFileSync.mockImplementationOnce((_node, args) => {
    writeFileSync(join(args[3], "sdk.tgz"), "test tarball placeholder");
  }).mockImplementationOnce(() => { throw stop; });
  await expect(import("../scripts/verify-package.mjs")).rejects.toBe(stop);
  const [[packNode, packArgs, packOptions], [installNode, installArgs, installOptions]] = mocks.execFileSync.mock.calls;
  expect(packNode).toBe(process.execPath); expect(installNode).toBe(process.execPath);
  expect(packArgs).toEqual(["/installed/npm/bin/npm-cli.js", "pack", "--pack-destination", expect.any(String)]);
  expect(packOptions).toEqual({ cwd: join(cwd, "/"), stdio: "pipe" });
  expect(installArgs).toEqual(["/installed/npm/bin/npm-cli.js", "install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", join(packArgs[3], "sdk.tgz")]);
  expect(installOptions).toEqual({ cwd: packArgs[3], stdio: "pipe" });
});
