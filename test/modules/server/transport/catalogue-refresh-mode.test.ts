import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatApplicationService } from "../../../../src/server/application/chat-application-service.js";
import { ServerPublisher } from "../../../../src/server/transport/server-publisher.js";
import { executeOperation } from "../../../../src/server/transport/command-handler.js";
import { ProjectSessionService } from "../../../../src/server/projects/project-session-service.js";
import { ProjectMetadataStore } from "../../../../src/server/projects/project-metadata-store.js";
import { FakeRuntimeAdapter } from "../../../infra/fake-runtime-adapter.js";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

async function setup() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "pi-chat-refresh-"))); roots.push(root);
  const sessionsRoot = join(root, "sessions"); const cwd = join(root, "project");
  await mkdir(sessionsRoot); await mkdir(cwd);
  const path = join(sessionsRoot, "one.jsonl");
  await writeFile(path, JSON.stringify({ type: "session", version: 3, id: "one", cwd, timestamp: new Date(0).toISOString() }) + "\n");
  const metadata = new ProjectMetadataStore(join(root, "metadata.json"));
  const lister = { listAll: vi.fn(async () => [{ path, id: "one", cwd, created: new Date(0), modified: new Date(1), messageCount: 1, firstMessage: "Hello" }]) };
  const discovery = { forDirectory: vi.fn(async () => undefined) };
  const service = new ProjectSessionService(lister, sessionsRoot, discovery, metadata, "");
  const chat = new ChatApplicationService(new FakeRuntimeAdapter("fake-session"), {
    continueProject: vi.fn(),
    newSession: vi.fn(async () => new FakeRuntimeAdapter("created")),
    openSession: vi.fn(async () => new FakeRuntimeAdapter("opened")),
  }, service);
  const publisher = new ServerPublisher(chat, () => {});
  return { path, cwd, lister, discovery, chat, publisher };
}

async function settle(execution: Awaited<ReturnType<typeof executeOperation>>): Promise<void> {
  if (execution.kind === "completed") await execution.afterResponse?.();
  else await execution.run();
}

describe("catalogue refresh mode after v2 mutations", () => {
  it("archives a session without rescanning sessions or rediscovering worktrees", async () => {
    const { path, lister, discovery, chat, publisher } = await setup();
    await chat.currentCatalogue(); lister.listAll.mockClear(); discovery.forDirectory.mockClear();
    await settle(await executeOperation({ version: 2, type: "request", requestId: "r", method: "session.archive", params: { path, archived: true } }, chat, publisher));
    expect(lister.listAll).not.toHaveBeenCalled();
    expect(discovery.forDirectory).not.toHaveBeenCalled();
    expect(publisher.projects().catalogue.projects[0]!.sessionCount).toBe(0);
    expect(publisher.projects().catalogue.projects[0]!.sessions[0]!.archivedAt).toEqual(expect.any(Number));
    await chat.dispose();
  });

  it("removes a project without rescanning sessions or rediscovering worktrees", async () => {
    const { cwd, lister, discovery, chat, publisher } = await setup();
    await chat.currentCatalogue(); lister.listAll.mockClear(); discovery.forDirectory.mockClear();
    await settle(await executeOperation({ version: 2, type: "request", requestId: "r", method: "project.remove", params: { path: cwd } }, chat, publisher));
    expect(lister.listAll).not.toHaveBeenCalled();
    expect(discovery.forDirectory).not.toHaveBeenCalled();
    expect(publisher.projects().catalogue.projects).toEqual([]);
    await chat.dispose();
  });

  it("pins a cached project without rescanning sessions or rediscovering worktrees", async () => {
    const { cwd, lister, discovery, chat, publisher } = await setup();
    await chat.currentCatalogue(); lister.listAll.mockClear(); discovery.forDirectory.mockClear();
    await settle(await executeOperation({ version: 2, type: "request", requestId: "r", method: "project.pin", params: { path: cwd, pinned: true } }, chat, publisher));
    expect(lister.listAll).not.toHaveBeenCalled();
    expect(discovery.forDirectory).not.toHaveBeenCalled();
    expect(publisher.projects().catalogue.projects[0]!.pinned).toBe(true);
    await chat.dispose();
  });

  it("still performs a full scan when opening a session", async () => {
    const { path, lister, discovery, chat, publisher } = await setup();
    await chat.currentCatalogue(); lister.listAll.mockClear(); discovery.forDirectory.mockClear();
    await settle(await executeOperation({ version: 2, type: "request", requestId: "r", method: "session.open", params: { sessionPath: path } }, chat, publisher));
    expect(lister.listAll).toHaveBeenCalledOnce();
    expect(discovery.forDirectory).toHaveBeenCalledOnce();
    await chat.dispose();
  });
});
