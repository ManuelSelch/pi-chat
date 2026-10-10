import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ProjectMetadataStore } from "../../../../src/server/projects/project-metadata-store.js";
import { ProjectSessionService, formatProjectDisplayPath, formatProjectName, readLatestSessionNameInfo } from "../../../../src/server/projects/project-session-service.js";

const noWorktrees = { forDirectory: async () => undefined };
// Empty home disables the always-present Quick Chats project for focused tests.
const noQuickChats = "";
const isolatedMetadata = () => new ProjectMetadataStore(join(tmpdir(), `pi-chat-meta-${crypto.randomUUID()}.json`));

function info(overrides: Partial<any>) {
  return {
    path: `/sessions/${overrides.id}.jsonl`,
    id: overrides.id ?? "s1",
    cwd: overrides.cwd ?? process.cwd(),
    name: overrides.name,
    created: new Date(overrides.created ?? 1_000),
    modified: new Date(overrides.modified ?? 1_000),
    messageCount: overrides.messageCount ?? 1,
    firstMessage: overrides.firstMessage ?? "hello",
    allMessagesText: "hello",
  };
}

describe("session name source detection", () => {
  it("detects latest auto and manual session names", async () => {
    const dir = join(tmpdir(), `pi-chat-session-${crypto.randomUUID()}`);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "session.jsonl");
    await writeFile(
      path,
      [
        JSON.stringify({ type: "session", id: "s1", timestamp: new Date(0).toISOString() }),
        JSON.stringify({ type: "session_info", name: "Generated", autoTitle: true }),
        JSON.stringify({ type: "session_info", name: "Manual" }),
      ].join("\n"),
    );

    await expect(readLatestSessionNameInfo(path)).resolves.toEqual({ name: "Manual", source: "manual" });
  });

  it("treats an empty latest session_info as unnamed", async () => {
    const dir = join(tmpdir(), `pi-chat-session-${crypto.randomUUID()}`);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "session.jsonl");
    await writeFile(path, `${JSON.stringify({ type: "session_info", name: "Generated", autoTitle: true })}\n${JSON.stringify({ type: "session_info", name: "" })}`);

    await expect(readLatestSessionNameInfo(path)).resolves.toEqual({ source: "none" });
  });
});

describe("formatProjectName", () => {
  it("keeps specific project folder names unchanged", () => {
    expect(formatProjectName("/work/pi-chat")).toBe("pi-chat");
  });

  it("prefixes generic project folder names with their parent", () => {
    expect(formatProjectName("/work/project-a/frontend")).toBe("project-a/frontend");
    expect(formatProjectName("/work/project-a/backend")).toBe("project-a/backend");
  });

  it("handles Windows-style generic project paths", () => {
    expect(formatProjectName("C:\\work\\project-a\\frontend")).toBe("project-a/frontend");
  });
});

describe("formatProjectDisplayPath", () => {
  it("shortens Unix home paths", () => {
    expect(formatProjectDisplayPath("/Users/me/Documents/pi-chat", "/Users/me")).toBe("~/Documents/pi-chat");
    expect(formatProjectDisplayPath("/Users/me", "/Users/me")).toBe("~");
  });

  it("shortens Windows home paths and normalizes separators for display", () => {
    expect(formatProjectDisplayPath("C:\\Users\\Me\\Documents\\pi-chat", "C:\\Users\\Me")).toBe("~/Documents/pi-chat");
  });

  it("leaves paths outside home absolute", () => {
    expect(formatProjectDisplayPath("/Volumes/Drive/project", "/Users/me")).toBe("/Volumes/Drive/project");
  });
});

describe("ProjectSessionService", () => {
  it("groups sessions by project and sorts by recent activity", async () => {
    const lister = {
      listAll: async () => [
        info({ id: "old", cwd: process.cwd(), modified: 1_000, firstMessage: "old chat" }),
        info({ id: "new", cwd: process.cwd(), modified: 3_000, name: "Named chat" }),
      ],
    };

    const catalogue = await new ProjectSessionService(lister, undefined, noWorktrees, isolatedMetadata(), noQuickChats).catalogue();

    expect(catalogue.projects).toHaveLength(1);
    expect(catalogue.projects[0]?.displayPath).toBe(formatProjectDisplayPath(process.cwd()));
    expect(catalogue.projects[0]?.name).toBe(formatProjectName(process.cwd()));
    expect(catalogue.projects[0]?.sessionCount).toBe(2);
    expect(catalogue.projects[0]?.sessions.map((session) => session.id)).toEqual(["new", "old"]);
    expect(catalogue.projects[0]?.sessions[0]?.title).toBe("hello");
    expect(catalogue.projects[0]?.sessions[1]?.title).toBe("old chat");
  });

  it("adds registered primary and zero-session linked worktrees", async () => {
    const lister = { listAll: async () => [info({ id: "feature", cwd: "/repo/feature" })] };
    const discovery = {
      forDirectory: async () => ({
        repositoryPath: "/repo/main",
        worktrees: [
          { path: "/repo/main", branch: "main", commit: "abc", detached: false, primary: true },
          { path: "/repo/feature", branch: "feature", commit: "def", detached: false, primary: false },
          { path: "/repo/empty", branch: "empty", commit: "ghi", detached: false, primary: false },
        ],
      }),
    };

    const catalogue = await new ProjectSessionService(lister, undefined, discovery, isolatedMetadata(), noQuickChats).catalogue();

    expect(catalogue.projects.map((project) => project.path)).toEqual(["/repo/feature", "/repo/main", "/repo/empty"]);
    expect(catalogue.projects.find((project) => project.path === "/repo/feature")).toMatchObject({ repositoryPath: "/repo/main", worktree: { branch: "feature", primary: false }, sessionCount: 1 });
    expect(catalogue.projects.find((project) => project.path === "/repo/empty")).toMatchObject({ repositoryPath: "/repo/main", worktree: { branch: "empty", primary: false }, sessionCount: 0 });
  });

  it("ignores legacy sessions without a cwd", async () => {
    const lister = { listAll: async () => [info({ id: "legacy", cwd: "" })] };

    await expect(new ProjectSessionService(lister, undefined, noWorktrees, isolatedMetadata(), noQuickChats).catalogue()).resolves.toEqual({ projects: [] });
  });

  it("includes the active empty session even before Pi listAll can see it", async () => {
    const lister = { listAll: async () => [] };

    const catalogue = await new ProjectSessionService(lister, undefined, noWorktrees, isolatedMetadata(), noQuickChats).catalogue({
      id: "fresh",
      path: "/sessions/project/fresh.jsonl",
      cwd: process.cwd(),
      messageCount: 0,
    });

    expect(catalogue.projects).toHaveLength(1);
    expect(catalogue.projects[0]?.sessionCount).toBe(1);
    expect(catalogue.projects[0]?.sessions[0]).toMatchObject({
      id: "fresh",
      path: "/sessions/project/fresh.jsonl",
      title: "New session",
      messageCount: 0,
    });
  });

  it("updates the active session title from active runtime state", async () => {
    const lister = { listAll: async () => [info({ id: "s1", path: "/sessions/project/s1.jsonl", name: "Old name" })] };

    const catalogue = await new ProjectSessionService(lister, undefined, noWorktrees, isolatedMetadata(), noQuickChats).catalogue({
      id: "s1",
      path: "/sessions/project/s1.jsonl",
      name: "New name",
      nameSource: "manual",
      cwd: process.cwd(),
      messageCount: 2,
    });

    expect(catalogue.projects[0]?.sessions[0]).toMatchObject({ title: "New name", name: "New name", nameSource: "manual", messageCount: 2 });
  });
});

describe("quick chats", () => {
  it("always includes the home folder first as Quick Chats", async () => {
    const home = await mkdtemp(join(tmpdir(), "pi-chat-home-"));
    const lister = { listAll: async () => [info({ id: "work", cwd: "/work/project" })] };

    const catalogue = await new ProjectSessionService(lister, undefined, noWorktrees, isolatedMetadata(), home).catalogue();

    expect(catalogue.projects[0]).toMatchObject({ path: await realpath(home), name: "Quick Chats", quickChats: true, sessionCount: 0, displayPath: "~" });
    expect(catalogue.projects.filter(project => project.quickChats)).toHaveLength(1);
  });

  it("labels home sessions as Quick Chats instead of a project", async () => {
    const home = await mkdtemp(join(tmpdir(), "pi-chat-home-"));
    const lister = { listAll: async () => [info({ id: "chat", cwd: home, firstMessage: "plan a trip" })] };

    const catalogue = await new ProjectSessionService(lister, undefined, noWorktrees, isolatedMetadata(), home).catalogue();

    expect(catalogue.projects).toHaveLength(1);
    expect(catalogue.projects[0]).toMatchObject({ path: await realpath(home), name: "Quick Chats", quickChats: true, sessionCount: 1 });
    expect(catalogue.projects[0]!.sessions[0]!.title).toBe("plan a trip");
  });
});

describe("archiving a session", () => {
  it("keeps the file in the session folder", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-chat-delete-"));
    const sessions = join(root, "sessions", "project");
    await mkdir(sessions, { recursive: true });
    const target = join(sessions, "one.jsonl");
    await writeFile(target, JSON.stringify({ type: "session", id: "one", cwd: root }));

    const service = new ProjectSessionService({ listAll: async () => [] }, join(root, "sessions"));
    await service.archive(target, true);

    expect(existsSync(target)).toBe(true);
  });

  it("refuses a path outside the session folder", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-chat-delete-"));
    const outsider = join(root, "notes.jsonl");
    await writeFile(outsider, "{}");

    const service = new ProjectSessionService({ listAll: async () => [] }, join(root, "sessions"));

    await expect(service.archive(outsider, true)).rejects.toThrow(/outside the Pi session folder/);
    expect(existsSync(outsider)).toBe(true);
  });

  it("refuses anything that is not a session file", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-chat-delete-"));
    const sessions = join(root, "sessions");
    await mkdir(sessions, { recursive: true });
    const settings = join(sessions, "settings.json");
    await writeFile(settings, "{}");

    const service = new ProjectSessionService({ listAll: async () => [] }, sessions);

    await expect(service.archive(settings, true)).rejects.toThrow(/outside the Pi session folder/);
    expect(existsSync(settings)).toBe(true);
  });

  it("reports a session that is already gone", async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-chat-delete-"));
    const sessions = join(root, "sessions");
    await mkdir(sessions, { recursive: true });

    const service = new ProjectSessionService({ listAll: async () => [] }, sessions);

    await expect(service.archive(join(sessions, "missing.jsonl"), true)).rejects.toThrow(/no longer exists/);
  });
});
