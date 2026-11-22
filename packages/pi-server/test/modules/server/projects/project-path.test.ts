import { beforeEach, describe, expect, it, vi } from "vitest";
import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { validateProjectPath } from "../../../../src/projects/project-path.js";

vi.mock("node:fs/promises", () => ({ access: vi.fn(), realpath: vi.fn(), stat: vi.fn() }));
beforeEach(() => {
  vi.mocked(realpath).mockReset().mockResolvedValue("/canonical");
  vi.mocked(stat).mockReset().mockResolvedValue({ isDirectory: () => true } as any);
  vi.mocked(access).mockReset().mockResolvedValue(undefined);
});

describe("core project-path admission", () => {
  it.each(["", "relative", "x\0y", "/" + "x".repeat(4096)])("rejects invalid project path %j before filesystem access", async path => {
    await expect(validateProjectPath(path)).rejects.toMatchObject({ code: "invalidPath" });
    expect(realpath).not.toHaveBeenCalled();
  });

  it.each(["~", "~/project"])("expands home path %s and validates canonical folder access", async path => {
    await expect(validateProjectPath(path)).resolves.toBe("/canonical");

    expect(realpath).toHaveBeenCalledWith(path === "~" ? homedir() : join(homedir(), "project"));
    expect(stat).toHaveBeenCalledWith("/canonical");
    expect(access).toHaveBeenCalledWith("/canonical", constants.R_OK | constants.X_OK);
  });

  it("rejects files before testing directory access", async () => {
    vi.mocked(stat).mockResolvedValue({ isDirectory: () => false } as any);

    await expect(validateProjectPath("/file")).rejects.toMatchObject({ code: "invalidPath" });
    expect(access).not.toHaveBeenCalled();
  });

  it.each([["ENOENT", "notFound"], ["ENOTDIR", "invalidPath"], ["EACCES", "permissionDenied"], ["EPERM", "permissionDenied"], ["EIO", "operationFailed"]])("classifies %s safely", async (code, expected) => {
    vi.mocked(realpath).mockRejectedValue(Object.assign(new Error("private filesystem details"), { code }));

    await expect(validateProjectPath("/project")).rejects.toMatchObject({ code: expected });
    await expect(validateProjectPath("/project")).rejects.not.toThrow("private filesystem details");
  });
});
