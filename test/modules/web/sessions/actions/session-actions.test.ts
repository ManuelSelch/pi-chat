import { expect, it, vi } from "vitest";
import { buildSessionActions, type SessionActionState } from "../../../../../src/web/sessions/actions/session-actions.js";

function setup(overrides: Partial<SessionActionState> = {}) {
  let state: SessionActionState = { sessionId: "one", projectPath: "/repo", sessionPath: "/sessions/one", connected: true, busy: false, navigation: "tabs", ...overrides };
  const operations = { newSession: vi.fn(), closeTab: vi.fn(), archiveSession: vi.fn(), openFolder: vi.fn(), openSettings: vi.fn() };
  const actions = buildSessionActions(state, operations, () => state);
  return { actions, operations, update: (changes: Partial<SessionActionState>) => { state = { ...state, ...changes }; } };
}
it("defines five actions without server restart and invokes existing operations", () => {
  const { actions, operations } = setup();
  expect(actions.map(action => action.id)).toEqual(["new-session", "close-tab", "archive-session", "open-folder", "settings"]);
  for (const action of actions) action.run();
  expect(operations.newSession).toHaveBeenCalledWith("/repo");
  expect(operations.closeTab).toHaveBeenCalledWith("one");
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
it("hides archive while busy but retains New session and Close tab", () => {
  const { actions } = setup({ busy: true });
  expect(actions.map(action => action.id)).toEqual(["new-session", "close-tab", "open-folder", "settings"]);
});
it("offers guarded Move to Later instead of Close tab in Inbox mode", () => {
  const { actions, operations, update } = setup({ navigation: "inbox" });
  const close = actions.find(action => action.id === "close-tab")!;
  expect(close.name).toBe("Move to Later");

  update({ busy: true });
  close.run();
  expect(operations.closeTab).not.toHaveBeenCalled();
  expect(setup({ navigation: "inbox", busy: true }).actions.some(action => action.id === "close-tab")).toBe(false);
  expect(setup({ navigation: "inbox", sessionPath: undefined }).actions.some(action => action.id === "close-tab")).toBe(false);
});

it("does not offer Archive without a persisted session path", () => {
  expect(setup({ sessionPath: undefined }).actions.some(action => action.id === "archive-session")).toBe(false);
});
it("hides server mutations while disconnected", () => {
  expect(setup({ connected: false }).actions.map(action => action.id)).toEqual(["open-folder", "settings"]);
});
it("guards stale session targets and live busy/connection changes", () => {
  const { actions, operations, update } = setup();
  update({ sessionId: "two" });
  for (const action of actions.filter(action => ["new-session", "close-tab", "archive-session"].includes(action.id))) action.run();
  expect(operations.newSession).not.toHaveBeenCalled();
  expect(operations.closeTab).not.toHaveBeenCalled();
  expect(operations.archiveSession).not.toHaveBeenCalled();
  update({ sessionId: "one", busy: true });
  actions.find(action => action.id === "archive-session")!.run();
  expect(operations.archiveSession).not.toHaveBeenCalled();
  update({ connected: false });
  actions.find(action => action.id === "close-tab")!.run();
  expect(operations.closeTab).not.toHaveBeenCalled();
});
