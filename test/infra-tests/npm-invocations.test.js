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
