import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectMetadataStore } from "../../../../src/server/projects/project-metadata-store.js";

const roots: string[] = [];
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "pi-chat-metadata-")); roots.push(root);
  const path = join(root, "projects.json");
  return { path, store: new ProjectMetadataStore(path) };
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe("ProjectMetadataStore", () => {
  it("starts empty and persists pins and archive state across store instances", async () => {
    const { path, store } = await setup();
    expect(await store.read()).toEqual({ version: 1, pins: [], archives: [] });
    await store.pin("/work/project", true);
    await store.archive({ path: "/sessions/one.jsonl", id: "one", cwd: "/work/project" }, true);
    const persisted = await new ProjectMetadataStore(path).read();
    expect(persisted.pins).toEqual(["/work/project"]);
    expect(persisted.archives[0]).toMatchObject({ path: "/sessions/one.jsonl", id: "one", cwd: "/work/project", archivedAt: expect.any(Number) });
    await store.archive({ path: "/sessions/one.jsonl", id: "one", cwd: "/work/project" }, false);
    expect((await store.read()).archives).toEqual([]);
  });
  it("serializes concurrent mutations without losing unrelated pins or archives", async () => {
    const { store } = await setup();
    await Promise.all([store.pin("/a", true), store.pin("/b", true), store.archive({ path: "/sessions/a.jsonl", id: "a", cwd: "/a" }, true)]);
    expect((await store.read()).pins).toEqual(["/a", "/b"]);
    expect((await store.read()).archives).toHaveLength(1);
    await store.pin("/a", true);
    expect((await store.read()).pins).toHaveLength(2);
  });
  it("does not share archive state between copied session ids", async () => {
    const { store } = await setup();
    await store.archive({ path: "/sessions/a.jsonl", id: "copy", cwd: "/a" }, true);
    await store.archive({ path: "/sessions/b.jsonl", id: "copy", cwd: "/b" }, true);
    await store.archive({ path: "/sessions/a.jsonl", id: "copy", cwd: "/a" }, false);
    expect((await store.read()).archives.map(a => a.path)).toEqual(["/sessions/b.jsonl"]);
  });
  it("does not overwrite malformed or unsupported metadata", async () => {
    const { path, store } = await setup();
    for (const content of ["broken json", JSON.stringify({ version: 99, pins: [], archives: [] })]) {
      await writeFile(path, content);
      await expect(store.pin("/a", true)).rejects.toThrow(/metadata/);
      expect(await readFile(path, "utf8")).toBe(content);
    }
  });
  it("preserves the original archive timestamp on repeated requests", async () => {
    const { store } = await setup();
    const descriptor = { path: "/a.jsonl", id: "a", cwd: "/work" };
    await store.archive(descriptor, true);
    const first = (await store.read()).archives[0];
    await store.archive(descriptor, true);
    expect((await store.read()).archives).toEqual([first]);
  });
});
