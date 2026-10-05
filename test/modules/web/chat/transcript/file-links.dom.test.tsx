// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppControllerProvider } from "../../../../../src/web/app/AppControllerContext.js";
import { MessageListContainer } from "../../../../../src/web/chat/transcript/MessageListContainer.js";
const renders = vi.hoisted(() => vi.fn());
// Load the real memoized renderer synchronously for deterministic render counts.
vi.mock("../../../../../src/web/chat/markdown/MarkdownLazy.js", async () => import("../../../../../src/web/chat/markdown/Markdown.js"));
vi.mock("react-markdown", async () => {
  const actual = await vi.importActual<typeof import("react-markdown")>("react-markdown");
  return { ...actual, default: (props: Parameters<typeof actual.default>[0]) => { renders(props.children); return createElement(actual.default, props); } };
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
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  renders.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const historicalText = "[Historical file](./report.pdf)";
function start() {
  render(<MantineProvider><AppControllerProvider><MessageListContainer footerHeight={100} /></AppControllerProvider></MantineProvider>);
  act(() => void vi.advanceTimersByTime(0));
  const socket = Socket.current;
  act(() => socket.deliver({ type: "snapshot", sessionId: "first", sequence: 0, throughSequence: 0, projectPath: "/first", isStreaming: true, messages: [
    { id: "old", role: "assistant", text: historicalText, thinking: "[Thinking file](./thought.md)" },
    { id: "custom", role: "custom", customType: "test", text: "[Custom file](./custom.md)" },
    { id: "user", role: "user", text: "[User file](./user.md)" },
  ] }));
  return socket;
}
describe("transcript file actions", () => {
  it("does not reparse historical Markdown during tokens, footer, widgets or catalogue updates", () => {
    const socket = start();
    expect(renders.mock.calls.filter(([text]) => text === historicalText)).toHaveLength(1);
    act(() => {
      socket.deliver({ type: "assistantDelta", sessionId: "first", sequence: 1, runId: "r", delta: "streamed token" });
      socket.deliver({ type: "footer", sessionId: "first", sequence: 2, footer: [{ key: "status", text: "Working" }] });
      socket.deliver({ type: "widgets", sessionId: "first", sequence: 3, widgets: [{ key: "todo", lines: ["New todo"], placement: "aboveEditor" }] });
      socket.deliver({ type: "catalogue", catalogue: { projects: [] } });
    });
    expect(renders.mock.calls.filter(([text]) => text === historicalText)).toHaveLength(1);
    fireEvent.click(screen.getByRole("link", { name: "Historical file" }));
    expect(socket.sent).toHaveLength(1);
    expect(socket.sent[0]).toMatchObject({ type: "openFile", sessionId: "first", path: "./report.pdf" });
  });

  it("opens assistant/thinking/custom/user links without prompt messages and suppresses duplicates", async () => {
    const socket = start();
    for (const name of ["Historical file", "Thinking file", "Custom file", "User file"]) {
      const link = screen.getByRole("link", { name, hidden: true });
      expect(link.getAttribute("href")).not.toBeNull(); // Native anchors retain Enter activation.
      fireEvent.click(link); fireEvent.click(link);
    }
    expect(socket.sent.map((message) => message.type)).toEqual(Array(4).fill("openFile"));
    expect(socket.sent.map((message) => message.path)).toEqual(["./report.pdf", "./thought.md", "./custom.md", "./user.md"]);
    await act(async () => {
      for (const request of socket.sent) socket.deliver({ type: "fileOpenResult", sessionId: request.sessionId, requestId: request.requestId, result: { ok: true } });
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("captures the new session after switching tabs", () => {
    const socket = start();
    act(() => {
      socket.deliver({ type: "snapshot", sessionId: "second", sequence: 0, throughSequence: 0, projectPath: "/second", isStreaming: false, messages: [{ id: "second-old", role: "assistant", text: historicalText }] });
      socket.deliver({ type: "tabs", activeSessionId: "second", tabs: ["first", "second"].map((sessionId) => ({ sessionId, title: sessionId, projectPath: `/${sessionId}`, projectName: sessionId, status: "idle" })) });
    });
    fireEvent.click(screen.getByRole("link", { name: "Historical file" }));
    expect(socket.sent[0]).toMatchObject({ type: "openFile", sessionId: "second", path: "./report.pdf" });
  });
});
