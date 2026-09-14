import { describe, expect, it, vi } from "vitest";
import { createRestartService, successorPlan, waiterScript } from "../src/server/restart-service.js";

function service(options: { build?: () => Promise<string | undefined> } = {}) {
  const shutdown = vi.fn();
  const spawnDetached = vi.fn();
  const restart = createRestartService({
    plan: { command: "node", args: ["src/server/index.ts"], cwd: "/repo" },
    pid: 4242,
    shutdown,
    build: options.build ?? (async () => undefined),
    spawnDetached,
  });
  return { restart, shutdown, spawnDetached };
}

describe("restarting the server from the browser", () => {
  it("queues a successor that waits for this process, then shuts down", async () => {
    const { restart, shutdown, spawnDetached } = service();

    await expect(restart.restart()).resolves.toBeUndefined();

    const [command, args, cwd] = spawnDetached.mock.calls[0]!;
    expect(command).toBe("/bin/sh");
    // The successor is passed as positional arguments to the waiting shell.
    expect(args).toEqual(["-c", waiterScript(4242), "sh", "node", "src/server/index.ts"]);
    expect(cwd).toBe("/repo");
    expect(shutdown).toHaveBeenCalled();
  });

  it("spawns the successor before shutting down, so the port is never orphaned", async () => {
    const order: string[] = [];
    const shutdown = vi.fn(() => void order.push("shutdown"));
    const restart = createRestartService({
      plan: { command: "node", args: [], cwd: "/repo" },
      pid: 1,
      shutdown,
      build: async () => undefined,
      spawnDetached: () => void order.push("spawn"),
    });

    await restart.restart();

    expect(order).toEqual(["spawn", "shutdown"]);
  });

  it("keeps the current server running when the build fails", async () => {
    const { restart, shutdown, spawnDetached } = service({ build: async () => "error TS2339: Property 'nope'" });

    await expect(restart.restart()).resolves.toMatch(/TS2339/);
    expect(spawnDetached).not.toHaveBeenCalled();
    expect(shutdown).not.toHaveBeenCalled();
  });

  it("waits on the old pid so the successor does not race the bound port", () => {
    expect(waiterScript(99)).toContain("kill -0 99");
    expect(waiterScript(99)).toContain('exec "$@"');
  });

  it("reproduces the current process from argv", () => {
    expect(successorPlan(["/bin/node", "server.js", "--flag"], "/work", [])).toEqual({
      command: "/bin/node",
      args: ["server.js", "--flag"],
      cwd: "/work",
    });
  });

  it("keeps the loader flags that let node run typescript", () => {
    // Dropping execArgv makes the successor run a .ts file under bare node, so
    // it dies before binding the port and the restart silently loses the server.
    const plan = successorPlan(["/bin/node", "src/server/index.ts"], "/work", ["--import", "tsx/loader.mjs"]);

    expect(plan.args).toEqual(["--import", "tsx/loader.mjs", "src/server/index.ts"]);
  });
});
