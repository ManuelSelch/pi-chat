/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, expect, it } from "vitest";
import { ToolCard } from "../../../../../src/web/chat/tools/ToolCard.js";
import type { ToolCard as Card } from "../../../../../src/shared/protocol.js";
afterEach(cleanup);
function show(text: string, status: Card["status"] = "success", truncated = false) {
  return render(<MantineProvider><ToolCard tool={{ toolCallId: "w", name: "write", status, argsText: '{"path":"document.md"}', outputText: "Result text", writeContent: { text, truncated } }} /></MantineProvider>);
}
function open() {
  const card = screen.getByTestId("tool-card") as HTMLDetailsElement;
  card.open = true;
  fireEvent(card, new Event("toggle"));
}
it("renders Markdown only after expansion, with no active HTML or remote images", async () => {
  const { container } = show("# Document\n\n- item\n\n```js\nconst x = 1;\n```\n\n![picture](https://example.com/a.png)\n\n<script>bad()</script>\n\n[bad](javascript:alert(1))");
  expect(screen.queryByRole("heading", { name: "Document" })).toBeNull();
  open();
  expect(await screen.findByRole("heading", { name: "Document" })).toBeTruthy();
  expect(container.querySelector("li")?.textContent).toBe("item");
  expect(container.querySelector("pre code")).toBeTruthy();
  expect(container.querySelector("img, script, a[href^='javascript:']")).toBeNull();
  expect(screen.getByText("Written content")).toBeTruthy();
  expect(container.querySelector("details details")).toBeTruthy();
});
it.each([["running", "Content to write"], ["error", "Attempted content"]] as const)("labels %s content honestly", (status, label) => {
  show("# Content", status); open();
  expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByText("Result text")).toBeTruthy();
});
it("handles empty and truncated content", () => {
  show("", "success", true); open();
  expect(screen.getByText("Empty file")).toBeTruthy();
  expect(screen.getByText(/Content truncated/)).toBeTruthy();
});
