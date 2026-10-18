// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppControllerProvider, useAppController } from "../../../../../src/web/app/AppControllerContext.js";
import { MessageListContainer } from "../../../../../src/web/chat/transcript/MessageListContainer.js";
import { FakeBrowserWebSocket as Socket } from "../../../../infra/fake-browser-websocket.js";
import { snapshotData, coreEvent, presentationEvent } from "../../../../infra/v2-fixtures.js";
const renders = vi.hoisted(() => vi.fn());
// Load the real memoized renderer synchronously for deterministic render counts.
vi.mock("../../../../../src/web/chat/markdown/MarkdownLazy.js", async () => import("../../../../../src/web/chat/markdown/Markdown.js"));
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
    expect(socket.requests[1]).toMatchObject({ method: "file.open", sessionId: "first", params: { path: "./report.pdf" } });
  });

  it("opens assistant/thinking/custom/user links without prompt messages and suppresses duplicates", async () => {
    const socket = start();
    for (const name of ["Historical file", "Thinking file", "Custom file", "User file"]) {
      const link = screen.getByRole("link", { name, hidden: true });
      expect(link.getAttribute("href")).not.toBeNull(); // Native anchors retain Enter activation.
      fireEvent.click(link); fireEvent.click(link);
    }
    expect(socket.requests.slice(1).map((message) => message.method)).toEqual(Array(4).fill("file.open"));
    expect(socket.requests.slice(1).map((message) => "path" in message.params ? message.params.path : undefined)).toEqual(["./report.pdf", "./thought.md", "./custom.md", "./user.md"]);
    await act(async () => {
      for (const request of socket.requests.slice(1)) socket.reply({ state: "completed" }, request.requestId);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("captures the new session after switching tabs", () => {
    const socket = start();
    fireEvent.click(screen.getByRole("button", { name: "Focus second" }));
    fireEvent.click(screen.getByRole("link", { name: "Historical file" }));
    expect(socket.requests[1]).toMatchObject({ method: "file.open", sessionId: "second", params: { path: "./report.pdf" } });
  });
});
