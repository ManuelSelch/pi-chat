/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { afterEach, describe, expect, it } from "vitest";
import { MessageList } from "../../../../../src/web/chat/transcript/MessageList.js";

afterEach(cleanup);

type Level = "info" | "warning" | "error";

class NoticeDriver {
  private density: "compact" | "comfortable" = "comfortable";
  private container?: HTMLElement;

  setDensity(density: "compact" | "comfortable"): void {
    this.density = density;
  }

  showNotice(level: Level, text: string): void {
    this.container = render(
      <MantineProvider>
        <MessageList messages={[{ id: "notice", role: "notice", level, text }]} draft={undefined} compact={this.density === "compact"} />
      </MantineProvider>,
    ).container;
  }

  expectCompactNotice(level: Level, text: string): void {
    const notice = this.container?.querySelector(`.compact-notice[data-level="${level}"]`);
    expect(notice).not.toBeNull();
    expect(notice?.querySelector("svg")).not.toBeNull();
    expect(notice?.querySelector("pre")?.textContent).toBe(text);
    expect(notice?.classList.contains("mantine-Alert-root")).toBe(false);
  }

  expectComfortableNotice(level: Level, text: string): void {
    const notice = this.container?.querySelector(".mantine-Alert-root");
    expect(notice).not.toBeNull();
    expect(notice?.querySelector("pre")?.textContent).toBe(text);
    expect(notice?.querySelector("svg")).not.toBeNull();
    expect(notice?.getAttribute("data-variant")).toBe("light");
    expect(notice?.getAttribute("style")).toContain(`--alert-color: var(--mantine-color-${level === "error" ? "red" : level === "warning" ? "yellow" : "teal"}`);
  }
}

describe("transcript notice density", () => {
  it.each<Level>(["info", "warning", "error"])("shows a minimal %s notice in compact mode", (level) => {
    const notices = new NoticeDriver();
    notices.setDensity("compact");
    notices.showNotice(level, "Session notice");
    notices.expectCompactNotice(level, "Session notice");
  });

  it("preserves multiline notice text and indentation in compact mode", () => {
    const notices = new NoticeDriver();
    const text = "Available branches:\n  main     current\n  feature  local";
    notices.setDensity("compact");
    notices.showNotice("info", text);
    notices.expectCompactNotice("info", text);
  });

  it.each<Level>(["info", "warning", "error"])("keeps the existing %s notice in comfortable mode", (level) => {
    const notices = new NoticeDriver();
    notices.setDensity("comfortable");
    notices.showNotice(level, "Session notice");
    notices.expectComfortableNotice(level, "Session notice");
  });
});
