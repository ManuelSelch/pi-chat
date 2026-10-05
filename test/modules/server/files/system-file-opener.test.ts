import { describe, expect, it, vi, afterEach } from "vitest";
import { execFile } from "node:child_process";
import { SystemFileOpener } from "../../../../src/server/files/system-file-opener.js";
vi.mock("node:child_process", () => ({ execFile: vi.fn() }));
afterEach(() => vi.resetAllMocks());

function respond(error: Error | null) {
  vi.mocked(execFile).mockImplementation(((_file: string, _args: string[], _options: object, callback: (error: Error | null) => void) => {
    callback(error);
    return {};
  }) as typeof execFile);
}

describe("macOS file opener", () => {
  it("invokes the system opener with one literal absolute path, no shell, and bounded execution/output", async () => {
    respond(null);
    const path = "/tmp/-résumé O'Brien;$(touch bad).pdf";
    await new SystemFileOpener("darwin").open(path);
    expect(execFile).toHaveBeenCalledWith("/usr/bin/open", ["--", path], {
      shell: false, timeout: 5000, killSignal: "SIGKILL", maxBuffer: 8192,
    }, expect.any(Function));
  });

  it.each(["linux", "win32"] as const)("reports unsupported %s without launching anything", async (platform) => {
    await expect(new SystemFileOpener(platform).open("/tmp/a.pdf")).rejects.toMatchObject({ code: "unsupported" });
    expect(execFile).not.toHaveBeenCalled();
  });

  it.each(["./relative.pdf", "https://host/file.pdf", "/tmp/a\n.pdf"])("rejects nonliteral or relative target %s", async (path) => {
    await expect(new SystemFileOpener("darwin").open(path)).rejects.toMatchObject({ code: "invalidPath" });
    expect(execFile).not.toHaveBeenCalled();
  });

  it.each([{ code: 1 }, { code: "ENOENT" }, { killed: true, signal: "SIGKILL" }])("maps process failures and deadlines to bounded errors: %j", async (details) => {
    respond(Object.assign(new Error("private process output"), details));
    await expect(new SystemFileOpener("darwin").open("/tmp/a.pdf")).rejects.toMatchObject({ code: "openFailed", message: "Unable to open this file on the server." });
    expect(execFile).toHaveBeenCalledTimes(1);
  });

  it("captures synchronous spawn failures without retry", async () => {
    vi.mocked(execFile).mockImplementation(() => { throw new Error("spawn failed"); });
    await expect(new SystemFileOpener("darwin").open("/tmp/a.pdf")).rejects.toMatchObject({ code: "openFailed" });
    expect(execFile).toHaveBeenCalledTimes(1);
  });
});
