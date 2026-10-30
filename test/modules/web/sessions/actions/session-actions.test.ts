import { expect, it, vi } from "vitest";
import { buildSessionActions, type SessionActionState } from "../../../../../src/web/sessions/actions/session-actions.js";

function setup(overrides: Partial<SessionActionState> = {}) {
  let state: SessionActionState = { sessionId: "one", projectPath: "/repo", sessionPath: "/sessions/one", connected: true, busy: false, navigation: "tabs", ...overrides };
  const operations = { newSession: vi.fn(), closeSession: vi.fn(), parkSession: vi.fn(), archiveSession: vi.fn(), openFolder: vi.fn(), openSettings: vi.fn() };
  const actions = buildSessionActions(state, operations, () => state);
  return { actions, operations, update: (changes: Partial<SessionActionState>) => { state = { ...state, ...changes }; } };
}
it("defines the stable session actions and invokes existing operations", () => {
  const { actions, operations } = setup();
  expect(actions.map(action => action.id)).toEqual(["new-session", "close-session", "archive-session", "open-folder", "settings"]);
  for (const action of actions) action.run();
  expect(operations.newSession).toHaveBeenCalledWith("/repo");
  expect(operations.closeSession).toHaveBeenCalledWith("one");
  expect(operations.archiveSession).toHaveBeenCalledWith("one", "/sessions/one");
  expect(operations.openFolder).toHaveBeenCalledOnce();
  expect(operations.openSettings).toHaveBeenCalledOnce();
});
it("only offers New session and UI actions on Home", () => {
  const { actions, operations } = setup({ sessionId: "", sessionPath: undefined });
  expect(actions.map(action => action.id)).toEqual(["new-session", "open-folder", "settings"]);
  actions[0]!.run();
  expect(operations.newSession).toHaveBeenCalledWith(undefined);
});
it("labels the three Inbox-mode actions Close Session, Later and Archive Session", () => {
  const { actions } = setup({ navigation: "inbox" });
  expect(actions.map(action => action.id)).toEqual(["new-session", "close-session", "later-session", "archive-session", "open-folder", "settings"]);
  expect(actions.find(action => action.id === "close-session")!.name).toBe("Close Session");
  expect(actions.find(action => action.id === "later-session")!.name).toBe("Later");
  expect(actions.find(action => action.id === "archive-session")!.name).toBe("Archive Session");
});
it("routes close and Later through separate operations", () => {
  const { actions, operations } = setup({ navigation: "inbox" });
  actions.find(action => action.id === "close-session")!.run();
  actions.find(action => action.id === "later-session")!.run();
  expect(operations.closeSession).toHaveBeenCalledWith("one");
  expect(operations.parkSession).toHaveBeenCalledWith("one");
});
it("hides Later outside Inbox mode", () => {
  expect(setup().actions.some(action => action.id === "later-session")).toBe(false);
});
it("keeps Later and Archive listed but disabled while busy or unsaved", () => {
  const running = setup({ navigation: "inbox", busy: true }).actions;
  expect(running.find(action => action.id === "later-session")!.disabled).toBe(true);
  expect(running.find(action => action.id === "archive-session")!.disabled).toBe(true);
  expect(running.find(action => action.id === "close-session")!.disabled).toBeUndefined();
  const unsaved = setup({ navigation: "inbox", sessionPath: undefined }).actions;
  expect(unsaved.find(action => action.id === "later-session")!.disabled).toBe(true);
  expect(unsaved.find(action => action.id === "archive-session")!.disabled).toBe(true);
});
it("guards stale session targets and live busy/connection changes", () => {
  const { actions, operations, update } = setup({ navigation: "inbox" });
  update({ sessionId: "two" });
  for (const action of actions.filter(action => ["new-session", "close-session", "later-session", "archive-session"].includes(action.id))) action.run();
  expect(operations.newSession).not.toHaveBeenCalled();
  expect(operations.closeSession).not.toHaveBeenCalled();
  expect(operations.parkSession).not.toHaveBeenCalled();
  expect(operations.archiveSession).not.toHaveBeenCalled();
  update({ sessionId: "one", busy: true });
  actions.find(action => action.id === "archive-session")!.run();
  expect(operations.archiveSession).not.toHaveBeenCalled();
  update({ connected: false });
  for (const action of actions.filter(action => ["close-session", "later-session"].includes(action.id))) action.run();
  expect(operations.closeSession).not.toHaveBeenCalled();
  expect(operations.parkSession).not.toHaveBeenCalled();
});
it("hides server mutations while disconnected", () => {
  expect(setup({ connected: false }).actions.map(action => action.id)).toEqual(["open-folder", "settings"]);
});
