import { EventEmitter } from "node:events";
import { expect, vi } from "vitest";
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
const running = { pid: 12345, port: 9898, cwd: "/project", nodePath: "/trusted/node", restartSignal: "SIGUSR2" };

/** Mocked OS/extension boundary; no real processes, files or network are touched. */
export class LifecycleCommandDriver {
  private command!: Command;
  private notify = vi.fn();
  private exec = vi.fn(async () => ({ code: 0, stdout: "", stderr: "", killed: false }));
  private register = vi.fn((name: string, value: Command) => { if (name === "pi-chat") this.command = value; });
  private kill;
  private health = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));

  constructor() {
    vi.useFakeTimers();
    mocks.record = undefined;
    mocks.spawn.mockReset(); mocks.write.mockReset(); mocks.remove.mockReset(); mocks.mkdir.mockReset();
    mocks.resolveNpmCli.mockReset().mockReturnValue("/trusted/npm-cli.js");
    this.kill = vi.spyOn(process, "kill").mockImplementation(() => true);
    vi.stubGlobal("fetch", this.health);
    piChatExtension({ registerCommand: this.register, exec: this.exec } as unknown as ExtensionAPI);
  }

  dispose() { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); }
  run(args: string) {
    return this.command.handler(args, { cwd: "/project", ui: { notify: this.notify } } as unknown as ExtensionCommandContext);
  }
  withRunningServer(overrides: Record<string, unknown> = {}) { mocks.record = { ...running, ...overrides }; }
  withoutSignalSupport() { mocks.record = { pid: running.pid, port: running.port, cwd: running.cwd }; }
  withRestartLockHeld() { mocks.mkdir.mockImplementation(() => { throw new Error("already exists"); }); }
  withUnhealthyServer() { this.health.mockRejectedValue({ cause: { code: "ECONNREFUSED" } }); }
  withFreePort() {
    this.health.mockRejectedValueOnce({ cause: { code: "ECONNREFUSED" } });
    mocks.spawn.mockReturnValue(Object.assign(new EventEmitter(), { pid: 56789, unref: vi.fn(), kill: vi.fn() }));
  }
  withHealthySuccessor() {
    this.kill.mockImplementation((_pid: number, signal: unknown) => {
      if (signal === "SIGUSR2") mocks.record = { ...running, pid: 56789 };
      return true;
    });
  }
  withInstallFailure() { this.exec.mockResolvedValueOnce({ code: 1, stdout: "", stderr: "registry unavailable", killed: false }); }
  withBuildFailure() {
    this.exec.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "", killed: false });
    this.exec.mockResolvedValueOnce({ code: 1, stdout: "", stderr: "compile failed", killed: false });
  }
  withSignalFailure() {
    this.kill.mockImplementation((_pid: number, signal: unknown) => { if (signal === "SIGUSR2") throw new Error("permission denied"); return true; });
  }
  async restartUntilDeadline() {
    const result = this.run("restart");
    await vi.advanceTimersByTimeAsync(120_500);
    await result;
  }

  async shouldOfferLifecycleCommands() {
    expect(this.register.mock.calls.map(([name]) => name)).toEqual(["pi-chat"]);
    expect(await this.command.getArgumentCompletions!("")).toEqual(["start", "stop", "restart"].map(value => ({ value, label: value })));
    expect(await this.command.getArgumentCompletions!("st")).toEqual(["start", "stop"].map(value => ({ value, label: value })));
    expect(await this.command.getArgumentCompletions!("start ")).toBeNull();
  }
  shouldNotify(text: string, level: "info" | "warning" | "error") {
    expect(this.notify).toHaveBeenCalledWith(expect.stringContaining(text), level);
  }
  shouldFinishWith(text: string, level: "info" | "error") {
    expect(this.notify).toHaveBeenLastCalledWith(expect.stringContaining(text), level);
  }
  shouldNotHaveExecutedCommands() { expect(this.exec).not.toHaveBeenCalled(); }
  shouldNotHaveSignaledProcesses() { expect(this.kill).not.toHaveBeenCalled(); }
  shouldNotHaveRequestedReplacement() { expect(this.kill).not.toHaveBeenCalledWith(running.pid, "SIGUSR2"); }
  shouldNotHaveSpawnedProcesses() { expect(mocks.spawn).not.toHaveBeenCalled(); }
  shouldHaveRequestedReplacementOnce() {
    expect(this.kill.mock.calls.filter(([, signal]) => signal === "SIGUSR2")).toEqual([[running.pid, "SIGUSR2"]]);
  }
  shouldHaveOnlyRequestedReplacement() {
    expect(this.kill.mock.calls.filter(([, signal]) => signal !== 0)).toEqual([[running.pid, "SIGUSR2"]]);
  }
  shouldHaveInstalledThenBuilt() {
    expect(this.exec).toHaveBeenNthCalledWith(1, process.execPath, ["/trusted/npm-cli.js", "ci"], expect.any(Object));
    expect(this.exec).toHaveBeenNthCalledWith(2, process.execPath, ["/trusted/npm-cli.js", "run", "build"], expect.any(Object));
  }
  shouldHaveExecutedOneCommand() { expect(this.exec).toHaveBeenCalledOnce(); }
  shouldHaveStoppedProcessGroup() { expect(this.kill).toHaveBeenCalledWith(-running.pid, "SIGTERM"); }
  shouldHaveStartedOn(port: number, cwd: string) {
    expect(mocks.spawn).toHaveBeenCalledWith(process.execPath, expect.any(Array), expect.objectContaining({
      env: expect.objectContaining({ PI_CHAT_PORT: String(port), PI_CHAT_CWD: cwd }), detached: true,
    }));
    expect(this.exec).toHaveBeenCalledWith("npm", ["run", "build"], expect.any(Object));
  }
}
