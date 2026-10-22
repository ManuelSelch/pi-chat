import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ spawnSync: vi.fn(), execFileSync: vi.fn(), resolveNpmCli: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawnSync, execFileSync: mocks.execFileSync }));
vi.mock("../../src/shared/node/npm-command.ts", () => ({ resolveNpmCli: mocks.resolveNpmCli }));
const cwd = process.cwd();
beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); mocks.resolveNpmCli.mockReturnValue("/installed/npm/bin/npm-cli.js"); });
afterEach(() => { process.chdir(cwd); });

it("README capture uses the running Node and resolved CLI for its build", async () => {
  const stop = new Error("stop before browser setup");
  mocks.spawnSync.mockImplementation(() => { throw stop; });
  await expect(import("../../scripts/capture-readme.ts")).rejects.toBe(stop);
  expect(mocks.spawnSync).toHaveBeenCalledExactlyOnceWith(process.execPath, ["/installed/npm/bin/npm-cli.js", "run", "build"], { stdio: "inherit" });
});

it("SDK verification preserves pack and offline install arguments with explicit Node/npm", async () => {
  const stop = new Error("stop before consumer setup");
  mocks.execFileSync.mockImplementationOnce((_node, args) => {
    writeFileSync(join(args[3], "sdk.tgz"), "test tarball placeholder");
  }).mockImplementationOnce(() => { throw stop; });
  await expect(import("../../packages/pi-sdk/typescript/scripts/verify-package.mjs")).rejects.toBe(stop);
  const [[packNode, packArgs, packOptions], [installNode, installArgs, installOptions]] = mocks.execFileSync.mock.calls;
  expect(packNode).toBe(process.execPath); expect(installNode).toBe(process.execPath);
  expect(packArgs).toEqual(["/installed/npm/bin/npm-cli.js", "pack", "--pack-destination", expect.any(String)]);
  expect(packOptions).toEqual({ cwd: join(cwd, "packages/pi-sdk/typescript/"), stdio: "pipe" });
  expect(installArgs).toEqual(["/installed/npm/bin/npm-cli.js", "install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", join(packArgs[3], "sdk.tgz")]);
  expect(installOptions).toEqual({ cwd: packArgs[3], stdio: "pipe" });
});
