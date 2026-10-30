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

function show(options: { busy?: boolean; data?: ProjectCatalogue; currentPath?: string; currentSessionPath?: string; hideArchivedSessions?: boolean; presentation?: "sidebar" | "drawer" } = {}) {
  const archiveSession = vi.fn(async () => undefined), pinProject = vi.fn(async () => undefined), removeProject = vi.fn(async () => undefined), openSession = vi.fn(), newSession = vi.fn(), onOpenFolder = vi.fn();
  const onClose = vi.fn();
  const drawer = (data: ProjectCatalogue) => (
    <MantineProvider>
      <ProjectSessionDrawer
        opened presentation={options.presentation ?? "drawer"} onClose={onClose} currentSessionPath={options.currentSessionPath ?? "/sessions/current.jsonl"} currentProjectPath={options.currentPath ?? "/work/current"}
        catalogue={data} busy={options.busy ?? false} showDisplayPath hideArchivedSessions={options.hideArchivedSessions ?? false}
        openSession={openSession} newSession={newSession} onOpenFolder={onOpenFolder}
        archiveSession={archiveSession} pinProject={pinProject} removeProject={removeProject}
      />
    </MantineProvider>
  );
  const { rerender } = render(drawer(options.data ?? catalogue));
  return { archiveSession, pinProject, openSession, newSession, onOpenFolder, onClose, updateCatalogue: (data: ProjectCatalogue) => rerender(drawer(data)) };
}

describe("ProjectSessionDrawer", () => {
  it("renders desktop navigation without a dialog or focus trap", () => {
    show({ presentation: "sidebar" });

    expect(screen.getByRole("navigation", { name: "Projects" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Close projects" })).toBeTruthy();
  });

  it.each(["sidebar", "drawer"] as const)("keeps %s open after selecting or creating a session", presentation => {
    const { openSession, newSession, onClose } = show({ presentation });

    fireEvent.click(screen.getByText("Current chat"));
    expect(openSession).toHaveBeenCalledWith("/sessions/current.jsonl");
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "New session in other" }));
    expect(newSession).toHaveBeenCalledWith("/work/other");
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    { currentSessionPath: "/sessions/main.jsonl", label: "Main chat" },
    { currentSessionPath: "/sessions/feature.jsonl", label: "feat/worktree-projects-panel" },
  ])("does not highlight the opened session or worktree row ($currentSessionPath)", ({ currentSessionPath, label }) => {
    show({ data: groupedCatalogue, currentPath: "/work/pi-chat-feature", currentSessionPath });
    const button = screen.getByText(label).closest("button")!;
    expect(button.getAttribute("aria-current")).toBe("page");
    const otherLabel = currentSessionPath === "/sessions/main.jsonl" ? "feat/worktree-projects-panel" : "Main chat";
    const otherButton = screen.getByText(otherLabel).closest("button")!;
    expect(button.parentElement!.className).toBe(otherButton.parentElement!.className);
  });

  it("shows every active project in recency order without hiding pi-chat after five projects", () => {
    const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "pi-chat"];
    const projects = names.map((name, index) => ({
      path: `/work/${name}`, displayPath: `/work/${name}`, name, exists: true, modified: 0, sessionCount: 1,
      sessions: [session(name, `${name} chat`, { modified: index + 1 })],
    }));
    const pinned = { ...projects[0]!, path: "/pin", name: "Pinned", pinned: true };
    const quick = { ...projects[0]!, path: "/home/me", name: "Quick Chats", quickChats: true };
    const archived = { ...projects[0]!, path: "/old", name: "Old", sessionCount: 0, sessions: [session("old", "Old chat", { archivedAt: 10 })] };
    show({ data: { projects: [quick, pinned, ...projects, archived] }, currentPath: "/work/pi-chat" });

    const expected = ["Quick Chats", "Pinned", ...names.toReversed()];
    for (let i = 1; i < expected.length; i += 1) {
      expect(screen.getByText(expected[i - 1]!).compareDocumentPosition(screen.getByText(expected[i]!)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.getByText("pi-chat chat")).toBeTruthy();
    expect(screen.queryByText("Old")).toBeNull();
    for (const name of names) {
      expect(screen.queryByRole("button", { name: `Remove ${name} from project history` })).toBeNull();
    }
    fireEvent.click(screen.getByRole("button", { name: /Other projects/ }));
    expect(screen.getByText("Old")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Old from project history" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove Pinned from project history" })).toBeNull();
  });

  it("moves a project into Other after its last session is archived and restores it in recency order", () => {
    const active = { ...catalogue.projects[1]!, sessions: [session("other", "Other chat", { modified: 20 })] };
    const archived = { ...active, sessionCount: 0, sessions: [session("other", "Other chat", { modified: 20, archivedAt: 30 })] };
    const older = { ...catalogue.projects[0]!, sessions: [session("current", "Current chat", { modified: 10 })] };
    const { updateCatalogue } = show({ data: { projects: [older, active] } });
    const follows = () => expect(screen.getByText("other").compareDocumentPosition(screen.getByText("current")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    follows();
    expect(screen.queryByRole("button", { name: /Other projects/ })).toBeNull();

    updateCatalogue({ projects: [older, archived] });
    expect(screen.queryByText("other")).toBeNull();
    const toggle = screen.getByRole("button", { name: /Other projects/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Remove other from project history" })).toBeTruthy();

    updateCatalogue({ projects: [older, active] });
    expect(screen.queryByRole("button", { name: /Other projects/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove other from project history" })).toBeNull();
    follows();
  });

  it("reorders projects on activity updates without changing their expanded state", () => {
    const older = { ...catalogue.projects[0]!, sessions: [session("current", "Current chat", { modified: 10 })] };
    const newer = { ...catalogue.projects[1]!, sessions: [session("other", "Other chat", { modified: 20 })] };
    const { updateCatalogue } = show({ data: { projects: [older, newer] } });
    fireEvent.click(screen.getByText("other"));
    updateCatalogue({ projects: [{ ...older, sessions: [session("current", "Current chat", { modified: 30 })] }, newer] });

    expect(screen.getByText("current").compareDocumentPosition(screen.getByText("other")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Other chat")).toBeTruthy();
    expect(screen.getByText("Current chat")).toBeTruthy();
  });

  it("groups worktrees per repository and labels a lone worktree session with the branch", () => {
    show({ data: groupedCatalogue, currentPath: "/work/pi-chat-feature" });

    expect(screen.getByText("pi-chat")).toBeTruthy();
    expect(screen.getByText("~/work/pi-chat")).toBeTruthy();
    expect(screen.getByText("feat/worktree-projects-panel")).toBeTruthy();
    expect(screen.getByText("Main chat")).toBeTruthy();
    expect(screen.queryByText("fix/reconnect")).toBeNull();
    expect(screen.queryByText("~/.worktrees/pi-chat/feature")).toBeNull();
  });

  it("puts archived-only projects in the collapsed Other projects section", () => {
    const archivedOnly: ProjectCatalogue = {
      projects: [
        ...catalogue.projects,
        {
          path: "/work/archived", displayPath: "~/work/archived", name: "archived", exists: true, modified: 0, sessionCount: 0,
          sessions: [session("archived", "Old chat", { archivedAt: 10 })],
        },
      ],
    };
    show({ data: archivedOnly });

    expect(screen.queryByText("archived")).toBeNull();
    const toggle = screen.getByRole("button", { name: /Other projects/ });
    fireEvent.click(toggle);

    expect(screen.getByText("archived")).toBeTruthy();
    fireEvent.click(screen.getByText("archived"));
    expect(screen.getByRole("button", { name: /Archived/ })).toBeTruthy();
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
