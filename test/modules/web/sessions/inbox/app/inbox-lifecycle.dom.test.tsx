// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useInboxLifecycle } from "../../../../../../src/web/sessions/inbox/app/use-inbox-lifecycle.js";
import { initialAppState, type AppState } from "../../../../../../src/web/app/state/app-state.js";
import { loadLater, saveLater } from "../../../../../../src/web/sessions/inbox/infra/later-storage.js";

const endpoint = "ws://localhost/ws";
const history = { path: "/a", id: "saved", title: "A", nameSource: "manual" as const, modified: 1, created: 0, messageCount: 1 };
let app: AppState;
let operations: { close: ReturnType<typeof vi.fn<(id: string) => Promise<void>>>; open: ReturnType<typeof vi.fn<(path: string) => Promise<string>>>; archive: ReturnType<typeof vi.fn<(path: string, archived: boolean) => Promise<void>>>; focus: ReturnType<typeof vi.fn<(id: string) => void>> };
beforeEach(() => {
  localStorage.clear();
  app = { ...initialAppState, connection: "open", tabsKnown: true, catalogueKnown: true, activeSessionId: "a", tabs: [{ sessionId: "a", sessionPath: "/a", title: "A", projectName: "P", projectPath: "/p", status: "idle" }], catalogue: { projects: [{ path: "/p", displayPath: "/p", name: "P", exists: true, modified: 1, sessionCount: 1, sessions: [history] }] } };
  operations = { close: vi.fn(async () => {}), open: vi.fn(async () => "new"), archive: vi.fn(async () => {}), focus: vi.fn() };
});
afterEach(cleanup);
const mount = () => renderHook(() => useInboxLifecycle(app, endpoint, operations));

it("does not discard Later against the cold-start catalogue placeholder", () => {
  const catalogue = app.catalogue;
  app = { ...app, tabs: [], catalogue: { projects: [] }, catalogueKnown: false };
  saveLater(endpoint, [{ path: "/a", phase: "parked" }]);
  const { result, rerender } = mount();

  expect(loadLater(endpoint)).toEqual([{ path: "/a", phase: "parked" }]);

  app = { ...app, catalogue, catalogueKnown: true };
  rerender();
  expect(result.current.later).toHaveLength(1);
  expect(loadLater(endpoint)).toEqual([{ path: "/a", phase: "parked" }]);
});

it("parks an unloaded saved conversation without opening or closing a runtime", async () => {
  app = { ...app, tabs: [] };
  const { result } = mount();

  await act(async () => result.current.park("/a"));

  expect(loadLater(endpoint)).toEqual([{ path: "/a", phase: "parked" }]);
  expect(result.current.later).toHaveLength(1);
  expect(operations.close).not.toHaveBeenCalled();
  expect(operations.open).not.toHaveBeenCalled();
});

it("retains Later subtitles while an unsaved sibling exists and compacts when it closes", () => {
  app = { ...app, tabs: [{ ...app.tabs[0]!, sessionId: "unsaved", sessionPath: undefined, title: "New conversation" }], catalogue: { projects: app.catalogue.projects.map(project => ({ ...project, worktree: { primary: false, detached: false, branch: "feat/worktree" } })) } };
  saveLater(endpoint, [{ path: "/a", phase: "parked" }]);
  const { result, rerender } = mount();

  expect(result.current.later[0]).toMatchObject({ primaryLabel: "feat/worktree", secondaryLabel: "A" });

  app = { ...app, tabs: [] };
  rerender();

  expect(result.current.later[0]?.secondaryLabel).toBeUndefined();
  expect(result.current.later[0]?.title).toBe("A");
});

it("selects unloaded Ready history by path and focuses a loaded runtime without reopening it", async () => {
  const { result, rerender } = mount();

  await act(async () => result.current.select("/a"));

  expect(operations.focus).toHaveBeenCalledWith("a");
  expect(operations.open).not.toHaveBeenCalled();

  app = { ...app, tabs: [] };
  rerender();
  await act(async () => result.current.select("/a"));

  expect(operations.open).toHaveBeenCalledExactlyOnceWith("/a");
  expect(operations.focus).toHaveBeenLastCalledWith("new");
});

it("archives an unloaded Ready conversation without creating a runtime", async () => {
  app = { ...app, tabs: [] };
  const { result } = mount();

  await act(async () => result.current.archive("/a"));

  expect(operations.archive).toHaveBeenCalledExactlyOnceWith("/a", true);
  expect(operations.open).not.toHaveBeenCalled();
  expect(result.current.later).toEqual([]);
});

it("persists parking intent before close and commits only after completion", async () => {
  operations.close.mockImplementation(async () => {
    expect(loadLater(endpoint)).toEqual([{ path: "/a", phase: "parking" }]);
    app = { ...app, tabs: [] };
  });
  const { result, rerender } = mount();

  await act(async () => result.current.park("a"));
  rerender();

  expect(operations.close).toHaveBeenCalledExactlyOnceWith("a");
  expect(loadLater(endpoint)).toEqual([{ path: "/a", phase: "parked" }]);
  expect(result.current.later).toHaveLength(1);
});

it("rolls back a definite close failure without losing the open conversation", async () => {
  operations.close.mockRejectedValue(new Error("Close failed"));
  const { result } = mount();

  await act(async () => result.current.park("a"));

  expect(result.current.error).toBe("Close failed");
  expect(loadLater(endpoint)).toEqual([]);
});

it("leaves uncertain parking durable until a new authoritative inventory reconciles it, with no retry", async () => {
  operations.close.mockRejectedValue({ outcome: "unknown", message: "Disconnected" });
  const { result, rerender } = mount();

  await act(async () => result.current.park("a"));
  expect(loadLater(endpoint)).toEqual([{ path: "/a", phase: "parking" }]);
  expect(result.current.error).toContain("No retry was sent");

  app = { ...app, tabs: [], sdkInventory: [] };
  rerender();
  expect(loadLater(endpoint)).toEqual([{ path: "/a", phase: "parked" }]);
  expect(operations.close).toHaveBeenCalledTimes(1);
});

it("guards busy sessions, missing paths and duplicate operations", async () => {
  const { result, rerender } = mount();
  app = { ...app, tabs: app.tabs.map(tab => ({ ...tab, status: "running" })) };
  rerender();
  await act(async () => result.current.park("a"));
  expect(operations.close).not.toHaveBeenCalled();

  app = { ...app, tabs: app.tabs.map(tab => ({ ...tab, status: "idle", sessionPath: undefined })) };
  rerender();
  await act(async () => result.current.park("a"));
  expect(operations.close).not.toHaveBeenCalled();
});

it("does not close an unsaved conversation just because Pi assigned it a future file path", async () => {
  app = { ...app, catalogue: { projects: [] } };
  const { result } = mount();

  await act(async () => result.current.park("a"));

  expect(operations.close).not.toHaveBeenCalled();
  expect(loadLater(endpoint)).toEqual([]);
});

it("rejects duplicate parking while the first close is still pending", async () => {
  let finish!: () => void;
  operations.close.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const { result } = mount();
  let first!: Promise<void>;

  act(() => { first = result.current.park("a"); });
  await act(async () => result.current.park("a"));
  expect(operations.close).toHaveBeenCalledTimes(1);

  await act(async () => { finish(); await first; });
});

it("leaves the open runtime alone when durable parking intent cannot be stored", async () => {
  const { result } = mount();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage denied"); });

  await act(async () => result.current.park("a"));

  expect(operations.close).not.toHaveBeenCalled();
  expect(result.current.error).toContain("Could not save Later");
  vi.restoreAllMocks();
});

it("preserves membership and reports a failed archive", async () => {
  app = { ...app, tabs: [] };
  saveLater(endpoint, [{ path: "/a", phase: "parked" }]);
  operations.archive.mockRejectedValue(new Error("Archive failed"));
  const { result } = mount();

  await act(async () => result.current.archive("/a"));

  expect(result.current.later).toHaveLength(1);
  expect(result.current.error).toBe("Archive failed");
});

it("keeps Later on failed resume and focuses the new runtime after success", async () => {
  app = { ...app, tabs: [] };
  saveLater(endpoint, [{ path: "/a", phase: "parked" }]);
  const { result } = mount();
  operations.open.mockRejectedValueOnce(new Error("Open failed"));

  await act(async () => result.current.resume("/a"));
  expect(result.current.later).toHaveLength(1);
  expect(result.current.error).toBe("Open failed");

  await act(async () => result.current.resume("/a"));
  expect(operations.focus).toHaveBeenCalledWith("new");
  expect(result.current.later).toEqual([]);
});

it("does not restore archived Later membership against stale catalogue or inventory updates", async () => {
  app = { ...app, tabs: [] };
  saveLater(endpoint, [{ path: "/a", phase: "parked" }]);
  const { result, rerender } = mount();

  await act(async () => result.current.archive("/a"));
  app = { ...app, tabs: [], sdkInventory: [] };
  rerender();

  expect(loadLater(endpoint)).toEqual([]);
  expect(result.current.later).toEqual([]);
  expect(operations.open).not.toHaveBeenCalled();
});

it("removes Later membership only after archive confirmation without opening a runtime", async () => {
  app = { ...app, tabs: [] };
  saveLater(endpoint, [{ path: "/a", phase: "parked" }]);
  let finish!: () => void;
  operations.archive.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
  const { result } = mount();
  let archive!: Promise<void>;

  act(() => { archive = result.current.archive("/a"); });

  expect(result.current.pending).toBe(true);
  expect(result.current.later).toHaveLength(1);
  expect(loadLater(endpoint)).toEqual([{ path: "/a", phase: "parked" }]);

  await act(async () => { finish(); await archive; });

  expect(result.current.later).toEqual([]);
  expect(loadLater(endpoint)).toEqual([]);
  expect(operations.archive).toHaveBeenCalledExactlyOnceWith("/a", true);
  expect(operations.open).not.toHaveBeenCalled();
});
