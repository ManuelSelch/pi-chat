// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectCatalogue } from "../src/shared/protocol.js";
import { Home } from "../src/web/home/Home.js";

afterEach(cleanup);

const catalogue: ProjectCatalogue = {
  projects: [
    {
      path: "/work/pi-chat",
      name: "pi-chat",
      exists: true,
      modified: Date.now(),
      sessionCount: 1,
      sessions: [
        {
          path: "/sessions/study.jsonl",
          id: "s1",
          title: "Study Notes",
          nameSource: "manual",
          modified: Date.now(),
          created: 0,
          messageCount: 4,
        },
      ],
    },
  ],
};

function show() {
  const onOpenSession = vi.fn();
  const onOpenProject = vi.fn();
  const onNewSession = vi.fn();
  render(
    <MantineProvider>
      <Home
        catalogue={catalogue}
        onOpenSession={onOpenSession}
        onOpenProject={onOpenProject}
        onNewSession={onNewSession}
      />
    </MantineProvider>,
  );
  return { onOpenSession, onOpenProject, onNewSession };
}

describe("Home", () => {
  it("starts quiet and does not show recent sessions before typing", () => {
    show();

    expect(screen.getByRole("textbox", { name: "Search sessions and projects" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New session" })).toBeTruthy();
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("creates a new default session from the button", () => {
    const { onNewSession } = show();

    fireEvent.click(screen.getByRole("button", { name: "New session" }));

    expect(onNewSession).toHaveBeenCalledOnce();
  });

  it("creates a new default session when Enter is pressed on an empty search", () => {
    const { onNewSession } = show();

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search sessions and projects" }), { key: "Enter" });

    expect(onNewSession).toHaveBeenCalledOnce();
  });

  it("shows matching sessions only after typing", () => {
    show();
    const search = screen.getByRole("textbox", { name: "Search sessions and projects" });

    fireEvent.change(search, { target: { value: "study" } });

    expect(screen.getByRole("option", { name: /Study Notes/ })).toBeTruthy();
  });

  it("opens the highlighted session when Enter is pressed after typing", () => {
    const { onOpenSession, onNewSession } = show();
    const search = screen.getByRole("textbox", { name: "Search sessions and projects" });

    fireEvent.change(search, { target: { value: "study" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(onOpenSession).toHaveBeenCalledWith("/sessions/study.jsonl");
    expect(onNewSession).not.toHaveBeenCalled();
  });
});
