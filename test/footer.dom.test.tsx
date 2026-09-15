// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { FooterItem } from "../src/shared/protocol.js";
import { Footer } from "../src/web/chat/Footer.js";

afterEach(cleanup);

const readonly: FooterItem = { key: "status.readonly", text: "READONLY", align: "left", variant: "badge" };
const model: FooterItem = { key: "model", text: "doppelclaude/claude-opus-5", align: "right", variant: "plain" };
const thinking: FooterItem = { key: "thinking", text: "thinking: minimal", align: "right", variant: "plain" };

function show(items: FooterItem[]) {
  const { container } = render(
    <MantineProvider>
      <Footer items={items} />
    </MantineProvider>,
  );
  return container;
}

describe("Footer", () => {
  it("puts what the session runs with on the right and pinned labels on the left", () => {
    const container = show([readonly, model, thinking]);
    const [left, right] = [...container.querySelectorAll("[class*='Group-root'] > [class*='Group-root']")];

    expect(left?.textContent).toBe("READONLY");
    expect(right?.textContent).toContain("doppelclaude/claude-opus-5");
    expect(right?.textContent).toContain("thinking: minimal");
  });

  /**
   * The footer is whatever the session says it is, so a new entry reaches the
   * screen without this component learning anything about it.
   */
  it("renders an entry it has never heard of", () => {
    show([{ key: "branch", text: "main", align: "left", variant: "plain" }]);

    expect(screen.getByText("main")).toBeTruthy();
  });

  it("renders nothing when there is nothing to report", () => {
    // Mantine injects its own style block, so the row itself is what to look for.
    expect(show([]).querySelector("[class*='Group-root']")).toBeNull();
  });
});
