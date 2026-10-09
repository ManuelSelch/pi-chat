import { describe, expect, it } from "vitest";
import type { ChatProjectSummary, ChatSessionSummary, ProjectCatalogue } from "../../../../../src/shared/protocol.js";
import { buildPanelGroups } from "../../../../../src/web/sessions/projects/project-panel-model.js";

let next = 0;
function session(overrides: Partial<ChatSessionSummary> = {}): ChatSessionSummary {
  next += 1;
  return { path: `/sessions/${next}.jsonl`, id: `s${next}`, title: `Chat ${next}`, nameSource: "manual", modified: next, created: 0, messageCount: 1, ...overrides };
}

function project(overrides: Partial<ChatProjectSummary> & Pick<ChatProjectSummary, "path" | "name">): ChatProjectSummary {
  return { displayPath: overrides.path, exists: true, modified: 0, sessionCount: 0, sessions: [], ...overrides };
}

function catalogue(...projects: ChatProjectSummary[]): ProjectCatalogue {
  return { projects };
}

describe("buildPanelGroups", () => {
  it("merges worktree checkouts of one repository and tags sessions with their branch", () => {
    const main = project({ path: "/repo", name: "pi-chat", repositoryPath: "/repo", repositoryName: "pi-chat", worktree: { branch: "main", detached: false, primary: true }, sessions: [session({ title: "On main", modified: 5 })], sessionCount: 1 });
    const feature = project({ path: "/repo-feature", name: "feature", displayPath: "~/.worktrees/repo/feature", repositoryPath: "/repo", repositoryName: "pi-chat", worktree: { branch: "feat/x", detached: false, primary: false }, sessions: [session({ title: "Feature work", modified: 9 })], sessionCount: 1 });

    const [group] = buildPanelGroups(catalogue(main, feature), "/repo-feature");

    expect(group?.key).toBe("/repo");
    expect(group?.name).toBe("pi-chat");
    expect(group?.sessions.map(entry => [entry.session.title, entry.branch])).toEqual([["Feature work", "feat/x"], ["On main", "main"]]);
    expect(group?.activeCount).toBe(2);
    const byTitle = new Map((group?.sessions ?? []).map(entry => [entry.session.title, entry]));
    expect(byTitle.get("Feature work")?.worktreeLabel).toBe(true);
    // The primary checkout keeps the session title even with one session.
    expect(byTitle.get("On main")?.worktreeLabel).toBe(false);
  });

  it("labels a lone worktree session with the worktree name and keeps titles when several share one", () => {
    const feature = project({ path: "/repo-feature", name: "feature", repositoryPath: "/repo", repositoryName: "pi-chat", worktree: { branch: "feat/x", detached: false, primary: false }, sessions: [session({ title: "Only one" })], sessionCount: 1 });
    const other = project({ path: "/repo-other", name: "other", repositoryPath: "/repo", repositoryName: "pi-chat", worktree: { branch: "feat/y", detached: false, primary: false }, sessions: [session({ title: "First" }), session({ title: "Second" })], sessionCount: 2 });

    const [group] = buildPanelGroups(catalogue(feature, other), "/repo-feature");
    const byTitle = new Map((group?.sessions ?? []).map(entry => [entry.session.title, entry]));

    expect(byTitle.get("Only one")?.worktreeLabel).toBe(true);
    expect(byTitle.get("First")?.worktreeLabel).toBe(false);
    expect(byTitle.get("Second")?.worktreeLabel).toBe(false);
  });

  it("puts Quick Chats first and keeps it out of repository grouping", () => {
    const quick = project({ path: "/home/me", name: "Quick Chats", displayPath: "~", quickChats: true, sessions: [session()], sessionCount: 1 });
    const folder = project({ path: "/work/app", name: "app", sessions: [session()], sessionCount: 1 });

    const groups = buildPanelGroups(catalogue(folder, quick), "/work/app");

    expect(groups.map(group => group.name)).toEqual(["Quick Chats", "app"]);
    expect(groups[0]?.quickChats).toBe(true);
    expect(groups[1]?.quickChats).toBe(false);
  });

  it("sorts pinned groups first and hides empty projects, but keeps a primary checkout with a visible worktree", () => {
    const pinned = project({ path: "/work/pinned", name: "pinned", pinned: true, sessions: [session()], sessionCount: 1 });
    const empty = project({ path: "/work/empty", name: "empty" });
    const primary = project({ path: "/repo", name: "repo", repositoryPath: "/repo", repositoryName: "repo", worktree: { branch: "main", detached: false, primary: true } });
    const feature = project({ path: "/repo-feature", name: "feature", repositoryPath: "/repo", repositoryName: "repo", worktree: { branch: "feat/x", detached: false, primary: false }, sessions: [session()], sessionCount: 1 });

    const groups = buildPanelGroups(catalogue(empty, primary, feature, pinned), "/work/pinned");

    expect(groups.map(group => group.name)).toEqual(["pinned", "repo"]);
  });
});
