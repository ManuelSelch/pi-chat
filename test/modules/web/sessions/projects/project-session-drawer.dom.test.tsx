// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectCatalogue } from "../../../../../src/shared/protocol.js";
import { ProjectSessionDrawer } from "../../../../../src/web/sessions/projects/ProjectSessionDrawer.js";

const session = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  path: `/sessions/${id}.jsonl`, id, title, nameSource: "manual" as const, modified: 1, created: 0, messageCount: 1, ...extra,
});

const catalogue: ProjectCatalogue = {
  projects: [
    {
      path: "/work/current", displayPath: "~/work/current", name: "current", exists: true, modified: 2, sessionCount: 1,
      sessions: [session("current", "Current chat")],
    },
    {
      path: "/work/other", displayPath: "~/work/other", name: "other", exists: true, modified: 1, sessionCount: 1,
      sessions: [session("other", "Other chat")],
    },
  ],
};

/** A repository with a primary checkout and a visible worktree, plus an empty
 *  hidden worktree. */
const groupedCatalogue: ProjectCatalogue = {
  projects: [
    {
      path: "/work/pi-chat", displayPath: "~/work/pi-chat", name: "pi-chat", exists: true, modified: 3, sessionCount: 1,
      sessions: [session("main", "Main chat", { modified: 3 })],
      repositoryPath: "/work/pi-chat", repositoryName: "pi-chat", worktree: { branch: "main", detached: false, primary: true },
    },
    {
      path: "/work/pi-chat-feature", displayPath: "~/.worktrees/pi-chat/feature", name: "pi-chat-feature", exists: true, modified: 2, sessionCount: 1,
      sessions: [session("feature", "Feature chat", { modified: 2 })],
      repositoryPath: "/work/pi-chat", repositoryName: "pi-chat", worktree: { branch: "feat/worktree-projects-panel", detached: false, primary: false },
    },
    {
      path: "/work/pi-chat-fix", displayPath: "~/.worktrees/pi-chat/fix", name: "pi-chat-fix", exists: true, modified: 0, sessionCount: 0, sessions: [],
      repositoryPath: "/work/pi-chat", repositoryName: "pi-chat", worktree: { branch: "fix/reconnect", detached: false, primary: false },
    },
  ],
};

afterEach(cleanup);

function show(options: { busy?: boolean; data?: ProjectCatalogue; currentPath?: string } = {}) {
  const archiveSession = vi.fn(async () => undefined), pinProject = vi.fn(async () => undefined), openSession = vi.fn(), newSession = vi.fn(), onOpenFolder = vi.fn();
  render(
    <MantineProvider>
      <ProjectSessionDrawer
        opened onClose={vi.fn()} currentSessionId="current" currentProjectPath={options.currentPath ?? "/work/current"}
        catalogue={options.data ?? catalogue} busy={options.busy ?? false} showDisplayPath
        openSession={openSession} newSession={newSession} onOpenFolder={onOpenFolder}
        archiveSession={archiveSession} pinProject={pinProject}
      />
    </MantineProvider>,
  );
  return { archiveSession, pinProject, openSession, newSession, onOpenFolder };
}

describe("ProjectSessionDrawer", () => {
  it("groups worktrees per repository and labels a lone worktree session with the branch", () => {
    show({ data: groupedCatalogue, currentPath: "/work/pi-chat-feature" });

    expect(screen.getByText("pi-chat")).toBeTruthy();
    expect(screen.getByText("~/work/pi-chat")).toBeTruthy();
    expect(screen.getByText("feat/worktree-projects-panel")).toBeTruthy();
    expect(screen.getByText("Main chat")).toBeTruthy();
    expect(screen.queryByText("fix/reconnect")).toBeNull();
    expect(screen.queryByText("~/.worktrees/pi-chat/feature")).toBeNull();
  });

  it("opens the server folder picker while an agent is running", () => {
    const { onOpenFolder } = show({ busy: true });
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    expect(onOpenFolder).toHaveBeenCalledOnce();
  });

  it("moves the highlight to the clicked group and expands its sessions", () => {
    show();
    const current = screen.getByText("current").closest("button")!;
    const other = screen.getByText("other").closest("button")!;
    expect(current.getAttribute("aria-current")).toBe("true");

    fireEvent.click(other);

    expect(other.getAttribute("aria-current")).toBe("true");
    expect(current.getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Other chat")).toBeTruthy();
  });

  it("opens another session while the active one is busy", () => {
    const { openSession } = show({ busy: true });
    fireEvent.click(screen.getByText("other"));
    fireEvent.click(screen.getByText("Other chat"));
    expect(openSession).toHaveBeenCalledWith("/sessions/other.jsonl");
  });

  it("starts a new session in the clicked group", () => {
    const { newSession } = show();
    fireEvent.click(screen.getByRole("button", { name: "New session in other" }));
    expect(newSession).toHaveBeenCalledWith("/work/other");
  });

  it("always shows Quick Chats first and offers New chat without a pin control", () => {
    const quickChatsCatalogue: ProjectCatalogue = {
      projects: [
        { path: "/home/me", displayPath: "~", name: "Quick Chats", exists: true, modified: 0, sessionCount: 0, sessions: [], quickChats: true },
        ...catalogue.projects,
      ],
    };
    show({ data: quickChatsCatalogue });

    const quickChats = screen.getByText("Quick Chats").closest("button")!;
    expect(quickChats.querySelector("svg")).toBeTruthy();
    const firstProject = screen.getByText("current").closest("button")!;
    expect(quickChats.compareDocumentPosition(firstProject) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("button", { name: "New chat in Quick Chats" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pin Quick Chats" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unpin Quick Chats" })).toBeNull();
  });

  it("only blocks archiving the session the run is writing to", async () => {
    show({ busy: true });

    expect(screen.getByRole("button", { name: "Archive Current chat" }).hasAttribute("disabled")).toBe(true);

    fireEvent.click(screen.getByText("other"));
    expect(screen.getByRole("button", { name: "Archive Other chat" }).hasAttribute("disabled")).toBe(false);
  });
});
