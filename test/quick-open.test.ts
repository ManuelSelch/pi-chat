import { describe, expect, it } from "vitest";
import type { ProjectCatalogue } from "../src/shared/protocol.js";
import { buildQuickOpenItems, rankQuickOpen } from "../src/web/quickopen/quick-open.js";

const HOUR = 3_600_000;

const catalogue: ProjectCatalogue = {
  projects: [
    {
      path: "/work/pi-chat",
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

  it("ranks a title prefix above a word match above a plain substring", () => {
    const results = rankQuickOpen(items, "obsidian");

    expect(results.map((item) => item.title)).toEqual([
      "Obsidian Notes", // title starts with the query
      "Notes About Obsidian", // a later word starts with it
      "Ping", // only its project matches
      "obsidian-plugins", // the project itself, after all sessions
    ]);
  });

  it("finds a session by its project name", () => {
    expect(rankQuickOpen(items, "pi-chat").map((item) => item.title)).toEqual([
      "Obsidian Notes",
      "Notes About Obsidian",
      "pi-chat",
    ]);
  });

  it("returns nothing when no name matches", () => {
    expect(rankQuickOpen(items, "zzz")).toEqual([]);
  });

  it("caps the result list", () => {
    expect(rankQuickOpen(items, "", 2)).toHaveLength(2);
  });
});
