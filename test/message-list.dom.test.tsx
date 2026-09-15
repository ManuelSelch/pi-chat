/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MantineProvider } from "@mantine/core";
import { MessageList } from "../src/web/chat/MessageList.js";
import type { ChatMessage } from "../src/shared/protocol.js";

afterEach(cleanup);

function renderMessages(messages: ChatMessage[], draft?: { runId: string; text: string; thinking: string }) {
  return render(
    <MantineProvider>
      <MessageList messages={messages} draft={draft} />
    </MantineProvider>,
  );
}

describe("MessageList", () => {
  it("renders pi.sendMessage custom messages as distinct extension cards", () => {
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
    expect(screen.getByRole("heading", { name: "Memory Check" })).not.toBeNull();
    expect(container.querySelector("article[data-testid='custom-message'] .markdown")).not.toBeNull();
  });

  it("collapses the reasoning of a finished message and leaves the answer visible", () => {
    renderMessages([{ id: "a", role: "assistant", text: "The answer", thinking: "The reasoning" }]);
    const panel = screen.getByTestId("thinking-panel") as HTMLDetailsElement;
    expect(panel.open).toBe(false);
    expect(screen.getByText("The answer")).not.toBeNull();
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
