import { expect, it } from "vitest";
import { inboxRows, reconcileLater, type LaterEntry } from "../../../../../../src/web/sessions/inbox/domain/inbox-model.js";
import { loadLater, saveLater, laterStorageKey } from "../../../../../../src/web/sessions/inbox/infra/later-storage.js";
import type { ProjectCatalogue, Tab } from "../../../../../../src/web/app/state/view-types.js";

const catalogue: ProjectCatalogue = { projects: [{ path: "/p", displayPath: "/p", name: "Project", exists: true, modified: 10, sessionCount: 2, worktree: { primary: true, branch: "main", detached: false }, sessions: [
  { path: "/a", id: "a", title: "Saved A", nameSource: "manual", modified: 10, created: 1, messageCount: 1 },
  { path: "/b", id: "b", title: "Saved B", nameSource: "manual", modified: 5, created: 1, messageCount: 1 },
] }] };
const tab: Tab = { sessionId: "runtime", sessionPath: "/a", projectPath: "/p", projectName: "Project", title: "Open A", status: "idle" };

it("uses real runtime status and catalogue context, without marking completed responses unread", () => {
  expect(inboxRows([tab], catalogue)[0]).toMatchObject({ title: "Open A", status: "idle", project: "Project", branch: "main", modified: 10 });
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
