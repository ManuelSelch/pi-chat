import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from "vitest";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import piChatExtension from "../../../extension/pi-chat.js";

const mocks = vi.hoisted(() => ({ record: undefined as object | undefined, spawn: vi.fn(), write: vi.fn(), remove: vi.fn(), mkdir: vi.fn(), resolveNpmCli: vi.fn() }));
vi.mock("../../../src/shared/node/npm-command.js", () => ({ resolveNpmCli: mocks.resolveNpmCli }));
vi.mock("node:fs", () => ({
  existsSync: (path: string) => path.endsWith("package.json") || !!mocks.record,
  readFileSync: () => JSON.stringify(mocks.record), realpathSync: (path: string) => path,
  writeFileSync: mocks.write, rmSync: mocks.remove, mkdirSync: mocks.mkdir,
}));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
type Command = Parameters<ExtensionAPI["registerCommand"]>[1];
let command: Command;
let register: ReturnType<typeof vi.fn>;
let notify: ReturnType<typeof vi.fn>;
let exec: ReturnType<typeof vi.fn>;
let kill: MockInstance<typeof process.kill>;
let health: ReturnType<typeof vi.fn>;
const running = { pid: 12345, port: 9898, cwd: "/project", nodePath: "/trusted/node", restartSignal: "SIGUSR2" };
beforeEach(() => {
  vi.useFakeTimers();
  mocks.record = undefined;
  mocks.spawn.mockReset(); mocks.write.mockReset(); mocks.remove.mockReset(); mocks.mkdir.mockReset(); mocks.resolveNpmCli.mockReset().mockReturnValue("/trusted/npm-cli.js");
  notify = vi.fn(); exec = vi.fn(async () => ({ code: 0, stdout: "", stderr: "", killed: false }));
  register = vi.fn((name: string, value: Command) => { if (name === "pi-chat") command = value; });
  kill = vi.spyOn(process, "kill").mockImplementation(() => true);
  health = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  vi.stubGlobal("fetch", health);
  piChatExtension({ registerCommand: register, exec } as unknown as ExtensionAPI);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function run(args: string) {
  return command.handler(args, { cwd: "/project", ui: { notify } } as unknown as ExtensionCommandContext);
}

it("registers only pi-chat and completes lifecycle subcommands", async () => {
  expect(register.mock.calls.map(([name]) => name)).toEqual(["pi-chat"]);
  expect(await command.getArgumentCompletions!("")).toEqual(["start", "stop", "restart"].map(value => ({ value, label: value })));
  expect(await command.getArgumentCompletions!("st")).toEqual(["start", "stop"].map(value => ({ value, label: value })));
  expect(await command.getArgumentCompletions!("start ")).toBeNull();
});
it("shows status with no arguments and never signals a restart", async () => {
  mocks.record = running;

  await run("");

  expect(notify).toHaveBeenCalledWith(expect.stringContaining("running on"), "info");
  expect(kill).not.toHaveBeenCalledWith(running.pid, "SIGUSR2");
});
it.each(["invalid", "stop extra", "restart extra"])("rejects invalid usage: %s", async args => {
  await run(args);

  expect(notify).toHaveBeenCalledWith(expect.stringContaining("Usage:"), "warning");
  expect(kill).not.toHaveBeenCalled();
  expect(exec).not.toHaveBeenCalled();
});
it("start preserves already-running behavior without a rebuild or browser when --no-open", async () => {
  mocks.record = running;

  await run("start --no-open");

  expect(notify).toHaveBeenCalledWith(expect.stringContaining("already runs"), "info");
  expect(exec).not.toHaveBeenCalled(); expect(mocks.spawn).not.toHaveBeenCalled();
});
it("start preserves port and project options when launching", async () => {
  health.mockRejectedValueOnce({ cause: { code: "ECONNREFUSED" } });
  const child = Object.assign(new EventEmitter(), { pid: 56789, unref: vi.fn(), kill: vi.fn() });
  mocks.spawn.mockReturnValue(child);

  await run("start --port 9988 --cwd /chosen --no-open");

  expect(mocks.spawn).toHaveBeenCalledWith(process.execPath, expect.any(Array), expect.objectContaining({
    env: expect.objectContaining({ PI_CHAT_PORT: "9988", PI_CHAT_CWD: "/chosen" }), detached: true,
  }));
  expect(exec).toHaveBeenCalledWith("npm", ["run", "build"], expect.any(Object));
});
it("stop terminates the managed process group", async () => {
  mocks.record = running;
  health.mockRejectedValue({ cause: { code: "ECONNREFUSED" } });

  await run("stop");

  expect(kill).toHaveBeenCalledWith(-running.pid, "SIGTERM");
  expect(notify).toHaveBeenCalledWith(expect.stringContaining("stopped"), "info");
});
it.each([0, -1, 1.5, "12345", null])("rejects unsafe PID %s before probing or signaling it", async pid => {
  mocks.record = { ...running, pid };

  await run("restart");

  expect(kill).not.toHaveBeenCalled();
  expect(notify).toHaveBeenCalledWith(expect.stringContaining("managed"), "warning");
});
it("does not start a concurrent restart when the lock is held", async () => {
  mocks.mkdir.mockImplementation(() => { throw new Error("already exists"); });

  await run("restart");

  expect(notify).toHaveBeenLastCalledWith(expect.stringContaining("restart lock"), "error");
  expect(exec).not.toHaveBeenCalled();
  expect(kill).not.toHaveBeenCalled();
});
it("restart refuses unmanaged servers", async () => {
  await run("restart");

  expect(notify).toHaveBeenCalledWith(expect.stringContaining("managed"), "warning");
  expect(kill).not.toHaveBeenCalled();
});
it("restart refuses a PID record without explicit signal support", async () => {
  mocks.record = { pid: running.pid, port: running.port, cwd: running.cwd };

  await run("restart");

  expect(notify).toHaveBeenCalledWith(expect.stringContaining("support"), "error");
  expect(kill).not.toHaveBeenCalledWith(running.pid, "SIGUSR2");
});
it("refuses to replace a server whose Node executable is unavailable", async () => {
  mocks.record = { ...running, nodePath: "" };

  await run("restart");

  expect(exec).not.toHaveBeenCalled();
  expect(kill).not.toHaveBeenCalledWith(running.pid, "SIGUSR2");
  expect(notify).toHaveBeenLastCalledWith(expect.stringContaining("Node executable"), "error");
});
it("restart refuses unhealthy servers", async () => {
  mocks.record = running;
  health.mockRejectedValue({ cause: { code: "ECONNREFUSED" } });

  await run("restart");

  expect(kill).not.toHaveBeenCalledWith(running.pid, "SIGUSR2");
  expect(notify).toHaveBeenCalledWith(expect.stringContaining("healthy"), "error");
});
it("restart signals once and reports only a healthy successor", async () => {
  mocks.record = running;
  kill.mockImplementation((_pid: number, signal: unknown) => {
    if (signal === "SIGUSR2") mocks.record = { ...running, pid: 56789 };
    return true;
  });

  await run("restart");

  expect(kill.mock.calls.filter(([, signal]) => signal === "SIGUSR2")).toEqual([[running.pid, "SIGUSR2"]]);
  expect(exec).toHaveBeenNthCalledWith(1, process.execPath, ["/trusted/npm-cli.js", "ci"], expect.any(Object));
  expect(exec).toHaveBeenNthCalledWith(2, process.execPath, ["/trusted/npm-cli.js", "run", "build"], expect.any(Object));
  expect(mocks.spawn).not.toHaveBeenCalled();
  expect(notify).toHaveBeenLastCalledWith(expect.stringContaining("restarted"), "info");
});
it("reports installation failure without signaling the running server", async () => {
  mocks.record = running;
  exec.mockResolvedValueOnce({ code: 1, stdout: "", stderr: "registry unavailable", killed: false });

  await run("restart");

  expect(exec).toHaveBeenCalledOnce();
  expect(kill).not.toHaveBeenCalledWith(running.pid, "SIGUSR2");
  expect(notify).toHaveBeenLastCalledWith(expect.stringContaining("registry unavailable"), "error");
});
it("reports build failure without signaling the running server", async () => {
  mocks.record = running;
  exec.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "", killed: false });
  exec.mockResolvedValueOnce({ code: 1, stdout: "", stderr: "compile failed", killed: false });

  await run("restart");

  expect(kill).not.toHaveBeenCalledWith(running.pid, "SIGUSR2");
  expect(notify).toHaveBeenLastCalledWith(expect.stringContaining("compile failed"), "error");
});
it("restart reports signaling errors without a retry", async () => {
  mocks.record = running;
  kill.mockImplementation((_pid: number, signal: unknown) => { if (signal === "SIGUSR2") throw new Error("permission denied"); return true; });

  await run("restart");

  expect(notify).toHaveBeenLastCalledWith(expect.stringContaining("permission denied"), "error");
});
it("restart times out honestly without killing the current server or repeating the request", async () => {
  mocks.record = running;
  const result = run("restart");

  await vi.advanceTimersByTimeAsync(120_500);
  await result;

  expect(kill.mock.calls.filter(([, signal]) => signal !== 0)).toEqual([[running.pid, "SIGUSR2"]]);
  expect(notify).toHaveBeenLastCalledWith(expect.stringContaining("not confirmed"), "error");
});
