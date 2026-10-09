// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSessionDrawer } from "../../../../../src/web/sessions/projects/ProjectSessionDrawer.js";
import type { ProjectCatalogue } from "../../../../../src/shared/protocol.js";
afterEach(cleanup);
const catalogue: ProjectCatalogue = { projects: [
  { path: "/project", name: "Project", displayPath: "~/project", exists: true, modified: 1, sessionCount: 1, pinned: true, sessions: [
    { id: "active", path: "/active.jsonl", title: "Active conversation", nameSource: "manual", modified: 1, created: 0, messageCount: 2 },
    { id: "archived", path: "/archived.jsonl", title: "Old conversation", nameSource: "manual", modified: 0, created: 0, messageCount: 4, archivedAt: 2 },
  ] },
  { path: "/empty", name: "Empty pinned", displayPath: "~/empty", exists: true, modified: 0, sessionCount: 0, pinned: true, sessions: [] },
] };
function show(archiveSession = vi.fn(async () => {})) {
  const pinProject = vi.fn(async () => {}), openSession = vi.fn(), newSession = vi.fn();
  render(<MantineProvider><ProjectSessionDrawer opened onClose={vi.fn()} currentSessionId="active" currentProjectPath="/project" catalogue={catalogue} busy={false} showDisplayPath openSession={openSession} newSession={newSession} onOpenFolder={vi.fn()} archiveSession={archiveSession} pinProject={pinProject} /></MantineProvider>);
  return { archiveSession, pinProject, openSession, newSession };
}
describe("archive panel", () => {
  it("starts the archive section collapsed and opens archived sessions normally", () => {
    const { openSession } = show();
    const toggle = screen.getByRole("button", { name: /Archived/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByText("Old conversation"));
    expect(openSession).toHaveBeenCalledWith("/archived.jsonl");
  });
  it("archives through the server without an inline success banner", async () => {
    const { archiveSession } = show();
    fireEvent.click(screen.getByRole("button", { name: "Archive Active conversation" }));
    await waitFor(() => expect(archiveSession).toHaveBeenCalledWith("/active.jsonl", true));
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
  it("reports persistence failure without offering Undo", async () => {
    const archiveSession = vi.fn(async () => { throw new Error("disk full"); });
    show(archiveSession);
    fireEvent.click(screen.getByRole("button", { name: "Archive Active conversation" }));
    await waitFor(() => expect(screen.getByText("disk full")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });
  it("keeps pinned projects before recent projects without duplicating group headings", () => {
    const projects: ProjectCatalogue = { projects: [
      { ...catalogue.projects[0]!, name: "A pinned" },
      { ...catalogue.projects[0]!, path: "/recent", name: "M recent", pinned: false },
      { ...catalogue.projects[1]!, name: "Z empty pinned" },
      { ...catalogue.projects[1]!, path: "/repo", name: "Repository", repositoryPath: "/repo", repositoryName: "Repository", worktree: { branch: "main", detached: false, primary: true } },
      { ...catalogue.projects[0]!, path: "/feature", name: "Feature", pinned: false, repositoryPath: "/repo", repositoryName: "Repository", worktree: { branch: "feature", detached: false, primary: false } },
    ] };
    render(<MantineProvider><ProjectSessionDrawer opened onClose={vi.fn()} currentSessionId="active" currentProjectPath="/project" catalogue={projects} busy={false} showDisplayPath openSession={vi.fn()} newSession={vi.fn()} onOpenFolder={vi.fn()} /></MantineProvider>);
    expect(screen.queryByText("Pinned projects")).toBeNull();
    expect(screen.queryByText("Recent projects")).toBeNull();
    for (const pinned of ["A pinned", "Z empty pinned", "Repository"]) {
      for (const recent of ["M recent"]) {
        const pinnedRow = screen.getAllByText(pinned)[0]!;
        const recentRow = screen.getAllByText(recent)[0]!;
        expect(pinnedRow.compareDocumentPosition(recentRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    }
  });
  it("keeps empty pinned projects selectable and offers New session", () => {
    const { newSession, pinProject } = show();
    fireEvent.click(screen.getByText("Empty pinned"));
    fireEvent.click(screen.getByRole("button", { name: "New session in Empty pinned" }));
    expect(newSession).toHaveBeenCalledWith("/empty");
    fireEvent.click(screen.getByRole("button", { name: "Unpin Empty pinned" }));
    expect(pinProject).toHaveBeenCalledWith("/empty", false);
  });
});
