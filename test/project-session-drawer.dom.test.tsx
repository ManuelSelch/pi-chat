// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectCatalogue } from "../src/shared/protocol.js";
import { initialChatState } from "../src/web/app/state/chat-state.js";
import { ProjectSessionDrawer } from "../src/web/sessions/projects/ProjectSessionDrawer.js";

const catalogue: ProjectCatalogue = {
  projects: [
    {
      path: "/work/current",
      displayPath: "~/work/current",
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
      displayPath: "~/work/other",
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
const onOpenFolder = vi.fn();

function show(busy: boolean) {
  render(
    <MantineProvider>
      <ProjectSessionDrawer
        opened
        onClose={vi.fn()}
        state={{ ...initialChatState, status: busy ? "running" : "idle", sessionId: "current", projectPath: "/work/current" }}
        catalogue={catalogue}
        busy={busy}
        showDisplayPath={true}
        openSession={openSession}
        newSession={vi.fn()}
        deleteSession={vi.fn()}
        onOpenFolder={onOpenFolder}
      />
    </MantineProvider>,
  );
}

afterEach(() => {
  cleanup();
  openSession.mockClear();
  onOpenFolder.mockClear();
});

describe("ProjectSessionDrawer", () => {
  it("opens the server folder picker while an agent is running", () => {
    show(true);
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    expect(onOpenFolder).toHaveBeenCalledOnce();
    expect(openSession).not.toHaveBeenCalled();
  });
  it("allows selecting projects while the active session is busy", () => {
    show(true);

    fireEvent.click(screen.getByText("other"));

    expect(screen.getByText("Other chat")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New session" }).hasAttribute("disabled")).toBe(false);
  });

  it("moves the highlight to the clicked project", () => {
    show(false);

    const current = screen.getByText("~/work/current").closest("a")!;
    const other = screen.getByText("~/work/other").closest("a")!;
    expect(current.getAttribute("data-active")).toBe("true");

    fireEvent.click(other);

    expect(other.getAttribute("data-active")).toBe("true");
    expect(current.getAttribute("data-active")).toBeNull();
    // The running session's project stays recognisable without the highlight.
    expect(current.textContent).toContain("current");
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
