// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QuickOpen } from "../../../../../src/web/sessions/quick-open/QuickOpen.js";
import type { ProjectCatalogue } from "../../../../../src/shared/protocol.js";

afterEach(cleanup);
const catalogue: ProjectCatalogue = { projects: [
  { path: "/repo", displayPath: "~/repo", name: "pi-chat", exists: true, modified: 1, sessionCount: 0, sessions: [] },
  { path: "/feature", displayPath: "~/trees/feature", name: "feature", exists: true, modified: 2, sessionCount: 1,
    repositoryName: "pi-chat", repositoryPath: "/repo", worktree: { branch: "feat/palette", detached: false, primary: false },
    sessions: [{ path: "/sessions/one", id: "one", title: "Improve search", nameSource: "manual", modified: 2, created: 0, messageCount: 1 }] },
  { path: "/detached", displayPath: "~/trees/review", name: "review", exists: true, modified: 0, sessionCount: 0, sessions: [],
    repositoryName: "pi-chat", worktree: { detached: true, primary: false, commit: "abcdef123456" } },
] };
function setup() {
  const handlers = { onClose: vi.fn(), onOpenSession: vi.fn(), onOpenProject: vi.fn(), onNewSession: vi.fn(), onOpenFolder: vi.fn(), onOpenSettings: vi.fn() };
  render(<MantineProvider><QuickOpen opened catalogue={catalogue} tabs={[]} {...handlers} /></MantineProvider>);
  return handlers;
}
it("identifies each type by icon and accessible name without visible right-hand labels", () => {
  setup();
  expect(screen.getByRole("option", { name: /Session: Improve search.*pi-chat.*feat\/palette/ }).querySelector(".tabler-icon-message")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "# Folders" }));
  expect(screen.getByRole("option", { name: /Folder: pi-chat.*~\/repo/ }).querySelector(".tabler-icon-folder")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "% Worktrees" }));
  expect(screen.getByRole("option", { name: /Worktree: feat\/palette.*pi-chat.*trees\/feature/ }).querySelector(".tabler-icon-git-branch")).not.toBeNull();
  expect(screen.getByRole("option", { name: /Worktree: review.*detached at abcdef1/ })).toBeTruthy();
  expect(screen.queryByText("Worktree")).toBeNull();
  expect(screen.queryByText("Session")).toBeNull();
  expect(screen.queryByText("Folder")).toBeNull();
});
it.each([
  ["New session", "onNewSession"], ["Open folder…", "onOpenFolder"], ["Open settings", "onOpenSettings"],
] as const)("activates the %s action through the existing callback", (title, callback) => {
  const handlers = setup();
  fireEvent.click(screen.getByRole("button", { name: "/ Actions" }));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(`Action: ${title}`) }));
  expect(handlers[callback]).toHaveBeenCalledOnce();
  expect(handlers.onClose).toHaveBeenCalledOnce();
});
it("keeps existing project/session activation with new worktree identity", () => {
  const handlers = setup();
  fireEvent.click(screen.getByRole("option", { name: /Session: Improve search/ }));
  expect(handlers.onOpenSession).toHaveBeenCalledWith("/sessions/one");
  fireEvent.click(screen.getByRole("button", { name: "% Worktrees" }));
  fireEvent.click(screen.getByRole("option", { name: /Worktree: feat\/palette/ }));
  expect(handlers.onOpenProject).toHaveBeenCalledWith("/feature");
});
it("uses neutral styling and scopes focus the search input", () => {
  setup();
  fireEvent.click(screen.getByRole("button", { name: "/ Actions" }));
  expect(document.activeElement).toBe(screen.getByRole("textbox"));
  const option = screen.getAllByRole("option")[0]!;
  expect(option.style.background).toBe("");
  expect(option.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("button", { name: "/ Actions" }).getAttribute("aria-pressed")).toBe("true");
});
