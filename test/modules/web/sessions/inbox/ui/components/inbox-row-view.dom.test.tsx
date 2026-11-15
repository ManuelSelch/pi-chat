// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InboxRowView } from "../../../../../../../src/web/sessions/inbox/ui/components/InboxRowView.js";
import type { InboxRow } from "../../../../../../../src/web/sessions/inbox/domain/inbox-model.js";

afterEach(cleanup);
const row = (): InboxRow => ({
  key: "runtime", sessionId: "runtime", path: "/saved", project: "Project", title: "Conversation title",
  branch: "feat/worktree", primaryLabel: "feat/worktree", secondaryLabel: "Conversation title", status: "idle",
});
function mount(value = row(), later = false) {
  render(<MantineProvider><InboxRowView row={value} active={false} later={later} pending={false} onSelect={vi.fn()} onPark={vi.fn()} onArchive={vi.fn()} /></MantineProvider>);
}

it.each([false, true])("renders worktree-first labels while preserving conversation-based action names (Later=%s)", later => {
  mount(row(), later);

  expect(screen.getByTitle("feat/worktree").textContent).toBe("feat/worktree");
  expect(screen.getByText("Conversation title").textContent).toBe("Conversation title");
  expect(screen.getByRole("button", { name: `${later ? "Resume" : "Open"} Conversation title` })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Archive Conversation title" })).toBeTruthy();
});

it.each([false, true])("keeps the hidden title on hover and accessible actions for compact rows (Later=%s)", later => {
  mount({ ...row(), secondaryLabel: undefined }, later);

  const button = screen.getByRole("button", { name: `${later ? "Resume" : "Open"} Conversation title` });
  expect(button.title).toBe("Conversation title");
  expect(screen.queryByText("Conversation title")).toBeNull();
  expect(screen.getByTitle("feat/worktree")).toBeTruthy();
});

it.each([[60_000, "1m"], [120 * 60_000, "2h"], [3 * 24 * 60 * 60_000, "3d"], [0, "just now"]] as const)("renders compact recency for age %s", (age, label) => {
  vi.spyOn(Date, "now").mockReturnValue(1_000_000_000);
  try {
    mount({ ...row(), modified: Date.now() - age });

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText(/ago$/)).toBeNull();
  } finally { vi.restoreAllMocks(); }
});

it.each([
  ["idle", false, "--mantine-color-green-6"],
  ["blocked", false, "--mantine-color-red-6"],
  ["running", false, "--mantine-color-orange-6"],
  ["idle", true, "--pi-status-later"],
] as const)("uses the correct indicator for %s (Later=%s)", (status, later, color) => {
  mount({ ...row(), status }, later);

  expect(screen.getByRole("img").getAttribute("style")).toContain(color);
});

it("keeps Later untimed", () => {
  mount({ ...row(), modified: Date.now() - 60_000 }, true);

  expect(screen.queryByText(/^(1m|1m ago)$/)).toBeNull();
});

it("omits the project name from grouped session rows", () => {
  mount();

  expect(screen.queryByText("Project")).toBeNull();
  expect(screen.getByRole("img", { name: "Ready" })).toBeTruthy();
});

it("retains the project name for ungrouped Later rows", () => {
  mount(row(), true);

  expect(screen.getByText("Project")).toBeTruthy();
});

it("omits running-row lifecycle controls instead of disabling them", () => {
  mount({ ...row(), status: "running" });

  expect(screen.queryByRole("button", { name: "Move Conversation title to Later" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Archive Conversation title" })).toBeNull();
  expect(screen.getByRole("button", { name: "Open Conversation title" })).toBeTruthy();
});

it("keeps idle lifecycle actions available and blocked actions guarded", () => {
  mount({ ...row(), status: "blocked" });

  expect(screen.getByRole("button", { name: "Move Conversation title to Later" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Archive Conversation title" })).toHaveProperty("disabled", true);
});

it("does not add a redundant branch subtitle to main-checkout rows", () => {
  mount({ ...row(), primaryLabel: "Conversation title", secondaryLabel: undefined });

  expect(screen.getAllByText("Conversation title")).toHaveLength(1);
  expect(screen.queryByText("feat/worktree")).toBeNull();
});
