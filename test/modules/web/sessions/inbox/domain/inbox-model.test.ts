import { expect, it } from "vitest";
import { historyRows, inboxRows, matchingRows, reconcileLater, type LaterEntry } from "../../../../../../src/web/sessions/inbox/domain/inbox-model.js";
import { loadLater, saveLater, laterStorageKey } from "../../../../../../src/web/sessions/inbox/infra/later-storage.js";
import type { ProjectCatalogue, Tab } from "../../../../../../src/web/app/state/view-types.js";

const catalogue: ProjectCatalogue = { projects: [{ path: "/p", displayPath: "/p", name: "Project", exists: true, modified: 10, sessionCount: 2, worktree: { primary: true, branch: "main", detached: false }, sessions: [
  { path: "/a", id: "a", title: "Saved A", nameSource: "manual", modified: 10, created: 1, messageCount: 1 },
  { path: "/b", id: "b", title: "Saved B", nameSource: "manual", modified: 5, created: 1, messageCount: 1 },
] }] };
const tab: Tab = { sessionId: "runtime", sessionPath: "/a", projectPath: "/p", projectName: "Project", title: "Open A", status: "idle" };

it("uses real runtime status and catalogue context, without marking completed responses unread", () => {
  expect(inboxRows([tab], catalogue, new Set())[0]).toMatchObject({ title: "Open A", status: "idle", project: "Project", branch: "main", modified: 10 });
});

it.each(["idle", "blocked", "running"] as const)("uses repository context rather than the checkout name for %s live rows", status => {
  const linked = { projects: catalogue.projects.map(project => ({
    ...project, name: "checkout-folder", repositoryName: "my-project",
    worktree: { primary: false, detached: false, branch: "feature/setup" },
  })) };

  const rows = inboxRows([{ ...tab, projectName: "checkout-folder", status }], linked, new Set());

  expect(rows.find(row => row.sessionId === "runtime")).toMatchObject({
    project: "my-project", primaryLabel: "feature/setup", secondaryLabel: "Open A", status,
  });
  expect(matchingRows(rows, "my-project")).toHaveLength(2);
});

it("uses repository context for unloaded Ready and Later history", () => {
  const linked = { projects: catalogue.projects.map(project => ({
    ...project, name: "checkout-folder", repositoryName: "my-project",
    worktree: { primary: false, detached: false, branch: "feature/setup" },
  })) };

  expect(historyRows(linked)).toMatchObject([
    { project: "my-project", primaryLabel: "feature/setup", secondaryLabel: "Saved A" },
    { project: "my-project", primaryLabel: "feature/setup", secondaryLabel: "Saved B" },
  ]);
  expect(inboxRows([], linked, new Set(["/b"]))).toMatchObject([{ path: "/a", project: "my-project" }]);
});

it("keeps catalogue names for ordinary projects and runtime names before discovery", () => {
  expect(inboxRows([{ ...tab, projectName: "Runtime name" }], catalogue, new Set())[0]).toMatchObject({ project: "Project" });
  expect(inboxRows([tab], { projects: [] }, new Set())[0]).toMatchObject({ project: "Project" });
  const quickChats = { projects: catalogue.projects.map(project => ({ ...project, name: "Quick Chats", worktree: undefined })) };
  expect(historyRows(quickChats)[0]).toMatchObject({ project: "Quick Chats" });
});

it("shows every unarchived saved conversation after restart without reopening runtimes", () => {
  expect(inboxRows([], catalogue, new Set())).toMatchObject([
    { path: "/a", status: "idle", title: "Saved A" },
    { path: "/b", status: "idle", title: "Saved B" },
  ]);
});

it("deduplicates history against live status and excludes parked and archived history", () => {
  const archived = { ...catalogue, projects: catalogue.projects.map(project => ({ ...project, sessions: [...project.sessions, { ...project.sessions[0]!, path: "/archived", archivedAt: 20 }] })) };
  const unsaved = { ...tab, sessionId: "unsaved", sessionPath: "/future", title: "Unsaved" };

  const rows = inboxRows([{ ...tab, status: "running" }, unsaved, { ...tab, sessionId: "archived", sessionPath: "/archived" }], archived, new Set(["/b"]));

  expect(rows).toHaveLength(2);
  expect(rows.find(row => row.path === "/a")).toMatchObject({ sessionId: "runtime", status: "running" });
  expect(rows.find(row => row.sessionId === "unsaved")).toMatchObject({ title: "Unsaved", path: undefined });
});

it.each(["idle", "blocked", "running"] as const)("promotes the linked-worktree branch for %s live rows without changing identity or title", status => {
  const linked = { projects: catalogue.projects.map(project => ({ ...project, worktree: { primary: false, detached: false, branch: "feat/worktree" } })) };

  const rows = inboxRows([{ ...tab, status }], linked, new Set());

  expect(rows.find(row => row.sessionId === "runtime")).toMatchObject({ primaryLabel: "feat/worktree", secondaryLabel: "Open A", title: "Open A", path: "/a", status });
  expect(matchingRows(rows, "Open A")).toHaveLength(1);
  expect(matchingRows(rows, "feat/worktree")).toHaveLength(2);
});

it("retains distinct conversation subtitles for saved sessions sharing one worktree, including Later history", () => {
  const linked = { projects: catalogue.projects.map(project => ({ ...project, worktree: { primary: false, detached: false, branch: "feat/worktree" } })) };

  expect(historyRows(linked)).toMatchObject([
    { primaryLabel: "feat/worktree", secondaryLabel: "Saved A" },
    { primaryLabel: "feat/worktree", secondaryLabel: "Saved B" },
  ]);
  expect(inboxRows([], linked, new Set(["/b"]))).toMatchObject([{ path: "/a", primaryLabel: "feat/worktree", secondaryLabel: "Saved A" }]);
});

it.each([
  { primary: true, detached: false, branch: "main" },
  { primary: false, detached: false, branch: "" },
  { primary: false, detached: true },
  undefined,
])("keeps conversation titles primary without a named linked worktree (%j)", worktree => {
  const history = { projects: catalogue.projects.map(project => ({ ...project, worktree })) };

  const rows = inboxRows([tab], history, new Set());

  expect(rows[0]).toMatchObject({ primaryLabel: "Open A" });
  expect(rows[0]?.secondaryLabel).toBeUndefined();
  expect(rows[1]).toMatchObject({ primaryLabel: "Saved B" });
});

it("does not repeat a session title identical to the promoted branch", () => {
  const linked = { projects: catalogue.projects.map(project => ({ ...project, worktree: { primary: false, detached: false, branch: "feat/worktree" } })) };

  const row = inboxRows([{ ...tab, title: "feat/worktree" }], linked, new Set())[0];

  expect(row).toMatchObject({ primaryLabel: "feat/worktree" });
  expect(row?.secondaryLabel).toBeUndefined();
});

it("keeps only closed unarchived history in Later and resolves pending parking from inventory", () => {
  const entries: LaterEntry[] = [ { path: "/a", phase: "parked" }, { path: "/b", phase: "parking" }, { path: "/gone", phase: "parked" } ];
  expect(reconcileLater(entries, [tab], catalogue)).toEqual([{ path: "/b", phase: "parked" }]);
  expect(reconcileLater([{ path: "/a", phase: "parking" }], [tab], catalogue)).toEqual([]);
});

it("retains a pending parking intent while a reconnected runtime is still closing", () => {
  expect(reconcileLater([{ path: "/a", phase: "parking" }], [tab], catalogue, new Set(["/a"]))).toEqual([{ path: "/a", phase: "parking" }]);
});

it("never retains archived conversations", () => {
  const archived: ProjectCatalogue = { projects: catalogue.projects.map(p => ({ ...p, sessions: p.sessions.map(s => ({ ...s, archivedAt: 20 })) })) };
  expect(reconcileLater([{ path: "/b", phase: "parked" }], [], archived)).toEqual([]);
});

it("validates persisted membership and isolates normalized server endpoints", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  saveLater("ws://localhost:80/ws", [{ path: "/a", phase: "parking" }], storage);
  expect(loadLater("ws://localhost/ws", storage)).toEqual([{ path: "/a", phase: "parking" }]);
  expect(loadLater("ws://other/ws", storage)).toEqual([]);
  values.set(laterStorageKey("ws://localhost/ws"), '[{"path":3,"phase":"parked"}]');
  expect(() => loadLater("ws://localhost/ws", storage)).toThrow(/Later/);
});

it("reports storage failures instead of pretending a session was durably parked", () => {
  expect(() => saveLater("ws://localhost/ws", [], { setItem: () => { throw new Error("denied"); } })).toThrow(/Later/);
});
