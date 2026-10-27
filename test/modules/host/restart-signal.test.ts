import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  restart: vi.fn(), createRestart: vi.fn(), write: vi.fn(), rename: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), close: vi.fn() },
}));
vi.mock("node:fs", () => ({ writeFileSync: mocks.write, renameSync: mocks.rename }));
vi.mock("../../../src/host/restart-service.js", () => ({ createRestartService: mocks.createRestart }));
vi.mock("@manuelselch/pi-server", () => ({
  createFileLogger: () => mocks.logger,
  createPiServer: () => ({
    httpServer: { listen: (_port: number, _host: string, ready: () => void) => ready(), on: vi.fn() },
    close: vi.fn(),
  }),
}));
const handlers = new Map<string, () => void>();
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); handlers.clear();
  vi.stubEnv("PI_CHAT_DEV", "0"); vi.stubEnv("PI_CHAT_PID_FILE", "/isolated/server.pid");
  mocks.restart.mockResolvedValue(undefined);
  mocks.createRestart.mockReturnValue({ restart: mocks.restart });
  vi.spyOn(process, "on").mockImplementation((event, listener) => { handlers.set(String(event), listener); return process; });
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function signal() {
  await import("../../../src/host/index.js");
  handlers.get("SIGUSR2")!();
  // The signal callback owns its rejection handler rather than returning work to Node.
  await Promise.resolve(); await Promise.resolve();
}
it("advertises managed restart support only after installing the signal handler", async () => {
  await signal();

  expect(mocks.restart).toHaveBeenCalledOnce();
  const [temporary, body] = mocks.write.mock.calls[0]!;
  expect(JSON.parse(body)).toMatchObject({ pid: process.pid, restartSignal: "SIGUSR2" });
  expect(mocks.rename).toHaveBeenCalledWith(temporary, "/isolated/server.pid");
});
it("logs a failed build without shutting down the host", async () => {
  mocks.restart.mockResolvedValue("broken build");

  await signal();

  expect(mocks.logger.error).toHaveBeenCalledWith("server.restart_failed", { message: "broken build" });
});
it("handles unexpected restart errors", async () => {
  mocks.restart.mockRejectedValue(new Error("spawn failed"));

  await signal();

  expect(mocks.logger.error).toHaveBeenCalledWith("server.restart_failed", { message: "spawn failed" });
});
it("rejects signals in development and does not advertise support", async () => {
  vi.stubEnv("PI_CHAT_DEV", "1");

  await signal();

  expect(mocks.restart).not.toHaveBeenCalled();
  expect(mocks.logger.warn).toHaveBeenCalledWith("server.restart_rejected", expect.any(Object));
  expect(JSON.parse(mocks.write.mock.calls[0]![1]).restartSignal).toBeNull();
});
it("rejects signals on an unmanaged host without writing a PID record", async () => {
  vi.stubEnv("PI_CHAT_PID_FILE", "");

  await signal();

  expect(mocks.restart).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.logger.warn).toHaveBeenCalledWith("server.restart_rejected", expect.any(Object));
});
