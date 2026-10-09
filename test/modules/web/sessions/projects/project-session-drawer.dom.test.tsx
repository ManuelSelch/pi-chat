// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectCatalogue } from "../../../../../src/shared/protocol.js";
import { ProjectSessionDrawer } from "../../../../../src/web/sessions/projects/ProjectSessionDrawer.js";

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

const groupedCatalogue: ProjectCatalogue = {
  projects: [
    { ...catalogue.projects[0]!, path: "/work/pi-chat", name: "pi-chat", sessionCount: 0, sessions: [], repositoryPath: "/work/pi-chat", repositoryName: "pi-chat", worktree: { branch: "main", detached: false, primary: true } },
    { ...catalogue.projects[1]!, path: "/work/pi-chat-feature", name: "pi-chat-feature", displayPath: "~/.worktrees/pi-chat/feature", repositoryPath: "/work/pi-chat", repositoryName: "pi-chat", worktree: { branch: "feat/worktree-projects-panel", detached: false, primary: false } },
    { path: "/work/pi-chat-fix", displayPath: "~/.worktrees/pi-chat/fix", name: "pi-chat-fix", exists: true, modified: 0, sessionCount: 0, sessions: [], repositoryPath: "/work/pi-chat", repositoryName: "pi-chat", worktree: { branch: "fix/reconnect", detached: false, primary: false } },
  ],
};

function show(busy: boolean) {
  render(
    <MantineProvider>
      <ProjectSessionDrawer
        opened
        onClose={vi.fn()}
        currentSessionId="current"
        currentProjectPath="/work/current"
        catalogue={catalogue}
        busy={busy}
        showDisplayPath={true}
        openSession={openSession}
        newSession={vi.fn()}
        deleteSession={vi.fn()}
        onOpenFolder={onOpenFolder}
        archiveSession={vi.fn(async () => undefined)}
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
  it("groups linked worktrees and shows the selected path in the session panel", () => {
    render(
      <MantineProvider>
        <ProjectSessionDrawer
          opened
          onClose={vi.fn()}
          currentSessionId="current"
          currentProjectPath="/work/pi-chat-feature"
          catalogue={groupedCatalogue}
          busy={false}
          showDisplayPath={true}
          openSession={openSession}
          newSession={vi.fn()}
          deleteSession={vi.fn()}
          onOpenFolder={onOpenFolder}
        />
      </MantineProvider>,
    );

    expect(screen.getByText("pi-chat")).toBeTruthy();
    expect(screen.getByText("feat/worktree-projects-panel")).toBeTruthy();
    expect(screen.queryByText("fix/reconnect")).toBeNull();
    expect(screen.getByText("~/.worktrees/pi-chat/feature")).toBeTruthy();
    expect(screen.queryByText("~/.worktrees/pi-chat/fix")).toBeNull();
    expect(screen.queryByText("No sessions in this checkout yet.")).toBeNull();
  });

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

    const current = screen.getAllByText("~/work/current")[0]!.closest("a")!;
    const other = screen.getAllByText("~/work/other")[0]!.closest("a")!;
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

  it("always shows Quick Chats first and offers New chat without a pin control", () => {
    const quickChatsCatalogue: ProjectCatalogue = {
      projects: [
        { path: "/home/me", displayPath: "~", name: "Quick Chats", exists: true, modified: 0, sessionCount: 0, sessions: [], quickChats: true },
        ...catalogue.projects,
      ],
    };
    render(
      <MantineProvider>
        <ProjectSessionDrawer
          opened
          onClose={vi.fn()}
          currentSessionId="current"
          currentProjectPath="/work/current"
          catalogue={quickChatsCatalogue}
          busy={false}
          showDisplayPath={true}
          openSession={openSession}
          newSession={vi.fn()}
          deleteSession={vi.fn()}
          onOpenFolder={onOpenFolder}
          pinProject={vi.fn(async () => undefined)}
        />
      </MantineProvider>,
    );

    const quickChats = screen.getByText("Quick Chats").closest("a")!;
    expect(quickChats.querySelector("svg")).toBeTruthy();
    expect(quickChats.getAttribute("data-active")).toBeNull();

    fireEvent.click(screen.getByText("Quick Chats"));

    expect(screen.getAllByText("Quick Chats").length).toBeGreaterThan(1);
    expect(screen.getByRole("button", { name: "New chat" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pin project" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unpin project" })).toBeNull();
  });

  it("only blocks archiving the session the run is writing to", async () => {
    show(true);

    const currentArchive = screen.getByRole("button", { name: "Archive Current chat" });
    expect(currentArchive.hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByText("other"));
    const otherArchive = screen.getByRole("button", { name: "Archive Other chat" });
    expect(otherArchive.hasAttribute("disabled")).toBe(false);
  });
});
