// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  pending: false, laterOpen: false, onLaterToggle: vi.fn(), onOpen: vi.fn(), onPark: vi.fn(), onArchive: vi.fn(), onNew: vi.fn(),
});

it("shows Blocked and Ready cards, excludes working sessions, and keeps Later collapsed", () => {
  const p = props();
  render(<MantineProvider><InboxPage {...p} /></MantineProvider>);

  expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
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

it("restores parked conversations explicitly and retains archive access", () => {
  const p = props();
  render(<MantineProvider><InboxPage {...p} laterOpen /></MantineProvider>);

  fireEvent.click(screen.getByRole("button", { name: "Resume Parked" }));
  expect(p.onOpen).toHaveBeenCalledWith(p.later[0], true);
  fireEvent.click(screen.getByRole("button", { name: "Archive Parked" }));
  expect(p.onArchive).toHaveBeenCalledWith(p.later[0]);
});

it("offers Home when caught up, even while work continues, without fake change counts", () => {
  const p = props();
  render(<MantineProvider><InboxPage {...p} rows={p.rows.filter(row => row.status === "running")} later={[]} /></MantineProvider>);

  expect(screen.getByText("Nothing waiting here")).toBeTruthy();
  expect(screen.queryAllByRole("region")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: /Later/ })).toBeNull();
  expect(screen.queryByRole("button", { name: "New session" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Start a session" }));
  expect(p.onNew).toHaveBeenCalledOnce();
});
