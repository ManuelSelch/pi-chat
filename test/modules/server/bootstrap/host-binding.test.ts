import { afterEach, describe, expect, it, vi } from "vitest";

const { listen } = vi.hoisted(() => ({ listen: vi.fn() }));
vi.mock("../../../../src/server/bootstrap/server.js", () => ({
  createPiChatServer: () => ({ httpServer: { listen, on: vi.fn() } }),
}));
vi.mock("../../../../src/server/bootstrap/restart-service.js", () => ({
  createRestartService: vi.fn(),
}));
vi.mock("../../../../src/server/logging/file-logger.js", () => ({
  createFileLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("server host binding", () => {
  it.each([
    [undefined, "127.0.0.1"],
    ["0.0.0.0", "0.0.0.0"],
    ["192.168.1.10", "192.168.1.10"],
  ])("binds PI_CHAT_HOST=%s as %s", async (configured, expected) => {
    vi.stubEnv("PI_CHAT_HOST", configured);
    vi.stubEnv("PI_CHAT_PORT", "8788");
    vi.spyOn(process, "on").mockReturnValue(process);

    await import("../../../../src/server/index.js");

    expect(listen).toHaveBeenCalledWith(8788, expected, expect.any(Function));
  });
});
