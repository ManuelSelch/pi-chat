/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MantineProvider } from "@mantine/core";
import { MessageList } from "../src/web/chat/MessageList.js";
import type { ChatMessage } from "../src/shared/protocol.js";

afterEach(cleanup);

function renderMessages(messages: ChatMessage[]) {
  return render(
    <MantineProvider>
      <MessageList messages={messages} draft={undefined} />
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
});
