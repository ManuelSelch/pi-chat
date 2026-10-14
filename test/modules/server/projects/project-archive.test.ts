import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSessionService } from "../../../../src/server/projects/project-session-service.js";
import { ProjectMetadataStore } from "../../../../src/server/projects/project-metadata-store.js";
const roots: string[] = [];
async function setup() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "pi-chat-archive-"))); roots.push(root);
  const sessionsRoot = join(root, "sessions"), cwd = join(root, "project");
  await mkdir(sessionsRoot); await mkdir(cwd);
  const path = join(sessionsRoot, "one.jsonl");
  const content = JSON.stringify({ type: "session", version: 3, id: "one", cwd, timestamp: new Date(0).toISOString() }) + '\n';
  await writeFile(path, content);
  const metadata = new ProjectMetadataStore(join(root, "metadata.json"));
  const lister = { listAll: async () => [{ path, id: "one", cwd, created: new Date(0), modified: new Date(1), messageCount: 1, firstMessage: "Hello" }] };
  const discovery = { forDirectory: async () => undefined };
  return { root, path, content, cwd, metadata, service: new ProjectSessionService(lister, sessionsRoot, discovery, metadata, ""), lister, discovery, sessionsRoot };
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
describe("project archives", () => {
  it("pins and unpins a known project without scanning sessions or rediscovering worktrees", async () => {
    const { service, cwd, lister, discovery } = await setup();
    const list = vi.spyOn(lister, "listAll");
    const discover = vi.spyOn(discovery, "forDirectory");
    const before = await service.catalogue();
    list.mockClear(); discover.mockClear();
    await service.pin(cwd, true);
    const pinned = await service.catalogue(undefined, { metadataOnly: true });
    expect(pinned.projects[0]!.pinned).toBe(true);
    expect(before.projects[0]!.pinned).toBeUndefined();
    await service.pin(cwd, false);
    expect((await service.catalogue(undefined, { metadataOnly: true })).projects[0]!.pinned).toBeUndefined();
    expect(pinned.projects[0]!.pinned).toBe(true);
    expect(list).not.toHaveBeenCalled();
    expect(discover).not.toHaveBeenCalled();

    await service.pin(cwd, true);
    await service.catalogue();
    list.mockClear(); discover.mockClear();
    await service.pin(cwd, false);
    expect((await service.catalogue(undefined, { metadataOnly: true })).projects[0]!.pinned).toBeUndefined();
    expect(list).not.toHaveBeenCalled();
    expect(discover).not.toHaveBeenCalled();
  });

  it("reuses discovered worktrees when pinning a linked checkout", async () => {
    const { cwd, sessionsRoot, lister, metadata } = await setup();
    const main = join(cwd, "main"); await mkdir(main);
    const discovery = { forDirectory: vi.fn(async () => ({ repositoryPath: main, worktrees: [{ path: main, primary: true, detached: false }, { path: cwd, primary: false, detached: false }] })) };
    const service = new ProjectSessionService(lister, sessionsRoot, discovery, metadata, "");
    await service.catalogue();
    discovery.forDirectory.mockClear();
    await service.pin(cwd, true);
    const pinned = await service.catalogue(undefined, { metadataOnly: true });
    expect(pinned.projects.find(project => project.path === main)?.pinned).toBe(true);
    expect((await metadata.read()).pins).toEqual([main]);
    await service.pin(cwd, false);
    expect((await service.catalogue(undefined, { metadataOnly: true })).projects.every(project => !project.pinned)).toBe(true);
    expect(discovery.forDirectory).not.toHaveBeenCalled();
  });

  it("removes pin-only repositories and their empty worktrees without rescanning", async () => {
    const { cwd, sessionsRoot, metadata } = await setup();
    const linked = join(cwd, "linked"); await mkdir(linked);
    const lister = { listAll: vi.fn(async () => []) };
    const discovery = { forDirectory: vi.fn(async () => ({ repositoryPath: cwd, worktrees: [{ path: cwd, primary: true, detached: false }, { path: linked, primary: false, detached: false }] })) };
    const service = new ProjectSessionService(lister, sessionsRoot, discovery, metadata, "");
    await service.pin(cwd, true);
    expect((await service.catalogue()).projects).toHaveLength(2);
    lister.listAll.mockClear(); discovery.forDirectory.mockClear();
    await service.pin(cwd, false);
    expect((await service.catalogue(undefined, { metadataOnly: true })).projects).toEqual([]);
    expect(lister.listAll).not.toHaveBeenCalled();
    expect(discovery.forDirectory).not.toHaveBeenCalled();
  });

  it("handles newly pinned empty folders and removes them after unpinning", async () => {
    const { service, cwd, root } = await setup();
    const empty = join(root, "empty"); await mkdir(empty);
    await service.catalogue();
    await service.pin(empty, true);
    expect((await service.catalogue(undefined, { metadataOnly: true })).projects[0]).toMatchObject({ path: empty, pinned: true, sessions: [] });
    await service.pin(empty, false);
    expect((await service.catalogue(undefined, { metadataOnly: true })).projects.map(project => project.path)).toEqual([cwd]);
  });

  it("refreshes archive metadata without rescanning sessions or rediscovering worktrees", async () => {
    const { service, path, lister, discovery } = await setup();
    const list = vi.spyOn(lister, "listAll");
    const discover = vi.spyOn(discovery, "forDirectory");
    const before = await service.catalogue();
    list.mockClear(); discover.mockClear();

    await service.archive(path, true);
    const archived = await service.catalogue(undefined, { metadataOnly: true });
    expect(archived.projects[0]!.sessionCount).toBe(0);
    expect(archived.projects[0]!.sessions[0]!.archivedAt).toEqual(expect.any(Number));
    expect(before.projects[0]!.sessions[0]!.archivedAt).toBeUndefined();
    await service.archive(path, false);
    const restored = await service.catalogue(undefined, { metadataOnly: true });
    expect(restored.projects[0]!.sessionCount).toBe(1);
    expect(restored.projects[0]!.sessions[0]!.archivedAt).toBeUndefined();
    expect(archived.projects[0]!.sessions[0]!.archivedAt).toBeDefined();
    expect(list).not.toHaveBeenCalled();
    expect(discover).not.toHaveBeenCalled();
    await service.catalogue();
    expect(list).toHaveBeenCalledOnce();
    expect(discover).toHaveBeenCalledOnce();
  });

  it("retains repository discovery for an active session not yet listed on disk", async () => {
    const { cwd, sessionsRoot, metadata } = await setup();
    const discovery = { forDirectory: vi.fn(async () => ({ repositoryPath: cwd, worktrees: [{ path: cwd, primary: true, detached: false, branch: "main" }] })) };
    const service = new ProjectSessionService({ listAll: async () => [] }, sessionsRoot, discovery, metadata, "");
    const active = { id: "new", cwd, messageCount: 0, name: "New session" };
    const catalogue = await service.catalogue(active);
    expect(catalogue.projects[0]!.worktree).toMatchObject({ branch: "main" });
    const refreshed = await service.catalogue({ ...active, name: "Renamed session", messageCount: 2 }, { metadataOnly: true });
    expect(refreshed.projects[0]!.sessions[0]).toMatchObject({ title: "Renamed session", messageCount: 2 });
    expect(catalogue.projects[0]!.sessions[0]!.title).toBe("New session");
    expect(discovery.forDirectory).toHaveBeenCalledOnce();
  });

  it("applies archive writes that finish during a full scan", async () => {
    const { service, path, lister } = await setup();
    await service.catalogue();
    const records = await lister.listAll();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const list = vi.spyOn(lister, "listAll").mockImplementationOnce(async () => { await gate; return records; });
    const scanning = service.catalogue();
    await vi.waitFor(() => expect(list).toHaveBeenCalledOnce());
    try {
      await service.archive(path, true);
      expect((await service.catalogue(undefined, { metadataOnly: true })).projects[0]!.sessionCount).toBe(0);
    } finally { release(); }
    expect((await scanning).projects[0]!.sessionCount).toBe(0);
  });

  it("falls back to a full scan when no catalogue has been built", async () => {
    const { service, path, lister } = await setup();
    const list = vi.spyOn(lister, "listAll");
    await service.archive(path, true);
    expect((await service.catalogue(undefined, { metadataOnly: true })).projects[0]!.sessionCount).toBe(0);
    expect(list).toHaveBeenCalledOnce();
  });

  it("marks history without touching the transcript and excludes it from active counts", async () => {
    const { service, path, content } = await setup();
    await service.archive(path, true);
    expect(await readFile(path, "utf8")).toBe(content);
    const project = (await service.catalogue()).projects[0]!;
    expect(project.sessionCount).toBe(0);
    expect(project.sessions[0]).toMatchObject({ archivedAt: expect.any(Number) });
    await service.archive(path, false);
    expect((await service.catalogue()).projects[0]!.sessionCount).toBe(1);
  });
  it("keeps a pinned project with no session history across service recreation", async () => {
    const { service, cwd, sessionsRoot, discovery, metadata } = await setup();
    await service.pin(cwd, true);
    const restarted = new ProjectSessionService({ listAll: async () => [] }, sessionsRoot, discovery, new ProjectMetadataStore(metadata.path), "");
    expect((await restarted.catalogue()).projects).toEqual([expect.objectContaining({ path: cwd, pinned: true, sessionCount: 0, sessions: [] })]);
    await restarted.pin(cwd, false);
    expect((await restarted.catalogue()).projects).toEqual([]);
  });
  it("does not undo archive state when an archived session is opened", async () => {
    const { service, path, cwd } = await setup();
    await service.archive(path, true);
    const catalogue = await service.catalogue({ id: "one", path, cwd, messageCount: 1 });
    expect(catalogue.projects[0]!.sessionCount).toBe(0);
    expect(catalogue.projects[0]!.sessions[0]!.archivedAt).toBeDefined();
  });
  it("pins the primary checkout when invoked from a linked worktree", async () => {
    const { cwd, sessionsRoot, lister, metadata } = await setup();
    const main = join(cwd, "main"); await mkdir(main);
    const discovery = { forDirectory: async () => ({ repositoryPath: main, worktrees: [{ path: main, primary: true, detached: false }, { path: cwd, primary: false, detached: false }] }) };
    const service = new ProjectSessionService(lister, sessionsRoot, discovery, metadata, "");
    await service.pin(cwd, true);
    expect((await metadata.read()).pins).toEqual([main]);
  });
  it("rejects outside files and symlinks escaping the session folder", async () => {
    const { root, sessionsRoot, service, content } = await setup();
    const outside = join(root, "outside.jsonl"); await writeFile(outside, content);
    await expect(service.archive(outside, true)).rejects.toThrow(/outside/);
    const link = join(sessionsRoot, "link.jsonl"); await symlink(outside, link);
    await expect(service.archive(link, true)).rejects.toThrow(/outside/);
  });
  it("rejects non-session JSONL and removes archive metadata on restoration", async () => {
    const { service, path, metadata } = await setup();
    await writeFile(path, '{}');
    await expect(service.archive(path, true)).rejects.toThrow(/session/);
    // A valid header is needed, not a name trusted from the browser.
    await writeFile(path, JSON.stringify({ type: "session", id: "one", cwd: "/work" }));
    await service.archive(path, true);
    const content = await readFile(path, "utf8");
    await service.archive(path, false);
    expect((await metadata.read()).archives).toEqual([]);
    expect(await readFile(path, "utf8")).toBe(content);
  });
});
