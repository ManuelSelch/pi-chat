// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PiClient } from "@manuelselch/pi-sdk";
import { usePiChat } from "../../../../src/web/app/use-pi-chat.js";
import { AppControllerProvider } from "../../../../src/web/app/AppControllerContext.js";
import { SessionActionsProvider } from "../../../../src/web/sessions/actions/SessionActionsProvider.js";
import { ComposerContainer } from "../../../../src/web/chat/composer/ComposerContainer.js";
import { FakeBrowserWebSocket as Socket } from "../../../infra/fake-browser-websocket.js";
import { snapshotData, coreEvent, summary } from "../../../infra/v2-fixtures.js";
vi.mock("../../../../src/web/ui/confirm/ConfirmDialogProvider.js", () => ({ useConfirmDialog: () => ({ confirm: vi.fn() }) }));
vi.mock("../../../../src/web/app/overlays/OverlayController.js", () => ({ useOverlays: () => ({ anyOpen: false }) }));
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); Socket.instances = []; vi.stubGlobal("WebSocket", Socket); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });
function connect(snapshots = [snapshotData({ sessionId: "s" })]) { act(() => void vi.advanceTimersByTime(0)); const socket = Socket.current; act(() => { socket.acceptConnection(); socket.initialize(snapshots); }); return socket; }
it("uses one PiClient, atomic ready state and disposal on unmount", () => {
  const start = vi.spyOn(PiClient.prototype, "start"); const dispose = vi.spyOn(PiClient.prototype, "dispose"); const { result, unmount } = renderHook(() => usePiChat());
  act(() => void vi.advanceTimersByTime(0)); const socket = Socket.current; act(() => socket.acceptConnection()); expect(result.current.app.connection).not.toBe("open");
  act(() => socket.initialize()); expect(result.current.app.connection).toBe("open"); expect(Object.isFrozen(result.current.app.sessions.s?.messages)).toBe(true);
  expect(start).toHaveBeenCalledOnce(); unmount(); expect(dispose).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
});
it("uses SDK deadlines instead of keeping folder waits indefinitely", async () => {
  const { result } = renderHook(() => usePiChat()); connect([]); const pending = result.current.browseDirectories({ path: "/p" }); const rejected = expect(pending).rejects.toMatchObject({ code: "timeout", outcome: "unknown" }); await act(async () => vi.advanceTimersByTime(10_000)); await rejected;
});
it("routes typed controls and rejects creation without leaking a navigation placeholder", async () => {
  const { result } = renderHook(() => usePiChat()); const socket = connect(); act(() => { result.current.prompt("hello", "background"); result.current.setModel("provider/model"); result.current.newSession("/new"); });
  expect(socket.requests.slice(1)).toMatchObject([{ method: "message.send", sessionId: "background", params: { message: "hello" } }, { method: "model.select", sessionId: "s", params: { model: "provider/model" } }, { method: "session.create", params: { projectPath: "/new" } }]);
  expect(result.current.app.openingTabs).toBe(1); await act(async () => socket.reject("permissionDenied", "Permission denied")); expect(result.current.app.openingTabs).toBe(0); expect(result.current.app.error).toBe("Permission denied");
  const pinned = result.current.pinProject("/p", true); expect(socket.requests.at(-1)).toMatchObject({ method: "project.pin", params: { path: "/p", pinned: true } }); await act(async () => socket.reply({ state: "completed" })); await pinned; expect(result.current.app.error).toBe("Permission denied");
});
it("rolls back optimistic open/close failures while offline", async () => {
  const { result } = renderHook(() => usePiChat()); await act(async () => result.current.openProject("/p")); expect(result.current.app.openingTabs).toBe(0); expect(result.current.app.error).toContain("Not connected");
  await act(async () => result.current.closeTab("s")); expect(result.current.app.closingSessionIds).toEqual([]);
});
it("restores a closing tab and focus when teardown fails", async () => {
  const { result } = renderHook(() => usePiChat()); const socket = connect(); act(() => result.current.closeTab("s")); expect(result.current.app.closingSessionIds).toEqual(["s"]);
  await act(async () => socket.reject("operationFailed", "Partial close; retry explicitly")); expect(result.current.app.closingSessionIds).toEqual([]); expect(result.current.app.activeSessionId).toBe("s"); expect(result.current.app.tabs).toHaveLength(1);
});
it("closes an empty idle runtime instead of retaining an empty Inbox session", async () => {
  const { result } = renderHook(() => usePiChat());
  const socket = connect();

  act(() => result.current.closeView());

  expect(socket.requests.at(-1)).toMatchObject({ method: "session.close", sessionId: "s" });
  await act(async () => {
    socket.deliver(coreEvent("session.closed", { reason: "requested" }, "s", 1));
    socket.reply({ state: "completed" });
  });
  expect(result.current.app.tabs).toEqual([]);
});

it.each(["running", "blocked", "nonempty"] as const)("only clears selection for a %s conversation", kind => {
  const { result } = renderHook(() => usePiChat());
  const socket = connect([snapshotData({ sessionId: "s", runtime: { status: kind === "running" ? "running" : "idle" }, prompts: kind === "blocked" ? [{ id: "p", title: "Answer", kind: "editor" }] : [], messages: kind === "nonempty" ? [{ id: "u", role: "user", text: "Hello" }] : [] })]);

  act(() => result.current.closeView());

  expect(socket.requests).toHaveLength(1);
  expect(result.current.app.activeSessionId).toBe("");
  expect(result.current.app.tabs).toHaveLength(1);
});

it("keeps focus local and preserves it over reconnect with authoritative snapshots", () => {
  const { result } = renderHook(() => usePiChat()); const snapshots = [snapshotData({ sessionId: "a" }), snapshotData({ sessionId: "b" })]; const socket = connect(snapshots);
  act(() => result.current.focusTab("b")); expect(result.current.app.activeSessionId).toBe("b"); expect(socket.requests).toHaveLength(1);
  act(() => socket.close()); act(() => void vi.advanceTimersByTime(250)); const next = Socket.current; act(() => { next.acceptConnection(); next.initialize(snapshots); }); expect(result.current.app.activeSessionId).toBe("b");
});
it("keeps file requests stable, coalesced and independent of runtime errors", async () => {
  const { result } = renderHook(() => usePiChat()); const socket = connect([snapshotData({ sessionId: "s", runtime: { status: "running", lastError: "Model failed" } })]);
  const open = result.current.openFile; const pending = open("s", "report.pdf"); expect(open("s", "report.pdf")).toBe(pending);
  act(() => socket.deliver(coreEvent("message.delta", { runId: "r", delta: "token" }, "s", 1))); expect(result.current.openFile).toBe(open);
  const rejected = expect(pending).rejects.toMatchObject({ code: "notFound" }); await act(async () => socket.reject("notFound", "File not found")); await rejected; expect(result.current.app.sessions.s?.error).toBe("Model failed");
});
it("cancels file waits on confirmed close and never replays them after reconnect", async () => {
  const { result, unmount } = renderHook(() => usePiChat()); const socket = connect(); const first = result.current.openFile("s", "report.pdf"); const cancelled = expect(first).rejects.toMatchObject({ code: "cancelled", outcome: "unknown" });
  act(() => result.current.closeTab("s")); await act(async () => { socket.deliver(coreEvent("session.closed", { reason: "requested" }, "s", 1)); socket.reply({ state: "completed" }); }); await cancelled;
  const second = result.current.openFile("other", "report.pdf"); const disconnected = expect(second).rejects.toMatchObject({ code: "disconnected", outcome: "unknown" }); await act(async () => socket.close()); await disconnected;
  act(() => void vi.advanceTimersByTime(250)); const next = Socket.current; act(() => { next.acceptConnection(); next.initialize([]); }); expect(next.requests.map(request => request.method)).toEqual(["server.initialize"]);
  const third = result.current.openFile("other", "report.pdf"); const disposed = expect(third).rejects.toMatchObject({ code: "disposed", outcome: "unknown" }); await act(async () => unmount()); await disposed;
});
it("dismisses a failed turn from the composer without mutating SDK state", () => {
  Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  render(<MantineProvider><AppControllerProvider><SessionActionsProvider><ComposerContainer widgetsDocked={false} onHeightChange={() => {}} /></SessionActionsProvider></AppControllerProvider></MantineProvider>);
  connect([snapshotData({ sessionId: "s", runtime: { status: "idle", lastError: "Model request failed" } })]); expect(screen.getByRole("alert").textContent).toContain("Model request failed"); fireEvent.click(screen.getByRole("button", { name: "Dismiss error" })); expect(screen.queryByRole("alert")).toBeNull();
});
it("correlates completion and folder requests and rejects them on disconnect", async () => {
  const { result } = renderHook(() => usePiChat()); const socket = connect(); const completion = result.current.completeCommandArguments("s", "deploy", "st"); const completionId = socket.requests.at(-1)!.requestId;
  const browse = result.current.browseDirectories({ path: "~" }); await act(async () => { socket.reply({ path: "/home", entries: [], breadcrumbs: [] }); socket.reply({ items: [{ value: "staging", label: "Staging" }] }, completionId); });
  await expect(completion).resolves.toMatchObject([{ value: "staging" }]); await expect(browse).resolves.toMatchObject({ path: "/home" });
  const pending = result.current.browseDirectories({ path: "/" }); const rejected = expect(pending).rejects.toMatchObject({ code: "disconnected" }); await act(async () => socket.close()); await rejected;
});
it("does not let a disposed socket's late close cancel requests on its replacement", async () => {
  const { result } = renderHook(() => usePiChat()); const old = connect(); const close = vi.spyOn(old, "close").mockImplementation(() => {}); act(() => result.current.takeControl());
  const next = connect(); const pending = result.current.browseDirectories({ path: "/" }); close.mockRestore(); await act(async () => { old.close(); next.reply({ path: "/new", entries: [], breadcrumbs: [] }); }); await expect(pending).resolves.toMatchObject({ path: "/new" });
});
it("selects project history in the app, not through a wire-level continuation method", () => {
  const { result } = renderHook(() => usePiChat()); const socket = connect([]);
  act(() => socket.deliver({ version: 2, type: "event", serverInstanceId: "process", event: "project.list.changed", data: { revision: 1, catalogue: { projects: [{ path: "/p", displayPath: "/p", name: "p", exists: true, modified: 1, sessionCount: 1, sessions: [{ path: "/history.jsonl", id: "saved-id", title: "Saved", nameSource: "manual", modified: 1, created: 0, messageCount: 1 }] }] } } }));
  act(() => result.current.openProject("/p")); expect(socket.requests.at(-1)).toMatchObject({ method: "session.open", params: { sessionPath: "/history.jsonl" } });
});
it("never opens a half-handshake during StrictMode probe mounting", () => {
  renderHook(() => usePiChat(), { wrapper: StrictMode }); act(() => void vi.advanceTimersByTime(0)); expect(Socket.instances).toHaveLength(1); expect(Socket.instances.every(socket => !socket.closedWhileConnecting)).toBe(true);
});
it("retries failed connections with backoff until initialization succeeds", () => {
  const { result } = renderHook(() => usePiChat()); act(() => void vi.advanceTimersByTime(0)); act(() => Socket.current.refuseConnection()); act(() => void vi.advanceTimersByTime(250)); act(() => Socket.current.refuseConnection());
  act(() => void vi.advanceTimersByTime(499)); expect(Socket.instances).toHaveLength(2); act(() => void vi.advanceTimersByTime(1)); act(() => { Socket.current.acceptConnection(); Socket.current.initialize(); }); expect(result.current.app.connection).toBe("open");
});
it("forwards the browser query string to the explicit SDK endpoint", () => {
  window.history.replaceState(null, "", "/?invite=demo"); renderHook(() => usePiChat()); act(() => void vi.advanceTimersByTime(0)); expect(Socket.current.url).toBe("ws://localhost:3000/ws?invite=demo");
});
it("restores a saved endpoint without appending the page query or hot switching", () => {
  window.history.replaceState(null, "", "/?invite=page");
  localStorage.setItem("pi-chat:serverEndpoint", "ws://other:8788/ws?profile=saved");
  const { result, rerender } = renderHook(() => usePiChat());
  act(() => void vi.advanceTimersByTime(0));
  expect(Socket.current.url).toBe("ws://other:8788/ws?profile=saved");
  expect(result.current.serverEndpoint.endpoint).toBe(Socket.current.url);
  localStorage.setItem("pi-chat:serverEndpoint", "ws://changed/ws");
  rerender();
  expect(Socket.instances).toHaveLength(1);
  expect(result.current.serverEndpoint.endpoint).toBe("ws://other:8788/ws?profile=saved");
});
it("ignores invalid persisted endpoints without crashing initialization", () => {
  localStorage.setItem("pi-chat:serverEndpoint", "invalid secret");
  const { result } = renderHook(() => usePiChat());
  connect();
  expect(Socket.current.url).toBe("ws://localhost:3000/ws");
  expect(result.current.serverEndpoint.warning).toBeTruthy();
  expect(result.current.app.connection).toBe("open");
});
it("never fights a displaced controller and reconnects only on explicit takeover", () => {
  const { result } = renderHook(() => usePiChat()); const socket = connect(); act(() => socket.replaceByNewController()); expect(result.current.app.connection).toBe("superseded"); act(() => void vi.advanceTimersByTime(30_000)); expect(Socket.instances).toHaveLength(1);
  act(() => result.current.takeControl()); act(() => void vi.advanceTimersByTime(0)); expect(Socket.instances).toHaveLength(2);
});
it("logs physical close details while the SDK owns reconnect", () => {
  const log = vi.spyOn(console, "info").mockImplementation(() => {}); const { result } = renderHook(() => usePiChat()); const socket = connect(); act(() => socket.close(1006, "abnormal closure", false));
  expect(log).toHaveBeenCalledWith("[pi-chat] websocket.close", expect.objectContaining({ code: 1006, reason: "abnormal closure", wasClean: false, timestamp: expect.any(String) })); expect(result.current.app.connection).toBe("connecting");
});
