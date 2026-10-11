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
function setup(data = catalogue) {
  const handlers = { onClose: vi.fn(), onOpenSession: vi.fn(), onOpenProject: vi.fn(), onNewSession: vi.fn(), onOpenFolder: vi.fn(), onOpenSettings: vi.fn() };
  render(<MantineProvider><QuickOpen opened catalogue={data} tabs={[]} {...handlers} /></MantineProvider>);
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
it("distinguishes an empty catalogue, an empty scope and no search matches", () => {
  setup({ projects: [] });
  expect(screen.getByText("No folders or sessions yet. Open a folder to get started.")).toBeTruthy();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "missing" } });
  expect(screen.getByText('Nothing matches “missing”.')).toBeTruthy();
  fireEvent.change(input, { target: { value: "%" } });
  expect(screen.getByText("No worktrees available.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "/ Actions" }));
  expect(screen.getAllByRole("option")).toHaveLength(3);
});
it("offers search or scopes when folders exist but no recent sessions are available", () => {
  setup({ projects: [catalogue.projects[0]!] });
  expect(screen.getByText("No recent sessions. Search or choose a scope.")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "#" } });
  expect(screen.getByRole("option", { name: /Folder: pi-chat/ })).toBeTruthy();
});
it("wraps keyboard selection, activates worktrees, and resets selection after editing", () => {
  const handlers = setup();
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "%" } });
  let rows = screen.getAllByRole("option");
  fireEvent.keyDown(input, { key: "ArrowUp" });
  expect(rows[1]!.getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(rows[0]!.getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.change(input, { target: { value: "%palette" } });
  rows = screen.getAllByRole("option");
  expect(rows[0]!.getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(handlers.onOpenProject).toHaveBeenCalledWith("/feature");
});
it("does nothing on Enter with no results or during IME composition", () => {
  const handlers = setup();
  const input = screen.getByRole("textbox");
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(handlers.onOpenSession).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "missing" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(handlers.onOpenProject).not.toHaveBeenCalled();
  expect(handlers.onClose).not.toHaveBeenCalled();
});
it("clamps selection when the catalogue changes without a query edit", () => {
  const handlers = { onClose: vi.fn(), onOpenSession: vi.fn(), onOpenProject: vi.fn() };
  const view = render(<MantineProvider><QuickOpen opened catalogue={catalogue} tabs={[]} {...handlers} /></MantineProvider>);
  const input = screen.getByRole("textbox");
  fireEvent.change(input, { target: { value: "%" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  view.rerender(<MantineProvider><QuickOpen opened catalogue={{ projects: [catalogue.projects[1]!] }} tabs={[]} {...handlers} /></MantineProvider>);
  expect(screen.getByRole("option").getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(handlers.onOpenProject).toHaveBeenCalledWith("/feature");
});

it("cycles scopes with Tab and wraps Actions back to All even without results", () => {
  setup({ projects: [] });
  const input = screen.getByRole("textbox") as HTMLInputElement;
  input.focus();
  for (const [label, prefix] of [["# Folders", "#"], ["% Worktrees", "%"], ["@ Sessions", "@"], ["/ Actions", "/"], ["All", ""]]) {
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input.value).toBe(prefix);
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("button", { name: label }).getAttribute("aria-pressed")).toBe("true");
  }
});
it("preserves search text while cycling forward and backward and resets result selection", () => {
  setup();
  const input = screen.getByRole("textbox") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "palette" } });
  fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
  expect(input.value).toBe("/palette");
  fireEvent.keyDown(input, { key: "Tab" });
  expect(input.value).toBe("palette");
  fireEvent.change(input, { target: { value: "%" } });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
  fireEvent.keyDown(input, { key: "Tab" });
  expect(screen.getAllByRole("option")[0]!.getAttribute("aria-selected")).toBe("true");
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
