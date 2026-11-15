// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InboxPage, type InboxPageProps } from "../../../../../../../src/web/sessions/inbox/ui/components/InboxPage.js";

afterEach(cleanup);
const props = (): InboxPageProps => ({
  rows: [
    { key: "blocked", sessionId: "blocked", title: "Decision", primaryLabel: "Decision", project: "Pi", status: "blocked" },
    { key: "idle", path: "/saved", title: "Review", primaryLabel: "Review", project: "Pi", branch: "feature", status: "idle" },
    { key: "running", sessionId: "running", title: "Background", primaryLabel: "Background", project: "Pi", status: "running" },
  ],
  later: [{ key: "later", path: "/later", title: "Parked", primaryLabel: "Parked", project: "Pi", status: "idle" }],
  pending: false, laterOpen: false, onLaterToggle: vi.fn(), onOpen: vi.fn(), onPark: vi.fn(), onArchive: vi.fn(),
});

it("shows Blocked and Ready cards, excludes working sessions, and keeps Later collapsed", () => {
  const p = props();
  render(<MantineProvider><InboxPage {...p} /></MantineProvider>);

  expect(screen.queryByRole("heading", { name: "Inbox" })).toBeNull();
  expect(screen.getAllByRole("region").map(region => region.getAttribute("aria-label"))).toEqual(["Blocked", "Ready"]);
  expect(screen.queryByText("Background")).toBeNull();
  expect(screen.queryByText("Parked")).toBeNull();
  expect(screen.getByRole("button", { name: /^Later/ }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.getByRole("button", { name: "Move Decision to Later" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Move Review to Later" })).toHaveProperty("disabled", false);

  fireEvent.click(screen.getByRole("button", { name: "Open Review" }));
  expect(p.onOpen).toHaveBeenCalledWith(p.rows[1], false);
  fireEvent.click(screen.getByRole("button", { name: "Move Review to Later" }));
  expect(p.onPark).toHaveBeenCalledWith(p.rows[1]);
  fireEvent.click(screen.getByRole("button", { name: /^Later/ }));
  expect(p.onLaterToggle).toHaveBeenCalledOnce();
});

it("emphasizes project and worktree above a small dimmed session name", () => {
  render(<MantineProvider><InboxPage {...props()} /></MantineProvider>);

  const card = screen.getByRole("button", { name: "Open Review" });
  const project = within(card).getByText("Pi");
  const branch = within(card).getByText("feature");
  const session = within(card).getByText("Review");

  expect(project.getAttribute("data-size")).toBe("sm");
  expect(branch.getAttribute("data-size")).toBe("sm");
  expect(project.style.fontWeight).toBe("600");
  expect(branch.style.fontWeight).toBe("600");
  expect(project.parentElement).toBe(branch.parentElement?.parentElement);
  expect(session.getAttribute("data-size")).toBe("xs");
  expect(session.style.color).toBe("var(--mantine-color-dimmed)");
  expect(card.lastElementChild).toBe(session);
});

it("restores parked conversations explicitly and retains archive access", () => {
  const p = props();
  render(<MantineProvider><InboxPage {...p} laterOpen /></MantineProvider>);

  fireEvent.click(screen.getByRole("button", { name: "Resume Parked" }));
  expect(p.onOpen).toHaveBeenCalledWith(p.later[0], true);
  fireEvent.click(screen.getByRole("button", { name: "Archive Parked" }));
  expect(p.onArchive).toHaveBeenCalledWith(p.later[0]);
});

it("shows a quiet caught-up message without duplicate Home heading or start actions", () => {
  const p = props();
  render(<MantineProvider><InboxPage {...p} rows={p.rows.filter(row => row.status === "running")} later={[]} /></MantineProvider>);

  expect(screen.getByText("Nothing waiting here. Start a session above.")).toBeTruthy();
  expect(screen.queryAllByRole("region")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: /Later/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "New session" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Start a session" })).toBeNull();
});
