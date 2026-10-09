/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, expect, it } from "vitest";
import { ToolCard } from "../../../../../src/web/chat/tools/ToolCard.js";
import type { ToolCard as Card } from "../../../../../src/shared/protocol.js";
afterEach(cleanup);
function show(tool: Partial<Card>) {
  const view = render(<MantineProvider><ToolCard tool={{ toolCallId: "file", name: "read", status: "success", ...tool }} /></MantineProvider>);
  const card = screen.getByTestId("tool-card") as HTMLDetailsElement;
  card.open = true;
  fireEvent(card, new Event("toggle"));
  return view;
}
it.each(["read", "write"])("highlights %s TypeScript based on the filename", async (name) => {
  const text = 'const answer: number = 42;\nconst tag = "<script>bad()</script>";';
  const { container } = show({ name, argsText: '{"path":"src/EXAMPLE.TS"}', ...(name === "write" ? { writeContent: { text, truncated: false } } : { outputText: text }) });
  await waitFor(() => expect(container.querySelector(".hljs-keyword")?.textContent).toBe("const"));
  expect(container.querySelector("code.language-typescript")?.textContent).toBe(text);
  expect(container.querySelector("script")).toBeNull();
});
it("previews Markdown reads without loading images or HTML", async () => {
  const { container } = show({ argsText: '{"path":"README.md"}', outputText: '# Read document\n\n![remote](https://example.com/a.png)\n\n<script>bad()</script>' });
  expect(await screen.findByRole("heading", { name: "Read document" })).toBeTruthy();
  expect(container.querySelector("img, script")).toBeNull();
});
it.each(["notes.txt", "file.unknown", undefined])("keeps %s literal instead of treating it as Markdown", (path) => {
  const text = "# Not a heading\n<script>bad()</script>";
  const { container } = show({ name: "write", argsText: JSON.stringify({ path }), writeContent: { text, truncated: false } });
  expect(container.querySelector("pre code")?.textContent).toBe(text);
  expect(container.querySelector("h1, script")).toBeNull();
});
it("keeps failed read results and arguments plain", () => {
  const { container } = show({ status: "error", argsText: '{"path":"README.md"}', outputText: "# Permission denied" });
  expect(screen.getByText("# Permission denied")).toBeTruthy();
  expect(container.querySelector("h1, .hljs")).toBeNull();
});
it.each(["\n\n[Showing lines 1-2 of 10. Use offset=3 to continue.]", "\n\n[8 more lines in file. Use offset=3 to continue.]", "… [truncated]"])("keeps read truncation notices outside highlighted code", async (notice) => {
  const text = "const answer = 42;";
  const { container } = show({ argsText: '{"path":"file.ts"}', outputText: text + notice });
  await waitFor(() => expect(container.querySelector(".hljs-keyword")).toBeTruthy());
  expect(container.querySelector("pre code")?.textContent).toBe(text);
  expect(screen.getByText(notice.trim())).toBeTruthy();
});
it("uses the full path even when the arguments are truncated", async () => {
  const { container } = show({ argsText: `{"path":"${"nested/".repeat(30)}file.py","unused":"… [truncated]`, outputText: "def answer():\n    return 42" });
  await waitFor(() => expect(container.querySelector("code.language-python .hljs-keyword")?.textContent).toBe("def"));
});
it("highlights edit code while preserving markers, line numbers, and diff backgrounds", async () => {
  const { container } = show({ name: "edit", argsText: '{"path":"file.ts"}', editDiff: { format: "pi-display", text: "-1 const answer = 1;\n+1 const answer = 2;", truncated: false } });
  await waitFor(() => expect(container.querySelector('[data-kind="addition"] .hljs-keyword')?.textContent).toBe("const"));
  expect(container.querySelector('[data-kind="removal"] .hljs-keyword')?.textContent).toBe("const");
  expect(container.querySelector('[data-kind="addition"]')?.textContent).toContain("1+const answer = 2;");
});
