// @vitest-environment jsdom
import { AppShell, MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { Tab } from "../../../../types/view-types.js";
import { InboxHeader } from "../components/InboxHeader.js";

vi.mock("../../../../app/plugins/SidePanelProvider.js",()=>({SidePanelToggle:()=> <button aria-label="Toggle side panel"/>}));

afterEach(cleanup);

function renderHeader(status: Tab["status"], saved = true, branch: string | undefined = undefined) {
  const props: ComponentProps<typeof InboxHeader> = {
    session: { sessionId: "runtime", sessionPath: "/saved", title: "Conversation", projectPath: "/project", projectName: "Project", status },
    title: "Conversation", branch, opened: true, disabled: false, pending: false, saved,
    onToggle: vi.fn(), onNew: vi.fn(), onPark: vi.fn(), onArchive: vi.fn(), onCloseView: vi.fn(),
  };
  render(<MantineProvider><AppShell><InboxHeader {...props} /></AppShell></MantineProvider>);
}

it("places the side-panel toggle after New session at the far right",()=>{
  renderHeader("idle");

  const plus = screen.getByRole("button",{name:"New session"});
  const toggle = screen.getByRole("button",{name:"Toggle side panel"});
  expect(plus.nextElementSibling).toBe(toggle);
  expect(toggle.nextElementSibling).toBeNull();
});

it("removes header branding without removing breadcrumbs or navigation", () => {
  renderHeader("idle");

  expect(screen.queryByText("Pi Chat", { exact: true })).toBeNull();
  expect(screen.getByText("Project", { exact: true })).toBeTruthy();
  expect(screen.getByText("Conversation", { exact: true })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Go to Home" })).toBeNull();
  expect(screen.getByRole("button", { name: "Sessions" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "New session" })).toBeTruthy();
});

it("shows the worktree branch instead of the session title and separate branch label", () => {
  renderHeader("idle", true, "feature/header");

  expect(screen.getByText("feature/header", { exact: true })).toBeTruthy();
  expect(screen.queryByText("Conversation", { exact: true })).toBeNull();
  expect(screen.queryByTitle("Branch: feature/header")).toBeNull();
});

it("falls back to the session title for a blank worktree branch", () => {
  renderHeader("idle", true, "  ");

  expect(screen.getByText("Conversation", { exact: true })).toBeTruthy();
});

it("omits the title placeholder when no session is selected", () => {
  const props: ComponentProps<typeof InboxHeader> = {
    session: undefined, title: undefined, branch: undefined, opened: false, disabled: false, pending: false, saved: false,
    onToggle: vi.fn(), onNew: vi.fn(), onPark: vi.fn(), onArchive: vi.fn(), onCloseView: vi.fn(),
  };
  render(<MantineProvider><AppShell><InboxHeader {...props} /></AppShell></MantineProvider>);

  expect(screen.queryByText("No session open")).toBeNull();
  expect(screen.getByRole("button", { name: "Sessions" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "New session" })).toBeTruthy();
});

it("omits pause and archive while running, but retains Close view", () => {
  renderHeader("running");

  expect(screen.queryByRole("button", { name: "Move current session to Later" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Archive current session" })).toBeNull();
  expect(screen.getByRole("button", { name: "Close current session view" })).toHaveProperty("disabled", false);
});

it.each([
  ["idle", true, false],
  ["idle", false, true],
  ["blocked", true, true],
] as const)("preserves action eligibility for %s sessions (saved=%s)", (status, saved, disabled) => {
  renderHeader(status, saved);

  expect(screen.getByRole("button", { name: "Move current session to Later" })).toHaveProperty("disabled", disabled);
  expect(screen.getByRole("button", { name: "Archive current session" })).toHaveProperty("disabled", disabled);
});
