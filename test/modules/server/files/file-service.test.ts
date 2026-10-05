import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink, realpath, chmod, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileService } from "../../../../src/server/files/file-service.js";
import { SystemFileOpener } from "../../../../src/server/files/system-file-opener.js";

let folder: string;
const opener = { open: vi.fn(async (_path: string) => {}) };
beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "pi-file-service-"));
  await mkdir(join(folder, "project"));
  await writeFile(join(folder, "project", "report.pdf"), "harmless fixture");
  opener.open.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => { await rm(folder, { recursive: true, force: true }); });

const failure = (code: string) => ({ ok: false, error: { code, message: expect.any(String) } });
describe("server file service", () => {
  it("opens canonical relative, absolute, symlink, and outside-project regular files", async () => {
    const cwd = join(folder, "project");
    await symlink(join(cwd, "report.pdf"), join(cwd, "link.pdf"));
    await writeFile(join(folder, "outside.pdf"), "outside");
    const service = new FileService(opener);
    for (const path of ["report.pdf", join(cwd, "report.pdf"), "link.pdf", "../outside.pdf"]) {
      expect(await service.open(cwd, path)).toEqual({ ok: true });
      expect(opener.open).toHaveBeenLastCalledWith(await realpath(join(cwd, path === "../outside.pdf" ? path : "report.pdf")));
    }
  });

  it("preserves literal characters and a leading hyphen without decoding wire paths", async () => {
    const name = "-résumé O'Brien%20#?.pdf";
    await writeFile(join(folder, name), "fixture");
    expect(await new FileService(opener).open(folder, name)).toEqual({ ok: true });
    expect(opener.open).toHaveBeenCalledWith(await realpath(join(folder, name)));
  });

  it.each(["", "a\0", "a\n", "file:///tmp/a", "https://host/a", "//host/a"])("rejects invalid path %s before opening", async (path) => {
    expect(await new FileService(opener).open(folder, path)).toMatchObject(failure("invalidPath"));
    expect(opener.open).not.toHaveBeenCalled();
  });

  it("rejects control characters revealed by canonicalizing a symlink", async () => {
    await writeFile(join(folder, "hidden\nname.pdf"), "fixture");
    await symlink(join(folder, "hidden\nname.pdf"), join(folder, "link.pdf"));
    expect(await new FileService(opener).open(folder, "link.pdf")).toMatchObject(failure("invalidPath"));
    expect(opener.open).not.toHaveBeenCalled();
  });

  it("never falls back to process cwd", async () => {
    for (const cwd of ["", "relative-project", "a\0"]) {
      expect(await new FileService(opener).open(cwd, "report.pdf")).toMatchObject(failure("sessionUnavailable"));
    }
    expect(opener.open).not.toHaveBeenCalled();
  });

  it("rejects missing files and directories, including application bundles", async () => {
    await mkdir(join(folder, "Demo.app"));
    const service = new FileService(opener);
    expect(await service.open(folder, "missing.pdf")).toMatchObject(failure("notFound"));
    expect(await service.open(folder, "project/report.pdf/child")).toMatchObject(failure("notFound"));
    expect(await service.open(folder, "project")).toMatchObject(failure("notFile"));
    expect(await service.open(folder, "Demo.app")).toMatchObject(failure("notFile"));
    expect(opener.open).not.toHaveBeenCalled();
  });

  it.skipIf(process.platform === "win32")("rejects FIFOs without reading or opening them", async () => {
    execFileSync("mkfifo", [join(folder, "pipe")]);
    expect(await new FileService(opener).open(folder, "pipe")).toMatchObject(failure("notFile"));
    expect(opener.open).not.toHaveBeenCalled();
  });

  it.skipIf(process.getuid?.() === 0 || process.platform === "win32")("rejects unreadable regular files", async () => {
    const path = join(folder, "project/report.pdf");
    await chmod(path, 0);
    try {
      expect(await new FileService(opener).open(folder, "project/report.pdf")).toMatchObject(failure("permissionDenied"));
      expect(opener.open).not.toHaveBeenCalled();
    } finally { await chmod(path, 0o600); }
  });

  it("returns a typed unsupported result for other server platforms", async () => {
    expect(await new FileService(new SystemFileOpener("linux")).open(folder, "project/report.pdf")).toMatchObject(failure("unsupported"));
  });

  it("reports disappearance after validation without retrying", async () => {
    opener.open.mockImplementationOnce(async (path) => {
      await rm(path);
      throw Object.assign(new Error("file disappeared"), { code: "ENOENT" });
    });
    expect(await new FileService(opener).open(folder, "project/report.pdf")).toMatchObject(failure("notFound"));
    expect(opener.open).toHaveBeenCalledTimes(1);
  });

  it.skipIf(process.platform === "win32")("rejects device files and broken symlinks", async () => {
    await symlink("/dev/null", join(folder, "device"));
    await symlink(join(folder, "missing"), join(folder, "broken"));
    const service = new FileService(opener);
    expect(await service.open(folder, "device")).toMatchObject(failure("notFile"));
    expect(await service.open(folder, "broken")).toMatchObject(failure("notFound"));
    expect(opener.open).not.toHaveBeenCalled();
  });

  it("bounds unexpected opener errors without exposing arbitrary process output", async () => {
    opener.open.mockRejectedValue(new Error("private output".repeat(1000)));
    const result = await new FileService(opener).open(folder, "project/report.pdf");
    expect(result).toMatchObject(failure("openFailed"));
    expect(JSON.stringify(result)).not.toContain("private output");
  });
});
