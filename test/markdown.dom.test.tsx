// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Markdown } from "../src/web/Markdown.js";

afterEach(cleanup);

describe("Markdown rendering", () => {
  it("renders $$ ... $$ display formulas through KaTeX", () => {
    const { container } = render(<Markdown>{"Einstein:\n\n$$E = mc^2$$"}</Markdown>);
    const display = container.querySelector(".katex-display");
    expect(display).not.toBeNull();
    expect(display!.querySelector(".katex")).not.toBeNull();
    expect(display!.textContent).toContain("E");
  });

  it("keeps single-dollar text literal instead of treating it as math", () => {
    const { container } = render(<Markdown>The price is $5 and $10.</Markdown>);
    expect(container.querySelector(".katex")).toBeNull();
    expect(container.textContent).toContain("$5");
  });

  it("renders a GFM table", () => {
    const { container } = render(
      <Markdown>{"| A | B |\n|---|---|\n| 1 | 2 |"}</Markdown>,
    );
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(table!.querySelectorAll("th")).toHaveLength(2);
    expect(table!.querySelectorAll("td")).toHaveLength(2);
    expect(table!.textContent).toContain("1");
  });

  it("renders a fenced code block with syntax highlighting classes", () => {
    const { container } = render(
      <Markdown>{"```ts\nconst answer: number = 42;\n```"}</Markdown>,
    );
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre!.querySelector("code")).not.toBeNull();
    expect(pre!.textContent).toContain("42");
    // rehype-highlight annotates tokens it recognizes.
    expect(pre!.querySelector(".hljs-keyword")).not.toBeNull();
  });

  it("never executes raw HTML from model output", () => {
    const { container } = render(
      <Markdown>{"Hello <script>window.__pwned = true</script> <img src=\"x\" onerror=\"window.__pwned2 = true\"> <b onclick=\"alert(1)\">bold</b>"}</Markdown>,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    // Raw HTML is dropped entirely (no rehype-raw), so even the onclick <b> is gone.
    expect(container.querySelector("b")).toBeNull();
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).__pwned2).toBeUndefined();
  });

  it("drops unsafe link protocols and opens external links safely", () => {
    const { container } = render(
      <Markdown>{"[ok](https://example.com) [bad](javascript:alert(1)) [also-bad](data:text/html,<script>alert(1)</script>)"}</Markdown>,
    );
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toBe("https://example.com");
    expect(links[0]!.getAttribute("target")).toBe("_blank");
    expect(links[0]!.getAttribute("rel")).toContain("noopener");
    expect(container.textContent).toContain("bad");
    expect(container.textContent).toContain("also-bad");
  });
});

describe("ToolCard rendering", () => {
  it("is collapsed by default and expands to show arguments and result", async () => {
    const { ToolCard } = await import("../src/web/ToolCard.js");
    render(
      <ToolCard
        tool={{ toolCallId: "c1", name: "bash", status: "success", argsText: '{"command":"ls"}', outputText: "README.md" }}
      />,
    );
    const card = screen.getByTestId("tool-card");
    expect(card).not.toHaveProperty("open", true);
    expect(card.textContent).toContain("bash");

    (card.querySelector("summary") as HTMLElement).click();
    expect(card).toHaveProperty("open", true);
    expect(card.textContent).toContain('"ls"');
    expect(card.textContent).toContain("README.md");
  });

  it("marks errors visually", async () => {
    const { ToolCard } = await import("../src/web/ToolCard.js");
    render(<ToolCard tool={{ toolCallId: "c2", name: "edit", status: "error", outputText: "permission denied" }} />);
    const card = screen.getByTestId("tool-card");
    expect(card.className).toContain("error");
    expect(card.textContent).toContain("Failed");
  });
});
