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
function shouldUseAppTheme() {
  expect(document.documentElement.dataset.mantineColorScheme).toBe("dark");
  expect(screen.getByRole("dialog").textContent).toContain("#8b9baf");
  const css = [...document.querySelectorAll("style[data-mantine-styles]")].map(el => el.textContent).join("\n");
  expect(css).toContain("--mantine-color-body: #18191e");
}
beforeEach(() => { vi.useFakeTimers(); Socket.instances = []; vi.stubGlobal("WebSocket", Socket); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it("caches runtime palettes without recoloring the app on switching, snapshots or reconnect", async () => {
  mount();
  expect(controller!.app.themes).toEqual({});
  shouldUseAppTheme();

  const dark = await open("a");
  const light = await open("b", "light");
  expect(controller!.app.themes).toEqual({ a: dark, b: light });
  shouldUseAppTheme();
  expect(document.getElementById("root")?.contains(screen.getByRole("dialog")) ?? false).toBe(false);

  const requests = Socket.current.requests.length;
  act(() => controller.focusTab("a"));
  expect(Socket.current.requests).toHaveLength(requests);
  shouldUseAppTheme();

  act(() => Socket.current.deliver(snapshotEvent({ sessionId: "b", throughSequence: 1 })));
  shouldUseAppTheme();
  act(() => Socket.current.deliver(snapshotEvent({ sessionId: "a", throughSequence: 1 })));
  expect(controller!.app.themes.a).toEqual(dark);

  act(() => { Socket.current.close(); vi.advanceTimersByTime(250); Socket.current.acceptConnection(); Socket.current.initialize([snapshotData({ sessionId: "a" }), snapshotData({ sessionId: "b" })]); });
  expect(controller!.app.themes).toEqual({ a: dark, b: light });
  shouldUseAppTheme();
});

it("clears SDK caches on replacement, close and server-instance change without changing app appearance", async () => {
  mount();
  await open("a");

  act(() => Socket.current.deliver({ version: 2, type: "event", serverInstanceId: "process", event: "session.replaced", data: { previousSessionId: "a", snapshot: snapshotData({ sessionId: "replacement" }) } }));
  expect(controller!.app.themes).toEqual({});
  shouldUseAppTheme();

  await open("b", "light");
  act(() => Socket.current.deliver({ version: 2, type: "event", serverInstanceId: "process", sessionId: "b", sequence: 1, event: "session.closed", data: { reason: "requested" } }));
  expect(controller!.app.themes).toEqual({});
  shouldUseAppTheme();

  await open("c");
  act(() => { Socket.current.close(); vi.advanceTimersByTime(250); Socket.current.acceptConnection(); });
  act(() => Socket.current.reply({ ...initializeResult([snapshotData({ sessionId: "c" })]), serverInstanceId: "new-process" }));
  expect(controller!.app.themes).toEqual({});
  shouldUseAppTheme();
});

it.each([undefined, null, { ...themeData(), colors: { ...themeData().colors, accent: "url(evil)" } }])("rejects malformed/missing required theme without caching it (%j)", async theme => {
  mount();
  act(() => controller.newSession("/project"));
  const snapshot = snapshotData({ sessionId: "bad" });

  await act(async () => Socket.current.reply({ summary: summary(snapshot), snapshot, theme }));

  expect(controller!.app.themes).toEqual({});
  expect(controller!.app.error).toBeTruthy();
  shouldUseAppTheme();
});

it("a rejected runtime theme cannot affect app appearance or populate an SDK cache", async () => {
  mount();
  await open("a", "light");
  act(() => Socket.current.deliver({ version: 2, type: "event", serverInstanceId: "process", sessionId: "a", sequence: 1, event: "session.closed", data: { reason: "requested" } }));
  act(() => controller.newSession("/project"));
  const snapshot = snapshotData({ sessionId: "bad" });
  const invalid = { ...themeData(), colors: { ...themeData().colors, accent: "url(evil)" } };

  await act(async () => Socket.current.reply({ summary: summary(snapshot), snapshot, theme: invalid }));

  expect(controller!.app.themes).toEqual({});
  expect(controller!.app.error).toBeTruthy();
  shouldUseAppTheme();
  expect(localStorage.getItem("pi-chat:lastTheme")).toBeNull();
});

it("keeps AppTheme when initialization restores sessions without palettes", () => {
  mount();

  act(() => { Socket.current.close(); vi.advanceTimersByTime(250); Socket.current.acceptConnection(); Socket.current.initialize([snapshotData({ sessionId: "existing" })]); });

  expect(controller!.app.themes).toEqual({});
  shouldUseAppTheme();
});
