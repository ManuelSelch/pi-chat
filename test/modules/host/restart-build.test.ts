import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRestartService } from "../../../src/host/restart-service.js";

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), resolveNpmCli: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("../../../src/shared/node/npm-command.js", () => ({ resolveNpmCli: mocks.resolveNpmCli }));

beforeEach(() => { vi.resetAllMocks(); mocks.resolveNpmCli.mockReturnValue("/installation/npm/bin/npm-cli.js"); });

function fixture(outcome: number | Error = 0) {
  mocks.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
    queueMicrotask(() => {
      if (outcome instanceof Error) child.emit("error", outcome);
      else { child.stderr.emit("data", "build detail\n"); child.emit("close", outcome); }
    });
    return child as unknown as ChildProcess;
  });
  const shutdown = vi.fn(); const spawnDetached = vi.fn();
  const restart = createRestartService({ plan: { command: process.execPath, args: ["server.js"], cwd: "/project" }, shutdown, spawnDetached });
  return { restart, shutdown, spawnDetached };
}

describe("restart's default build invocation", () => {
  it("uses the running Node executable and resolved npm CLI with unchanged build arguments", async () => {
    const { restart, shutdown, spawnDetached } = fixture();
    await expect(restart.restart()).resolves.toBeUndefined();
    expect(mocks.resolveNpmCli).toHaveBeenCalledOnce();
    expect(mocks.spawn).toHaveBeenCalledExactlyOnceWith(process.execPath, ["/installation/npm/bin/npm-cli.js", "run", "build"], { cwd: "/project", stdio: ["ignore", "pipe", "pipe"] });
    expect(spawnDetached).toHaveBeenCalledOnce(); expect(shutdown).toHaveBeenCalledOnce();
  });

  it("keeps the server alive and does not spawn anything when npm resolution fails", async () => {
    const { restart, shutdown, spawnDetached } = fixture();
    mocks.resolveNpmCli.mockImplementation(() => { throw new Error("Unsupported npm installation"); });
    await expect(restart.restart()).resolves.toMatch(/could not run npm run build: Unsupported npm installation/);
    expect(mocks.spawn).not.toHaveBeenCalled(); expect(spawnDetached).not.toHaveBeenCalled(); expect(shutdown).not.toHaveBeenCalled();
  });

  it("keeps the server alive if spawning Node fails", async () => {
    const { restart, shutdown, spawnDetached } = fixture(new Error("spawn failed"));
    await expect(restart.restart()).resolves.toMatch(/spawn failed/);
    expect(spawnDetached).not.toHaveBeenCalled(); expect(shutdown).not.toHaveBeenCalled();
  });

  it("keeps the server alive and retains build diagnostics on a nonzero exit", async () => {
    const { restart, shutdown, spawnDetached } = fixture(1);
    await expect(restart.restart()).resolves.toBe("build detail");
    expect(spawnDetached).not.toHaveBeenCalled(); expect(shutdown).not.toHaveBeenCalled();
  });
});
