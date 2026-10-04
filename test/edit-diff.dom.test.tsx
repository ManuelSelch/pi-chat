/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, expect, it } from "vitest";
import { ToolCard } from "../src/web/chat/tools/ToolCard.js";
afterEach(cleanup);
it("shows literal diff lines inside the collapsed edit card", () => {
  const { container } = render(<MantineProvider><ToolCard tool={{ toolCallId: "e", name: "edit", status: "success", argsText: "{}", editDiff: { format: "unified", text: "--- a\n+++ a\n@@ -1 +1 @@\n-old\n+<script>bad()</script>\n", truncated: false } }} /></MantineProvider>);
  expect(screen.getByText("Changes")).toBeTruthy();
  expect(screen.getByText("<script>bad()</script>")).toBeTruthy();
  expect(container.querySelector("script")).toBeNull();
  expect((screen.getByTestId("tool-card") as HTMLDetailsElement).open).toBe(false);
  expect(container.querySelector('[data-kind="addition"]')).toBeTruthy();
});
