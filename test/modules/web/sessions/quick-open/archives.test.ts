import { describe, expect, it } from "vitest";
import { buildQuickOpenItems } from "../../../../../src/web/sessions/quick-open/quick-open.js";
describe("default resume search", () => {
  it("excludes archived sessions but keeps their project discoverable", () => {
    const items = buildQuickOpenItems({ projects: [{ path: "/repo", displayPath: "/repo", name: "repo", exists: true, modified: 1, sessionCount: 0, pinned: true, sessions: [{ path: "/old.jsonl", id: "old", title: "Old", nameSource: "none", modified: 1, created: 0, messageCount: 2, archivedAt: 2 }] }] }, []);
    expect(items.map(item => item.kind)).toEqual(["project"]);
  });
});
