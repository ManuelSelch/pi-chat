/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MantineProvider } from "@mantine/core";
import { MessageList } from "../../../../../src/web/chat/transcript/MessageList.js";
import type { ChatMessage } from "../../../../../src/shared/protocol.js";
afterEach(cleanup);

it("renders bash as plain text with context and result metadata", () => {
  const { container } = render(<MantineProvider><MessageList draft={undefined} messages={[{
    id: "b", role: "bash", bash: { command: "echo '<script>bad</script>'", output: "# heading\n<img src=x onerror=bad>", status: "error", exitCode: 2, excludeFromContext: true, truncated: true, fullOutputPath: "/tmp/full" },
  } as ChatMessage]} /></MantineProvider>);
  expect(container.querySelector("details[data-testid='bash-card']")?.hasAttribute("open")).toBe(false);
  expect(screen.getByTestId("bash-card").textContent).toContain("Excluded from model context");
  expect(screen.getByTestId("bash-card").textContent).toContain("Exit 2");
  expect(screen.getByText(/Output truncated/)).toBeTruthy();
  expect(screen.getByText(/\/tmp\/full/)).toBeTruthy();
  expect(container.querySelector("script, img, h1")).toBeNull();
  expect(container.textContent).toContain("# heading");
});
