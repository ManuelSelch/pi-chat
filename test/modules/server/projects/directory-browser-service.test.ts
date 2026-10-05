import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import * as filesystem from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, parse, resolve } from "node:path";
import { DirectoryBrowserService } from "../../../../src/server/projects/directory-browser-service.js";

let root: string;
let service: DirectoryBrowserService;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "pi-folders-"));
  service = new DirectoryBrowserService(root, 2);
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe("server directories", () => {
  it("reports permission failures without leaking filesystem implementation errors", async () => {
    const denied = new DirectoryBrowserService(root, 200, { ...filesystem, access: vi.fn(async () => { throw Object.assign(new Error("internal"), { code: "EACCES" }); }) });
    await expect(denied.validate(root)).rejects.toThrow("Permission denied");
    await expect(denied.browse({ path: root })).rejects.toThrow("Permission denied");
  });
  it("lists sorted directories only, hiding dot folders by default", async () => {
    for (const name of ["zeta", "alpha", ".hidden"]) await mkdir(join(root, name));
    await writeFile(join(root, "file"), "not a folder");
    expect((await service.browse({ path: "~" })).entries.map((e) => e.name)).toEqual(["alpha", "zeta"]);
    expect((await service.browse({ path: "~", showHidden: true })).entries.map((e) => e.name)).toEqual([".hidden", "alpha"]);
  });
  it("resolves home, relative paths, unicode and symlinks canonically", async () => {
    const target = join(root, "space ü");
    await mkdir(target);
    await symlink(target, join(root, "link"));
    await symlink(join(root, "missing"), join(root, "broken"));
    expect((await service.browse({ path: "~/link" })).path).toBe(await service.validate(target));
    expect((await service.browse({ path: "space ü", basePath: root })).path).toBe(await service.validate(target));
    expect((await service.browse({ path: root })).entries.map((e) => e.name)).toEqual(["link", "space ü"]);
    expect((await service.browse({ path: target })).entries).toEqual([]);
  });
  it("paginates without duplicates and rejects invalid cursors", async () => {
    for (const name of ["a", "b", "c"]) await mkdir(join(root, name));
    const first = await service.browse({ path: root });
    expect(first.nextCursor).toBe("b");
    const last = await service.browse({ path: root, cursor: first.nextCursor });
    expect(last.entries.map((e) => e.name)).toEqual(["c"]);
    expect(last.nextCursor).toBeUndefined();
    await expect(service.browse({ path: root, cursor: "missing" })).rejects.toThrow("Refresh");
  });
  it("rejects files, missing paths, null bytes and relative paths without a base", async () => {
    await writeFile(join(root, "file"), "x");
    await expect(service.validate(join(root, "file"))).rejects.toThrow("not a folder");
    await expect(service.validate(join(root, "missing"))).rejects.toThrow("not found");
    await expect(service.validate("\0")).rejects.toThrow("Invalid");
    await expect(service.validate("relative")).rejects.toThrow("absolute");
  });
  it("has no parent at a filesystem root", async () => {
    const listing = await service.browse({ path: parse(resolve(root)).root });
    expect(listing.parentPath).toBeUndefined();
    expect(listing.breadcrumbs[0]!.path).toBe(listing.path);
  });
  it("revalidates a folder removed after browsing", async () => {
    const folder = join(root, "gone");
    await mkdir(folder);
    await service.browse({ path: folder });
    await rm(folder, { recursive: true });
    await expect(service.validate(folder)).rejects.toThrow("not found");
  });
});
