// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InboxView, type InboxViewProps } from "../../../../../../../src/web/sessions/inbox/ui/components/InboxView.js";
afterEach(cleanup);
const props = (): InboxViewProps => ({
  opened: true, presentation: "sidebar", activeSessionId: "a", pending: false,
  page: "session", onNavigate: vi.fn(), laterOpen: false, onLaterToggle: vi.fn(),
  rows: [
    { key: "a", sessionId: "a", path: "/a", title: "Question", primaryLabel: "Question", project: "Project", status: "blocked" },
    { key: "b", sessionId: "b", path: "/b", title: "Background", primaryLabel: "Background", project: "Project", status: "running" },
    { key: "c", sessionId: "c", path: "/c", title: "Completed", primaryLabel: "Completed", project: "Quick Chats", status: "idle" },
  ],
  later: [{ key: "/later", path: "/later", title: "Parked", primaryLabel: "Parked", project: "Project", status: "idle" }],
  onClose: vi.fn(), onSettings: vi.fn(), onSelect: vi.fn(), onOpenSaved: vi.fn(), onPark: vi.fn(), onArchive: vi.fn(), onResume: vi.fn(),
});

it.each(["sidebar", "drawer"] as const)("provides Home and Inbox navigation, current state and attention count in the %s", presentation => {
  const p = { ...props(), presentation, page: "home" as const };
  const { rerender } = render(<MantineProvider><InboxView {...p} /></MantineProvider>);

  expect(screen.getByRole("button", { name: "Home" }).getAttribute("aria-current")).toBe("page");
  const inbox = screen.getByRole("button", { name: /^Inbox/ });
  expect(inbox.textContent).toBe("Inbox2");
  expect(inbox.getAttribute("aria-current")).toBeNull();
  fireEvent.click(inbox);
  expect(p.onNavigate).toHaveBeenCalledWith("inbox");
  expect(p.onSelect).not.toHaveBeenCalled();
  expect(p.onClose).not.toHaveBeenCalled();

  rerender(<MantineProvider><InboxView {...p} page="inbox" /></MantineProvider>);
  expect(screen.getByRole("button", { name: /^Inbox/ }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(screen.getByRole("button", { name: "Home" }));
  expect(p.onNavigate).toHaveBeenCalledWith("home");
});

it("groups sessions by project, with collapsible groups and status dots", () => {
  const p = props();
  render(<MantineProvider><InboxView {...p} /></MantineProvider>);

  expect(screen.getAllByRole("region").map(region => region.getAttribute("aria-label"))).toEqual(["Project", "Quick Chats"]);
  expect(within(screen.getByRole("region", { name: "Project" })).getAllByRole("button", { name: /^Open/ })).toHaveLength(2);
  expect(screen.getByRole("button", { name: /^Later/ }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Parked")).toBeNull();
  expect(screen.queryByRole("button", { name: "Move Background to Later" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Archive Background" })).toBeNull();
  expect(screen.getByRole("button", { name: "Move Question to Later" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Move Completed to Later" })).toHaveProperty("disabled", false);

  const project = screen.getByRole("button", { name: "Project" });
  fireEvent.click(project);

  expect(project.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("button", { name: "Open Background" })).toBeNull();
  expect(screen.getByRole("button", { name: "Open Completed" })).toBeTruthy();
  expect(p.onSelect).not.toHaveBeenCalled();

  fireEvent.click(project);
  expect(screen.getByRole("button", { name: "Open Background" })).toBeTruthy();
});

it("omits empty project groups and empty Later without adding search or branding", () => {
  render(<MantineProvider><InboxView {...props()} rows={[]} later={[]} /></MantineProvider>);

  expect(screen.queryAllByRole("region")).toHaveLength(0);
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Later/ })).toBeNull();
  expect(screen.getByText("No sessions")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
});

it("opens and parks unloaded Ready rows by saved path", () => {
  const p = props();
  p.rows = [{ key: "/saved", path: "/saved", title: "Saved", primaryLabel: "Saved", project: "Project", status: "idle" }];
  render(<MantineProvider><InboxView {...p} /></MantineProvider>);

  fireEvent.click(screen.getByRole("button", { name: "Open Saved" }));
  expect(p.onOpenSaved).toHaveBeenCalledWith("/saved");
  expect(p.onSelect).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Move Saved to Later" }));
  expect(p.onPark).toHaveBeenCalledWith("/saved");
});

it("selects without parking and exposes fixed Settings and explicit resume", () => {
  const p = props();
  render(<MantineProvider><InboxView {...p} laterOpen /></MantineProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Open Question" }));
  expect(p.onSelect).toHaveBeenCalledWith("a");
  expect(p.onPark).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Resume Parked" }));
  expect(p.onResume).toHaveBeenCalledWith("/later");
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(p.onSettings).toHaveBeenCalledOnce();
});
