import { describe, expect, it } from "vitest";
import { ProjectSessionService } from "../src/server/project-session-service.js";

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

describe("ProjectSessionService", () => {
  it("groups sessions by project and sorts by recent activity", async () => {
    const lister = {
      listAll: async () => [
        info({ id: "old", cwd: process.cwd(), modified: 1_000, firstMessage: "old chat" }),
        info({ id: "new", cwd: process.cwd(), modified: 3_000, name: "Named chat" }),
      ],
    };

    const catalogue = await new ProjectSessionService(lister).catalogue();

    expect(catalogue.projects).toHaveLength(1);
    expect(catalogue.projects[0]?.sessionCount).toBe(2);
    expect(catalogue.projects[0]?.sessions.map((session) => session.id)).toEqual(["new", "old"]);
    expect(catalogue.projects[0]?.sessions[0]?.title).toBe("Named chat");
    expect(catalogue.projects[0]?.sessions[1]?.title).toBe("old chat");
  });

  it("ignores legacy sessions without a cwd", async () => {
    const lister = { listAll: async () => [info({ id: "legacy", cwd: "" })] };

    await expect(new ProjectSessionService(lister).catalogue()).resolves.toEqual({ projects: [] });
  });

  it("includes the active empty session even before Pi listAll can see it", async () => {
    const lister = { listAll: async () => [] };

    const catalogue = await new ProjectSessionService(lister).catalogue({
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
});
