// @vitest-environment jsdom
import { AppShell, MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { Tab } from "../../../../../../../src/web/app/state/view-types.js";
import { InboxHeader } from "../../../../../../../src/web/sessions/inbox/ui/components/InboxHeader.js";

afterEach(cleanup);

function renderHeader(status: Tab["status"], saved = true) {
  const props: ComponentProps<typeof InboxHeader> = {
    session: { sessionId: "runtime", sessionPath: "/saved", title: "Conversation", projectPath: "/project", projectName: "Project", status },
    title: "Conversation", branch: "main", opened: true, disabled: false, pending: false, saved,
    buttons: [], badges: [], onToggle: vi.fn(), onNew: vi.fn(), onPark: vi.fn(), onArchive: vi.fn(), onCloseView: vi.fn(), onAction: vi.fn(),
  };
  render(<MantineProvider><AppShell><InboxHeader {...props} /></AppShell></MantineProvider>);
}

it("removes header branding without removing breadcrumbs or navigation", () => {
  renderHeader("idle");

  expect(screen.queryByText("Pi Chat", { exact: true })).toBeNull();
  expect(screen.getByText("Project", { exact: true })).toBeTruthy();
  expect(screen.getByText("Conversation", { exact: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sessions" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "New session" })).toBeTruthy();
});

it("omits the title placeholder when no session is selected", () => {
  const props: ComponentProps<typeof InboxHeader> = {
    session: undefined, title: undefined, branch: undefined, opened: false, disabled: false, pending: false, saved: false,
    buttons: [], badges: [], onToggle: vi.fn(), onNew: vi.fn(), onPark: vi.fn(), onArchive: vi.fn(), onCloseView: vi.fn(), onAction: vi.fn(),
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
