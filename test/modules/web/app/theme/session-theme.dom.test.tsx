// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { Modal, useMantineTheme } from "@mantine/core";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppControllerProvider, useAppController, type AppController } from "../../../../../src/web/app/AppControllerContext.js";
import { FakeBrowserWebSocket as Socket } from "../../../../infra/fake-browser-websocket.js";
import { initializeResult, snapshotData, snapshotEvent, summary, themeData } from "../../../../infra/v2-fixtures.js";

let controller: AppController;
function Probe() {
  controller = useAppController();
  const theme = useMantineTheme();
  return <Modal opened onClose={() => {}} title="Theme portal"><span>{theme.colors.blue[6]}</span></Modal>;
}
function mount() {
  render(<AppControllerProvider><Probe /></AppControllerProvider>);
  act(() => void vi.advanceTimersByTime(0));
  act(() => { Socket.current.acceptConnection(); Socket.current.initialize([]); });
}
async function open(id: string, appearance: "dark" | "light" = "dark") {
  act(() => controller.newSession("/project"));
  const snapshot = snapshotData({ sessionId: id });
  const theme = { ...themeData(), name: id, appearance };
  theme.colors.accent = appearance === "light" ? "#248060" : "#bb66cc";
  await act(async () => Socket.current.reply({ summary: summary(snapshot), snapshot, theme }));
  return theme;
}
function paletteCss() { return [...document.querySelectorAll("style[data-mantine-styles]")].map(el => el.textContent).join("\n"); }
beforeEach(() => { vi.useFakeTimers(); Socket.instances = []; vi.stubGlobal("WebSocket", Socket); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("selects cached palettes locally, covers portals and retains them through snapshots/reconnect", async () => {
  mount();
  expect(controller!.app.themes).toEqual({});
  const dark = await open("a");
  const light = await open("b", "light");
  expect(document.documentElement.dataset.mantineColorScheme).toBe("light");
  expect(screen.getByRole("dialog").textContent).toContain(light.colors.accent);
  expect(document.getElementById("root")?.contains(screen.getByRole("dialog")) ?? false).toBe(false);
  expect(paletteCss()).toContain("--mantine-color-body: #111111");
  const requests = Socket.current.requests.length;
  act(() => controller.focusTab("a"));
  expect(document.documentElement.dataset.mantineColorScheme).toBe("dark");
  expect(screen.getByRole("dialog").textContent).toContain(dark.colors.accent);
  expect(Socket.current.requests).toHaveLength(requests);
  act(() => Socket.current.deliver(snapshotEvent({ sessionId: "b", throughSequence: 1 })));
  expect(screen.getByRole("dialog").textContent).toContain(dark.colors.accent);
  act(() => Socket.current.deliver(snapshotEvent({ sessionId: "a", throughSequence: 1 })));
  expect(controller!.app.themes.a).toEqual(dark);
  act(() => { Socket.current.close(); vi.advanceTimersByTime(250); Socket.current.acceptConnection(); Socket.current.initialize([snapshotData({ sessionId: "a" }), snapshotData({ sessionId: "b" })]); });
  expect(controller!.app.themes).toEqual({ a: dark, b: light });
  expect(screen.getByRole("dialog").textContent).toContain(dark.colors.accent);
});

it("clears SDK caches but remembers appearance on close, replacement and server-instance change", async () => {
  mount(); const dark = await open("a");
  act(() => Socket.current.deliver({ version: 2, type: "event", serverInstanceId: "process", event: "session.replaced", data: { previousSessionId: "a", snapshot: snapshotData({ sessionId: "replacement" }) } }));
  expect(controller!.app.themes).toEqual({});
  expect(screen.getByRole("dialog").textContent).toContain(dark.colors.accent);
  expect(paletteCss()).toContain("--pi-user-bg");
  const light = await open("b", "light");
  act(() => Socket.current.deliver({ version: 2, type: "event", serverInstanceId: "process", sessionId: "b", sequence: 1, event: "session.closed", data: { reason: "requested" } }));
  expect(controller!.app.themes).toEqual({});
  expect(document.documentElement.dataset.mantineColorScheme).toBe("light");
  expect(screen.getByRole("dialog").textContent).toContain(light.colors.accent);
  await open("c");
  act(() => { Socket.current.close(); vi.advanceTimersByTime(250); Socket.current.acceptConnection(); });
  act(() => Socket.current.reply({ ...initializeResult([snapshotData({ sessionId: "c" })]), serverInstanceId: "new-process" }));
  expect(controller!.app.themes).toEqual({});
  expect(screen.getByRole("dialog").textContent).toContain(dark.colors.accent);
  expect(paletteCss()).toContain("--pi-user-bg");
});

it.each([undefined, null, { ...themeData(), colors: { ...themeData().colors, accent: "url(evil)" } }])("rejects malformed/missing required theme without caching it (%j)", async theme => {
  mount(); act(() => controller.newSession("/project"));
  const snapshot = snapshotData({ sessionId: "bad" });
  await act(async () => Socket.current.reply({ summary: summary(snapshot), snapshot, theme }));
  expect(controller!.app.themes).toEqual({});
  expect(controller!.app.error).toBeTruthy();
});

it("a rejected theme cannot replace remembered appearance or populate an SDK cache", async () => {
  mount();
  const remembered = await open("a", "light");
  act(() => Socket.current.deliver({ version: 2, type: "event", serverInstanceId: "process", sessionId: "a", sequence: 1, event: "session.closed", data: { reason: "requested" } }));
  act(() => controller.newSession("/project"));
  const snapshot = snapshotData({ sessionId: "bad" });
  const invalid = { ...themeData(), colors: { ...themeData().colors, accent: "url(evil)" } };
  await act(async () => Socket.current.reply({ summary: summary(snapshot), snapshot, theme: invalid }));
  expect(controller!.app.themes).toEqual({});
  expect(controller!.app.error).toBeTruthy();
  expect(document.documentElement.dataset.mantineColorScheme).toBe("light");
  expect(screen.getByRole("dialog").textContent).toContain(remembered.colors.accent);
  expect(JSON.parse(localStorage.getItem("pi-chat:lastTheme")!)).toEqual(remembered);
});

it("uses defaults when no palette was remembered and initialization has no theme", () => {
  mount();
  act(() => { Socket.current.close(); vi.advanceTimersByTime(250); Socket.current.acceptConnection(); Socket.current.initialize([snapshotData({ sessionId: "existing" })]); });
  expect(controller!.app.themes).toEqual({});
  expect(paletteCss()).not.toContain("--pi-user-bg");
});
