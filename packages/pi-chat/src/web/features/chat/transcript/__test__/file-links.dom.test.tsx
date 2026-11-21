// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppControllerProvider, useAppController } from "../../../../app/AppControllerContext.js";
import { MessageListContainer } from "../components/MessageListContainer.js";
import { FakeBrowserWebSocket as Socket } from "../../../../../../testing/infra/fake-browser-websocket.js";
import { snapshotData, coreEvent, presentationEvent } from "../../../../../../testing/infra/v2-fixtures.js";
const renders = vi.hoisted(() => vi.fn());
// Load the real memoized renderer synchronously for deterministic render counts.
vi.mock("../../markdown/components/MarkdownLazy.js", async () => import("../../markdown/components/Markdown.js"));
vi.mock("react-markdown", async () => {
  const actual = await vi.importActual<typeof import("react-markdown")>("react-markdown");
  return { ...actual, default: (props: Parameters<typeof actual.default>[0]) => { renders(props.children); return createElement(actual.default, props); } };
});
beforeEach(() => {
  vi.useFakeTimers(); Socket.instances = [];
  vi.stubGlobal("WebSocket", Socket);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  renders.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const historicalText = "[Historical file](./report.pdf)";
function Switch() { const chat = useAppController(); return <button onClick={() => chat.focusTab("second")}>Focus second</button>; }
function start() {
  render(<MantineProvider><AppControllerProvider><Switch /><MessageListContainer footerHeight={100} /></AppControllerProvider></MantineProvider>);
  act(() => void vi.advanceTimersByTime(0));
  const socket = Socket.current;
  act(() => { socket.acceptConnection(); socket.initialize([snapshotData({ sessionId: "first", projectPath: "/first", runtime: { status: "running" }, messages: [
    { id: "old", role: "assistant", text: historicalText, thinking: "[Thinking file](./thought.md)" },
    { id: "custom", role: "custom", customType: "test", text: "[Custom file](./custom.md)" },
    { id: "user", role: "user", text: "[User file](./user.md)" },
  ] }), snapshotData({ sessionId: "second", projectPath: "/second", messages: [{ id: "second-old", role: "assistant", text: historicalText }] })]); });
  return socket;
}
describe("transcript file actions", () => {
  it("does not reparse historical Markdown during tokens, footer, widgets or catalogue updates", () => {
    const socket = start();
    expect(renders.mock.calls.filter(([text]) => text === historicalText)).toHaveLength(1);
    act(() => {
      socket.deliver(coreEvent("message.delta", { runId: "r", delta: "streamed token" }, "first", 1));
      socket.deliver(presentationEvent({ footer: [{ key: "status", text: "Working", align: "left", variant: "plain" }] }, "first", 2));
      socket.deliver(presentationEvent({ widgets: [{ key: "todo", lines: ["New todo"], placement: "aboveEditor" }] }, "first", 3));
      socket.deliver({ version: 2, type: "event", event: "project.list.changed", serverInstanceId: "process", data: { revision: 1, catalogue: { projects: [] } } });
    });
    expect(renders.mock.calls.filter(([text]) => text === historicalText)).toHaveLength(1);
    fireEvent.click(screen.getByRole("link", { name: "Historical file" }));
    expect(socket.requests.slice(1)).toHaveLength(1);
    expect(socket.requests[1]).toMatchObject({ method: "plugin.call", params: { contractId: "file-opening", contractVersion: 1, method: "open", input: { sessionId: "first", path: "./report.pdf" } } });
  });

  it("opens assistant/thinking/custom/user links without prompt messages and suppresses duplicates", async () => {
    const socket = start();
    for (const name of ["Historical file", "Thinking file", "Custom file", "User file"]) {
      const link = screen.getByRole("link", { name, hidden: true });
      expect(link.getAttribute("href")).not.toBeNull(); // Native anchors retain Enter activation.
      fireEvent.click(link); fireEvent.click(link);
    }
    expect(socket.requests.slice(1).map((message) => message.method)).toEqual(Array(4).fill("plugin.call"));
    expect(socket.requests.slice(1).map((message) => message.method === "plugin.call" ? message.params.input : undefined)).toEqual(["./report.pdf", "./thought.md", "./custom.md", "./user.md"].map(path => ({ sessionId: "first", path })));
    await act(async () => {
      for (const request of socket.requests.slice(1)) socket.reply({ value: { ok: true } }, request.requestId);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows structured plugin failures outside chat history", async () => {
    const socket = start();
    fireEvent.click(screen.getByRole("link", { name: "Historical file" }));

    await act(async () => socket.reply({ value: { ok: false, error: { code: "notFound", message: "File not found on the server." } } }));

    expect(screen.getByRole("alert").textContent).toContain("File not found on the server.");
    expect(socket.requests.slice(1).map(request => request.method)).toEqual(["plugin.call"]);
  });

  it("captures the new session after switching tabs", () => {
    const socket = start();
    fireEvent.click(screen.getByRole("button", { name: "Focus second" }));
    fireEvent.click(screen.getByRole("link", { name: "Historical file" }));
    expect(socket.requests[1]).toMatchObject({ method: "plugin.call", params: { input: { sessionId: "second", path: "./report.pdf" } } });
  });
});
