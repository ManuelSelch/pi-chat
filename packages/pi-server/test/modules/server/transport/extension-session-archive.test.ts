import { once } from "node:events";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createPiServer, type PiServer } from "../../../../src/index.js";
import { createPiChatExtensionRegistry, type PiChatExtensionRegistry } from "../../../../src/extensions/extension-registry.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";
import { v2Socket } from "../../../infra/v2-socket.js";

const roots: string[] = [];
let server: PiServer | undefined;
afterEach(async () => {
  try { await server?.close(); }
  finally {
    server = undefined;
    vi.restoreAllMocks();
    await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
  }
});

/** A server with one saved, unopened session and an open fake runtime. */
async function setup() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "pi-server-extension-archive-"))); roots.push(root);
  const sessionsDirectory = join(root, "sessions"), cwd = join(root, "project"), metadataFile = join(root, "projects.json");
  await mkdir(sessionsDirectory); await mkdir(cwd);
  const savedPath = join(sessionsDirectory, "implementation.jsonl");
  await writeFile(savedPath, JSON.stringify({ type: "session", version: 3, id: "implementation", cwd, timestamp: new Date(0).toISOString() }) + "\n");
  const lister = { listAll: async () => [{ path: savedPath, id: "implementation", cwd, created: new Date(0), modified: new Date(1), messageCount: 2, firstMessage: "Implement it" }] };
  const runtime = new FakeRuntimeAdapter();
  const extensions = createPiChatExtensionRegistry();
  server = await createPiServer({ runtime, extensions, catalogue: { lister, sessionsDirectory, metadataFile, discovery: { forDirectory: async () => undefined }, homeDirectory: null } });
  server.httpServer.listen(0, "127.0.0.1"); await once(server.httpServer, "listening");
  const controller = await v2Socket(server);
  await controller.initialize();
  return { savedPath, metadataFile, runtime, extensions, controller };
}

function host(extensions: PiChatExtensionRegistry) {
  const bound = extensions.sessionHost();
  if (!bound) throw new Error("The server bound no session host.");
  return bound;
}

it("archives saved history for an extension and publishes the catalogue to the controller", async () => {
  const { savedPath, metadataFile, extensions, controller } = await setup();

  await host(extensions).archive(savedPath);

  const metadata = JSON.parse(await readFile(metadataFile, "utf8"));
  expect(metadata.archives).toEqual([expect.objectContaining({ path: savedPath, id: "implementation", archivedAt: expect.any(Number) })]);
  const published = await controller.wait(message => message.type === "event" && message.event === "project.list.changed"
    && message.data.catalogue.projects.some(project => project.sessions.some(session => session.path === savedPath && session.archivedAt !== undefined)));
  expect(published).toBeDefined();
});

it("rejects archiving a running session without changing metadata", async () => {
  const { metadataFile, runtime, extensions } = await setup();
  vi.spyOn(runtime, "snapshot").mockReturnValue({ ...runtime.snapshot(), isStreaming: true });

  await expect(host(extensions).archive(runtime.snapshot().sessionPath!)).rejects.toThrow(/running/);

  await expect(readFile(metadataFile, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
});

it("withdraws the session host when the server closes", async () => {
  const { extensions } = await setup();

  await server!.close();

  expect(extensions.sessionHost()).toBeUndefined();
});
