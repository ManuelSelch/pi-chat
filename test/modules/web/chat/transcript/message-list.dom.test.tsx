/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MantineProvider } from "@mantine/core";
import { MessageList } from "../../../../../src/web/chat/transcript/MessageList.js";
import type { ChatMessage } from "../../../../../src/shared/protocol.js";

afterEach(cleanup);

function renderMessages(messages: ChatMessage[], draft?: { runId: string; text: string; thinking: string }, compact = false) {
  return render(
    <MantineProvider>
      <MessageList messages={messages} draft={draft} compact={compact} />
    </MantineProvider>,
  );
}

function tool(id: string, name: string, status: "running" | "success" | "error" = "success"): ChatMessage {
  return { id, role: "tool", tool: { toolCallId: id, name, status, argsText: `args-${id}`, outputText: `result-${id}` } };
}

describe("MessageList", () => {
  it.each([true, false])("preserves user newlines without changing assistant Markdown (compact=%s)", async (compact) => {
    const { container } = renderMessages([
      { id: "user", role: "user", text: "A\nB\nC\n\n**Bold**\nNext line\n\n```text\nx\ny\n```" },
      { id: "assistant", role: "assistant", text: "Assistant\ncontinuation" },
    ], undefined, compact);

    await screen.findByText("Bold");
    const articles = container.querySelectorAll("article");
    expect(articles[0]?.querySelector("p")?.innerHTML).toBe("A<br>\nB<br>\nC");
    expect(articles[0]?.querySelector("strong")?.textContent).toBe("Bold");
    expect(articles[0]?.querySelector("pre code")?.textContent).toBe("x\ny\n");
    expect(articles[1]?.querySelector(".markdown p")?.innerHTML).toBe("Assistant\ncontinuation");
  });

  it.each([true, false])("shows Pi labels only outside compact mode (compact=%s)", async (compact) => {
    renderMessages([
      { id: "thinking", role: "assistant", text: "", thinking: "Inspect first" },
      { id: "answer", role: "assistant", text: "Final answer" },
    ], { runId: "live", text: "Streaming answer", thinking: "Still thinking" }, compact);
    expect(screen.queryAllByText("Pi")).toHaveLength(compact ? 0 : 3);
    expect(await screen.findByText("Final answer")).not.toBeNull();
    expect(await screen.findByText("Streaming answer")).not.toBeNull();
  });

  it("groups consecutive compact tools by name and keeps reasoning and answer in order", async () => {
    const { container } = renderMessages([
      { id: "a", role: "assistant", text: "", thinking: "Inspect first" },
      tool("r1", "read"), tool("w1", "write"), tool("r2", "read"),
      { id: "b", role: "assistant", text: "", thinking: "Now verify" },
      tool("b1", "bash"),
      { id: "c", role: "assistant", text: "Final answer" },
    ], undefined, true);
    const groups = screen.getAllByTestId("tool-group") as HTMLDetailsElement[];
    expect(groups.map((group) => group.querySelector("summary")?.textContent)).toEqual(["Used 2 read, 1 write", "Used 1 bash"]);
    expect(groups.every((group) => !group.open)).toBe(true);
    const first = groups[0]!;
    expect(first.querySelectorAll("[data-testid='tool-card']")).toHaveLength(3);
    expect(Array.from(container.querySelector("section")!.children).map((row) => row.tagName)).toEqual(["ARTICLE", "DETAILS", "ARTICLE", "DETAILS", "ARTICLE"]);
    first.open = true;
    fireEvent(first, new Event("toggle"));
    const card = first.querySelector("[data-testid='tool-card']") as HTMLDetailsElement;
    card.open = true;
    fireEvent(card, new Event("toggle"));
    expect(card.textContent).toContain("args-r1");
    expect(card.textContent).toContain("result-r1");
    expect(await screen.findByText("Final answer")).not.toBeNull();
  });

  it("leaves comfortable tools ungrouped", () => {
    renderMessages([tool("r1", "read"), tool("r2", "read")]);
    expect(screen.queryByTestId("tool-group")).toBeNull();
    expect(screen.getAllByTestId("tool-card")).toHaveLength(2);
  });

  it("does not group across non-tool messages", () => {
    renderMessages([tool("r1", "read"), { id: "n", role: "notice", level: "info", text: "Notice" }, tool("r2", "read")], undefined, true);
    expect(screen.getAllByTestId("tool-group")).toHaveLength(2);
  });

  it("keeps a complete tool group at the visible history boundary", () => {
    renderMessages([
      { id: "u", role: "user", text: "Start" },
      ...Array.from({ length: 45 }, (_, i) => tool(`r${i}`, "read")),
    ], undefined, true);
    expect(screen.getByText("Used 45 read")).not.toBeNull();
    expect(screen.getByText("Show earlier messages (1)")).not.toBeNull();
  });

  it("preserves an expanded group during live tool updates and exposes running/errors", () => {
    const messages = [tool("r1", "read")];
    const { rerender } = renderMessages(messages, undefined, true);
    const group = screen.getByTestId("tool-group") as HTMLDetailsElement;
    group.open = true;
    fireEvent(group, new Event("toggle"));
    rerender(<MantineProvider><MessageList messages={[...messages, tool("b1", "bash", "running"), tool("w1", "write", "error")]} draft={undefined} compact /></MantineProvider>);
    expect((screen.getByTestId("tool-group") as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByText(/1 running/)).not.toBeNull();
    expect(screen.getByText(/1 failed/)).not.toBeNull();
  });
  it("renders pi.sendMessage custom messages as distinct extension cards", async () => {
    const { container } = renderMessages([
      {
        id: "custom-1",
        role: "custom",
        customType: "pi-memory-md-check",
        text: "# Memory Check\n\nPath: `/tmp/memory`",
      },
    ]);

    const card = screen.getByTestId("custom-message");
    // Marked by a themed accent, not a filled panel: the colour has to follow
    // the primary colour so a later theme changes it in one place.
    expect(card.style.borderLeft).toBe("3px solid var(--mantine-primary-color-filled)");
    expect(card.style.background).toBe("");
    expect(screen.getByText("pi-memory-md-check").style.textTransform).toBe("uppercase");
    expect(await screen.findByRole("heading", { name: "Memory Check" })).not.toBeNull();
    expect(container.querySelector("article[data-testid='custom-message'] .markdown")).not.toBeNull();
  });

  it("preserves whitespace in multi-line notices", async () => {
    const text = "   main (primary)\n   feat/simpler-ui\n * fix/exit-worktree (active)";
    const { container } = renderMessages([{ id: "notice-1", role: "notice", level: "info", text }]);

    const notice = container.querySelector(".markdown-notice");
    expect(notice?.textContent).toBe(text);
    expect(notice?.querySelector("pre")?.textContent).toBe(text);
  });

  it("collapses the reasoning of a finished message and leaves the answer visible", async () => {
    renderMessages([{ id: "a", role: "assistant", text: "The answer", thinking: "The reasoning" }]);
    const panel = screen.getByTestId("thinking-panel") as HTMLDetailsElement;
    expect(panel.open).toBe(false);
    expect(await screen.findByText("The answer")).not.toBeNull();
  });

  it("opens the reasoning while it is still streaming", () => {
    renderMessages([], { runId: "run", text: "", thinking: "Half a thou" });
    const panel = screen.getByTestId("thinking-panel") as HTMLDetailsElement;
    expect(panel.open).toBe(true);
    expect(screen.getByText("Thinking…")).not.toBeNull();
  });

  it("keeps the panel shut once the reader shuts it", () => {
    renderMessages([], { runId: "run", text: "", thinking: "A thought" });
    const panel = screen.getByTestId("thinking-panel") as HTMLDetailsElement;
    panel.open = false;
    fireEvent(panel, new Event("toggle", { bubbles: false }));
    expect(panel.open).toBe(false);
  });

  it("keeps streaming reasoning out of the transcript's live announcements", () => {
    const { container } = renderMessages([], { runId: "run", text: "", thinking: "A long thought" });
    // The transcript is aria-live="polite"; without this the reader hears every
    // token of the reasoning instead of the answer.
    expect(container.querySelector("section[aria-live='polite']")).not.toBeNull();
    expect(screen.getByTestId("thinking-panel").querySelector("[aria-live='off']")).not.toBeNull();
  });

  it("shows no panel for a message without reasoning", () => {
    renderMessages([{ id: "a", role: "assistant", text: "Just an answer" }]);
    expect(screen.queryByTestId("thinking-panel")).toBeNull();
  });
});
