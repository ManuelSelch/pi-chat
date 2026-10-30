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
  expect(screen.getByTitle("Conversation title").textContent).toBe("Conversation title");
  expect(screen.getByRole("button", { name: `${later ? "Resume" : "Open"} Conversation title` })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Archive Conversation title" })).toBeTruthy();
});

it("places the status indicator beside the project rather than the primary label", () => {
  mount();

  const metadata = screen.getByRole("img", { name: "Ready" }).closest("div")!;
  expect(metadata.textContent).toContain("Project");
  expect(metadata.textContent).not.toContain("feat/worktree");
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
