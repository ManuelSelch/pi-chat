import { afterEach, describe, expect, it, vi } from "vitest";

const { listen, createServer } = vi.hoisted(() => ({ listen: vi.fn(), createServer: vi.fn() }));
vi.mock("../version-route.js", () => ({ installVersionRoute: vi.fn() }));
vi.mock("../../shared/node/package-version.js", () => ({ packageVersion: () => "0.2.0" }));
vi.mock("@manuelselch/pi-server", () => ({
  createPiServer: (options: unknown) => { createServer(options); return { httpServer: { listen, on: vi.fn() } }; },
  createFileLogger: () => ({ info: vi.fn(), error: vi.fn() }),
}));
vi.mock("../restart-service.js", () => ({
  createRestartService: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});

describe("server host binding", () => {
  it("registers and exposes file, folder and diff-viewer plugins", async () => {
    vi.spyOn(process, "on").mockReturnValue(process);

    await import("../index.js");

    const options = createServer.mock.calls[0]![0];
    expect(options.plugins({ getSession: vi.fn() })).toEqual([
      expect.objectContaining({ id: "file-opening", host: expect.any(Function) }),
      expect.objectContaining({ id: "folder-opening", host: expect.any(Function) }),
      expect.objectContaining({ id: "diff-viewer", host: expect.any(Function) }),
    ]);
    expect(options.pluginRpcContracts).toEqual([
      expect.objectContaining({ id: "file-opening", version: 1 }),
      expect.objectContaining({ id: "folder-opening", version: 1 }),
      expect.objectContaining({ id: "diff-viewer", version: 1 }),
    ]);
  });

  it.each([
    [undefined, "127.0.0.1"],
    ["0.0.0.0", "0.0.0.0"],
    ["192.168.1.10", "192.168.1.10"],
  ])("binds PI_CHAT_HOST=%s as %s", async (configured, expected) => {
    vi.stubEnv("PI_CHAT_HOST", configured);
    vi.stubEnv("PI_CHAT_PORT", "8788");
    vi.spyOn(process, "on").mockReturnValue(process);

    await import("../index.js");

    expect(listen).toHaveBeenCalledWith(8788, expected, expect.any(Function));
  });
});
