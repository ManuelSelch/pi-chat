// @vitest-environment jsdom
import { createElement } from "react";
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppControllerProvider } from "../../../../../src/web/app/AppControllerContext.js";
import { OverlayController, useOverlays } from "../../../../../src/web/app/overlays/OverlayController.js";
import { ProjectSessionContainer } from "../../../../../src/web/sessions/projects/ProjectSessionContainer.js";
import type { ProjectCatalogue } from "../../../../../src/shared/protocol.js";
import { FakeBrowserWebSocket as Socket } from "../../../../infra/fake-browser-websocket.js";
import { snapshotData, coreEvent, presentationEvent, summary, themeData } from "../../../../infra/v2-fixtures.js";
const rowRenders = vi.hoisted(() => vi.fn());
vi.mock("../../../../../src/web/settings/preferences/use-display-path.js", () => ({ useDisplayPath: () => ({ show: true }) }));
vi.mock("../../../../../src/web/sessions/projects/SessionRow.js", async () => {
  const actual = await vi.importActual<typeof import("../../../../../src/web/sessions/projects/SessionRow.js")>("../../../../../src/web/sessions/projects/SessionRow.js");
  return { SessionRow: (props: Parameters<typeof actual.SessionRow>[0]) => { rowRenders(props.session.id); return createElement(actual.SessionRow, props); } };
});
function createCatalogue(projectCount: number, sessionsPerProject: number): ProjectCatalogue {
  return { projects: Array.from({ length: projectCount }, (_, project) => ({
    path: `/project-${project}`, displayPath: `/project-${project}`, name: `Project ${project}`, exists: true, modified: projectCount - project, sessionCount: sessionsPerProject,
    sessions: Array.from({ length: sessionsPerProject }, (_, session) => ({ path: `/session-${project}-${session}.jsonl`, id: `s-${project}-${session}`, title: `Chat ${project}-${session}`, nameSource: "manual" as const, modified: 1, created: 0, messageCount: 1 })),
  })) };
}
const catalogue = createCatalogue(30, 20);
function Panel() {
  const overlays = useOverlays();
  return <><button onClick={() => overlays.open("projects")}>Show projects</button><ProjectSessionContainer /></>;
}
beforeEach(() => { vi.useFakeTimers(); Socket.instances = []; vi.stubGlobal("WebSocket", Socket); rowRenders.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function start(initialCatalogue = catalogue) {
  render(<MantineProvider><AppControllerProvider><OverlayController><Panel /></OverlayController></AppControllerProvider></MantineProvider>);
  act(() => void vi.advanceTimersByTime(0));
  const socket = Socket.current;
  act(() => { socket.acceptConnection(); socket.initialize([snapshotData({ sessionId: "runtime-0", sessionPath: "/session-0-0.jsonl", projectPath: "/project-0", runtime: { status: "running" } })], initialCatalogue); });
  fireEvent.click(screen.getByText("Show projects"));
  act(() => void vi.advanceTimersByTime(500));
  return socket;
}
describe("project/session drawer rendering", () => {
  it("does not rebuild a large list on tokens, footer, widgets, or unrelated tab traffic", () => {
    const socket = start();
    expect(screen.getByText("Chat 0-0")).not.toBeNull();
    rowRenders.mockClear();
    // Separate acts ensure this checks every update, not a batched final render.
    act(() => socket.deliver(coreEvent("message.delta", { runId: "r", delta: "token" }, "runtime-0", 1)));
    act(() => socket.deliver(presentationEvent({ footer: [{ key: "status", text: "Working", align: "left", variant: "plain" }] }, "runtime-0", 2)));
    act(() => socket.deliver(presentationEvent({ widgets: [{ key: "todo", lines: ["Todo"], placement: "aboveEditor" }] }, "runtime-0", 3)));
    act(() => socket.deliver(coreEvent("message.delta", { runId: "other", delta: "background token" }, "background", 1)));
    expect(rowRenders).not.toHaveBeenCalled();
  });

  it("still updates archive availability, catalogue data and active session targeting", async () => {
    const catalogue = createCatalogue(2, 2);
    const socket = start(catalogue);
    expect(screen.getByRole("button", { name: "Archive Chat 0-0" }).hasAttribute("disabled")).toBe(true);
    act(() => { socket.deliver(coreEvent("runtime.status", { status: "idle" }, "runtime-0", 1)); socket.deliver({ version: 2, type: "event", event: "session.list.changed", serverInstanceId: "process", data: { revision: 1, sessions: [summary(snapshotData({ sessionId: "runtime-0", sessionPath: "/session-0-0.jsonl" }))] } }); });
    expect(screen.getByRole("button", { name: "Archive Chat 0-0" }).hasAttribute("disabled")).toBe(false);
    const updated = { projects: catalogue.projects.map((project, index) => index ? project : { ...project, sessions: project.sessions.map((session, sessionIndex) => sessionIndex ? session : { ...session, title: "Renamed chat" }) }) };
    act(() => socket.deliver({ version: 2, type: "event", event: "project.list.changed", serverInstanceId: "process", data: { revision: 1, catalogue: updated } }));
    expect(screen.getByText("Renamed chat")).not.toBeNull();
    fireEvent.click(screen.getByText("Project 1"));
    fireEvent.click(screen.getByText("Chat 1-0"));
    expect(socket.requests.at(-1)).toMatchObject({ version: 2, type: "request", method: "session.open", params: { sessionPath: "/session-1-0.jsonl" } });
    await act(async () => {
      const snapshot = snapshotData({ sessionId: "runtime-1", sessionPath: "/session-1-0.jsonl", projectPath: "/project-1", runtime: { status: "running" } });
      socket.deliver({ version: 2, type: "event", event: "session.list.changed", serverInstanceId: "process", data: { revision: 2, sessions: [summary(snapshotData({ sessionId: "runtime-0", sessionPath: "/session-0-0.jsonl" })), summary(snapshot)] } });
      socket.reply({ summary: summary(snapshot), snapshot, theme: themeData() });
    });
    fireEvent.click(screen.getByText("Show projects"));
    act(() => void vi.advanceTimersByTime(500));
    expect(screen.getByRole("button", { name: "Archive Chat 1-0" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Chat 1-0").closest('button')?.getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "New session in Project 1" }));
    expect(socket.requests.at(-1)).toMatchObject({ version: 2, type: "request", method: "session.create", params: { projectPath: "/project-1" }, requestId: expect.any(String) });
  });
});
