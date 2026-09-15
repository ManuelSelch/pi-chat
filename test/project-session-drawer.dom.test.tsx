// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectCatalogue } from "../src/shared/protocol.js";
import { initialChatState } from "../src/web/chat/chat-state.js";
import { ProjectSessionDrawer } from "../src/web/projects/ProjectSessionDrawer.js";

const catalogue: ProjectCatalogue = {
  projects: [
    {
      path: "/work/current",
      name: "current",
      exists: true,
      modified: 2,
      sessionCount: 1,
      sessions: [
        { path: "/sessions/current.jsonl", id: "current", title: "Current chat", nameSource: "manual", modified: 2, created: 0, messageCount: 1 },
      ],
    },
    {
      path: "/work/other",
      name: "other",
      exists: true,
      modified: 1,
      sessionCount: 1,
      sessions: [
        { path: "/sessions/other.jsonl", id: "other", title: "Other chat", nameSource: "manual", modified: 1, created: 0, messageCount: 1 },
      ],
    },
  ],
};

const openSession = vi.fn();

function show(busy: boolean) {
  render(
    <MantineProvider>
      <ProjectSessionDrawer
        opened
        onClose={vi.fn()}
        state={{ ...initialChatState, status: busy ? "running" : "idle", sessionId: "current", projectPath: "/work/current" }}
        catalogue={catalogue}
        busy={busy}
        openSession={openSession}
        newSession={vi.fn()}
        deleteSession={vi.fn()}
      />
    </MantineProvider>,
  );
}

afterEach(() => {
  cleanup();
  openSession.mockClear();
});

describe("ProjectSessionDrawer", () => {
  it("allows selecting projects while the active session is busy", () => {
    show(true);

    fireEvent.click(screen.getByText("other"));

    expect(screen.getByText("Other chat")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New session here" }).hasAttribute("disabled")).toBe(false);
  });

  it("opens another session while the active one is busy", () => {
    show(true);

    fireEvent.click(screen.getByText("other"));
    fireEvent.click(screen.getByText("Other chat"));

    expect(openSession).toHaveBeenCalledWith("/sessions/other.jsonl");
  });

  it("only blocks deleting the session the run is writing to", () => {
    show(true);

    expect(screen.getByRole("button", { name: "Delete Current chat" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByText("other"));

    expect(screen.getByRole("button", { name: "Delete Other chat" }).hasAttribute("disabled")).toBe(false);
  });
});
