import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
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
  it("rejects non-session JSONL and removes metadata after successful deletion", async () => {
    const { service, path, metadata } = await setup();
    await writeFile(path, '{}');
    await expect(service.archive(path, true)).rejects.toThrow(/session/);
    // A valid header is needed, not a name trusted from the browser.
    await writeFile(path, JSON.stringify({ type: "session", id: "one", cwd: "/work" }));
    await service.archive(path, true);
    await service.delete(path);
    expect((await metadata.read()).archives).toEqual([]);
  });
});
