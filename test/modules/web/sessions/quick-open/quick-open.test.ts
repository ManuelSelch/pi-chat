import { describe, expect, it } from "vitest";
import type { ProjectCatalogue } from "../../../../../src/shared/protocol.js";
import { buildQuickOpenItems, parseQuickOpenQuery, rankQuickOpen } from "../../../../../src/web/sessions/quick-open/quick-open.js";

const HOUR = 3_600_000;

const catalogue: ProjectCatalogue = {
  projects: [
    {
      path: "/work/pi-chat",
      displayPath: "/work/pi-chat",
      name: "pi-chat",
      exists: true,
      modified: 5 * HOUR,
      sessionCount: 2,
      sessions: [
        { path: "/s/obsidian.jsonl", id: "s1", title: "Obsidian Notes", nameSource: "manual", modified: 5 * HOUR, created: 0, messageCount: 24 },
        { path: "/s/old.jsonl", id: "s2", title: "Notes About Obsidian", nameSource: "auto", modified: 1 * HOUR, created: 0, messageCount: 3 },
      ],
    },
    {
      path: "/work/obsidian-plugins",
      displayPath: "/work/obsidian-plugins",
      name: "obsidian-plugins",
      exists: true,
      modified: 3 * HOUR,
      sessionCount: 1,
      sessions: [
        { path: "/s/plugin.jsonl", id: "s3", title: "Ping", nameSource: "auto", modified: 3 * HOUR, created: 0, messageCount: 7 },
      ],
    },
  ],
};

const items = buildQuickOpenItems(catalogue, ["s3"]);

describe("quick open", () => {
  it("flattens sessions and projects, marking the ones already in a tab", () => {
    expect(items.filter((item) => item.kind === "session")).toHaveLength(3);
    expect(items.filter((item) => item.kind === "project")).toHaveLength(2);
    expect(items.find((item) => item.path === "/s/plugin.jsonl")?.isOpen).toBe(true);
    expect(items.find((item) => item.path === "/s/obsidian.jsonl")?.isOpen).toBe(false);
  });

  it("shows the most recent sessions before anything is typed", () => {
    const results = rankQuickOpen(items, "");

    expect(results.map((item) => item.title)).toEqual(["Obsidian Notes", "Ping", "Notes About Obsidian"]);
    expect(results.every((item) => item.kind === "session")).toBe(true);
  });

  it("shows matching projects followed by sessions newest first", () => {
    const results = rankQuickOpen(items, "obsidian");

    expect(results.map((item) => item.title)).toEqual([
      "obsidian-plugins",
      "Obsidian Notes",
      "Ping",
      "Notes About Obsidian",
    ]);
  });

  it("finds a session by its project name", () => {
    expect(rankQuickOpen(items, "pi-chat").map((item) => item.title)).toEqual([
      "pi-chat",
      "Obsidian Notes",
      "Notes About Obsidian",
    ]);
  });

  it("returns nothing when no name matches", () => {
    expect(rankQuickOpen(items, "zzz")).toEqual([]);
  });

  it.each([
    [" # Pi-Chat ", "project", "pi-chat"],
    ["%feature", "worktree", "feature"],
    ["@", "session", ""],
    ["/ settings", "action", "settings"],
    ["> action", undefined, "> action"],
    ["notes @", undefined, "notes @"],
  ])("parses only a leading scope in %s", (query, kind, text) => {
    expect(parseQuickOpenQuery(query!)).toEqual({ kind, text });
  });

  it("filters scoped queries and lists all entries of an empty scope", () => {
    expect(rankQuickOpen(items, "#obsidian").map((item) => item.title)).toEqual(["obsidian-plugins"]);
    expect(rankQuickOpen(items, "@obsidian").every((item) => item.kind === "session")).toBe(true);
    expect(rankQuickOpen(items, "#")).toHaveLength(2);
    expect(rankQuickOpen(items, "@")).toHaveLength(3);
    expect(rankQuickOpen(items, "%")).toEqual([]);
  });

  it("matches abbreviations and one-character typos without matching unrelated text", () => {
    expect(rankQuickOpen(items, "@obsnts")[0]?.title).toBe("Obsidian Notes");
    expect(rankQuickOpen(items, "@obsidain")[0]?.title).toBe("Obsidian Notes");
    expect(rankQuickOpen(items, "@obsidien")[0]?.title).toBe("Obsidian Notes");
    expect(rankQuickOpen(items, "@obsidianx")[0]?.title).toBe("Obsidian Notes");
    expect(rankQuickOpen(items, "@obsidan")[0]?.title).toBe("Obsidian Notes");
    expect(rankQuickOpen(items, "xyq")).toEqual([]);
  });

  it("ranks title matches ahead of context and breaks ties independently of input order", () => {
    const tied = [
      { ...items[0]!, path: "/b", title: "Same", modified: 1 },
      { ...items[0]!, path: "/a", title: "Same", modified: 1 },
    ];
    expect(rankQuickOpen(tied, "same").map((item) => item.path)).toEqual(["/a", "/b"]);
    expect(rankQuickOpen([...tied].reverse(), "same")).toEqual(rankQuickOpen(tied, "same"));
    expect(rankQuickOpen(tied, "")).toEqual(rankQuickOpen([...tied].reverse(), ""));
  });

  it("distinguishes linked worktrees from primary projects and carries session context", () => {
    const primary = { ...catalogue.projects[0]!, repositoryPath: "/work/pi-chat", repositoryName: "pi-chat", worktree: { primary: true, detached: false, branch: "main" } };
    const linked = { ...primary, path: "/trees/feature", displayPath: "~/trees/feature", name: "feature", worktree: { primary: false, detached: false, branch: "feat/palette" } };
    const detached = { ...linked, path: "/trees/detached", name: "detached", sessions: [], worktree: { primary: false, detached: true, commit: "abcdef" } };
    const results = buildQuickOpenItems({ projects: [primary, linked, detached] }, []);
    expect(results.find((item) => item.path === primary.path)?.kind).toBe("project");
    expect(results.find((item) => item.path === linked.path)).toMatchObject({ kind: "worktree", branch: "feat/palette", repositoryName: "pi-chat", projectPath: linked.path, displayPath: linked.displayPath });
    expect(rankQuickOpen(results, "%palette").map((item) => item.path)).toEqual([linked.path]);
    expect(rankQuickOpen(results, "%pi-chat")).toHaveLength(2);
    expect(rankQuickOpen(results, "@palette")).toHaveLength(2);
    expect(rankQuickOpen(results, "#main").map((item) => item.path)).toEqual([primary.path]);
    expect(rankQuickOpen(results, "%detached")[0]).toMatchObject({ kind: "worktree", detached: true, commit: "abcdef" });
  });

  it("finds sessions by their checkout path without searching session storage paths", () => {
    expect(rankQuickOpen(items, "@/work/pi-chat")).toHaveLength(2);
    expect(rankQuickOpen(items, "@jsonl")).toEqual([]);
  });

  it("sorts matching sessions by date rather than title-match strength", () => {
    const candidates = [
      { ...items[0]!, path: "/context", title: "Other", project: "palette", modified: 100 },
      { ...items[0]!, path: "/fuzzy", title: "Palete", modified: 100 },
      { ...items[0]!, path: "/prefix", title: "Palette work", modified: 100 },
      { ...items[0]!, path: "/exact", title: "Palette", modified: 1 },
    ];
    expect(rankQuickOpen(candidates, "palette").map((item) => item.path)).toEqual(["/context", "/fuzzy", "/prefix", "/exact"]);
  });

  it("does not mutate inputs and handles an empty catalogue", () => {
    const original = [...items];
    rankQuickOpen(items, "obsidian");
    rankQuickOpen(items, "#");
    expect(items).toEqual(original);
    expect(buildQuickOpenItems({ projects: [] }, [])).toEqual([]);
    expect(rankQuickOpen([], "@")).toEqual([]);
  });

  it("searches provided built-in actions with / and unscoped text", () => {
    const withActions = buildQuickOpenItems(catalogue, [], [
      { id: "settings", name: "Open settings", description: "Models and appearance", run: () => {} },
      { id: "new-session", name: "New session", description: "Start in the current folder", run: () => {} },
    ]);
    expect(rankQuickOpen(withActions, "/")).toHaveLength(2);
    expect(rankQuickOpen(withActions, "/setings")[0]).toMatchObject({ kind: "action", action: { id: "settings" } });
    expect(rankQuickOpen(withActions, "appearance")[0]?.kind).toBe("action");
    expect(rankQuickOpen(withActions, "").every((item) => item.kind === "session")).toBe(true);
  });

  it("caps the result list", () => {
    expect(rankQuickOpen(items, "", 2)).toHaveLength(2);
    expect(rankQuickOpen(items, "obsidian", 2)).toHaveLength(2);
    expect(rankQuickOpen(items, "#", 1)).toHaveLength(1);
    expect(rankQuickOpen(items, "obsidian", 0)).toEqual([]);
  });
});
