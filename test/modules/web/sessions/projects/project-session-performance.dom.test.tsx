// @vitest-environment jsdom
import { createElement } from "react";
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppControllerProvider } from "../../../../../src/web/app/AppControllerContext.js";
import { OverlayController, useOverlays } from "../../../../../src/web/app/overlays/OverlayController.js";
import { ProjectSessionContainer } from "../../../../../src/web/sessions/projects/ProjectSessionContainer.js";
import type { ProjectCatalogue } from "../../../../../src/shared/protocol.js";
const rowRenders = vi.hoisted(() => vi.fn());
vi.mock("../../../../../src/web/settings/preferences/use-display-path.js", () => ({ useDisplayPath: () => ({ show: true }) }));
vi.mock("../../../../../src/web/sessions/projects/SessionRow.js", async () => {
  const actual = await vi.importActual<typeof import("../../../../../src/web/sessions/projects/SessionRow.js")>("../../../../../src/web/sessions/projects/SessionRow.js");
  return { SessionRow: (props: Parameters<typeof actual.SessionRow>[0]) => { rowRenders(props.session.id); return createElement(actual.SessionRow, props); } };
});
class Socket extends EventTarget {
  static OPEN = 1;
  static current: Socket;
  readyState = 1;
  sent: any[] = [];
  constructor() { super(); Socket.current = this; }
  send(value: string) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; this.dispatchEvent(new CloseEvent("close")); }
  deliver(value: object) { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ version: 1, ...value }) })); }
}
const catalogue: ProjectCatalogue = { projects: Array.from({ length: 30 }, (_, project) => ({
  path: `/project-${project}`, displayPath: `/project-${project}`, name: `Project ${project}`, exists: true, modified: 30 - project, sessionCount: 20,
  sessions: Array.from({ length: 20 }, (_, session) => ({ path: `/session-${project}-${session}.jsonl`, id: `s-${project}-${session}`, title: `Chat ${project}-${session}`, nameSource: "manual" as const, modified: 1, created: 0, messageCount: 1 })),
})) };
function Panel() {
  const overlays = useOverlays();
  return <><button onClick={() => overlays.open("projects")}>Show projects</button><ProjectSessionContainer /></>;
}
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("WebSocket", Socket); rowRenders.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function start() {
  render(<MantineProvider><AppControllerProvider><OverlayController><Panel /></OverlayController></AppControllerProvider></MantineProvider>);
  act(() => void vi.advanceTimersByTime(0));
  const socket = Socket.current;
  act(() => socket.deliver({ type: "snapshot", sessionId: "s-0-0", sequence: 0, throughSequence: 0, projectPath: "/project-0", messages: [], isStreaming: true, catalogue }));
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
    act(() => socket.deliver({ type: "assistantDelta", sessionId: "s-0-0", sequence: 1, runId: "r", delta: "token" }));
    act(() => socket.deliver({ type: "footer", sessionId: "s-0-0", sequence: 2, footer: [{ key: "status", text: "Working" }] }));
    act(() => socket.deliver({ type: "widgets", sessionId: "s-0-0", sequence: 3, widgets: [{ key: "todo", lines: ["Todo"], placement: "aboveEditor" }] }));
    act(() => socket.deliver({ type: "assistantDelta", sessionId: "background", sequence: 1, runId: "other", delta: "background token" }));
    expect(rowRenders).not.toHaveBeenCalled();
  });

  it("still updates archive availability, catalogue data and active session targeting", () => {
    const socket = start();
    expect(screen.getByRole("button", { name: "Archive Chat 0-0" }).hasAttribute("disabled")).toBe(true);
    act(() => socket.deliver({ type: "runtimeStatus", sessionId: "s-0-0", sequence: 1, status: "idle" }));
    expect(screen.getByRole("button", { name: "Archive Chat 0-0" }).hasAttribute("disabled")).toBe(false);
    const updated = { projects: catalogue.projects.map((project, index) => index ? project : { ...project, sessions: project.sessions.map((session, sessionIndex) => sessionIndex ? session : { ...session, title: "Renamed chat" }) }) };
    act(() => socket.deliver({ type: "catalogue", catalogue: updated }));
    expect(screen.getByText("Renamed chat")).not.toBeNull();
    fireEvent.click(screen.getByText("Project 1"));
    fireEvent.click(screen.getByText("Chat 1-0"));
    expect(socket.sent.at(-1)).toEqual({ version: 1, type: "openSession", path: "/session-1-0.jsonl" });
    act(() => {
      socket.deliver({ type: "snapshot", sessionId: "s-1-0", sequence: 0, throughSequence: 0, projectPath: "/project-1", messages: [], isStreaming: true });
      socket.deliver({ type: "tabs", activeSessionId: "s-1-0", tabs: [0, 1].map((index) => ({ sessionId: `s-${index}-0`, title: `Chat ${index}-0`, projectPath: `/project-${index}`, projectName: `Project ${index}`, status: "running" })) });
    });
    fireEvent.click(screen.getByText("Show projects"));
    act(() => void vi.advanceTimersByTime(500));
    expect(screen.getByRole("button", { name: "Archive Chat 1-0" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Chat 1-0").closest('button')?.getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "New session" }));
    expect(socket.sent.at(-1)).toEqual({ version: 1, type: "newSession", path: "/project-1" });
  });
});
