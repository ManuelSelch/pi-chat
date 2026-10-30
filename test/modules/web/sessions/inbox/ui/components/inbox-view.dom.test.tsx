// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { InboxView, type InboxViewProps } from "../../../../../../../src/web/sessions/inbox/ui/components/InboxView.js";
afterEach(cleanup);
const props = (): InboxViewProps => ({
  opened: true, presentation: "sidebar", activeSessionId: "a", pending: false,
  query: "", onQuery: vi.fn(), workingOpen: true, onWorkingToggle: vi.fn(), laterOpen: false, onLaterToggle: vi.fn(),
  rows: [
    { key: "a", sessionId: "a", path: "/a", title: "Question", primaryLabel: "Question", project: "Project", status: "blocked" },
    { key: "b", sessionId: "b", path: "/b", title: "Background", primaryLabel: "Background", project: "Project", status: "running" },
    { key: "c", sessionId: "c", path: "/c", title: "Completed", primaryLabel: "Completed", project: "Quick Chats", status: "idle" },
  ],
  later: [{ key: "/later", path: "/later", title: "Parked", primaryLabel: "Parked", project: "Project", status: "idle" }],
  onClose: vi.fn(), onSettings: vi.fn(), onSelect: vi.fn(), onOpenSaved: vi.fn(), onPark: vi.fn(), onArchive: vi.fn(), onResume: vi.fn(),
});
it("shows status sections in approved order and Later collapsed", () => {
  render(<MantineProvider><InboxView {...props()} /></MantineProvider>);
  expect(screen.getAllByRole("region").map(region => region.getAttribute("aria-label"))).toEqual(["Needs you", "Ready", "Working"]);
  expect(screen.getByRole("button", { name: /^Later/ }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Parked")).toBeNull();
  expect(screen.queryByRole("button", { name: "Move Background to Later" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Archive Background" })).toBeNull();
  expect(screen.getByRole("button", { name: "Move Question to Later" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Move Completed to Later" })).toHaveProperty("disabled", false);
});
it("collapses Working independently while keeping its count and toggle available", () => {
  const p = props();
  render(<MantineProvider><InboxView {...p} workingOpen={false} /></MantineProvider>);

  expect(screen.queryByRole("button", { name: "Open Background" })).toBeNull();
  const working = screen.getByRole("button", { name: /Working\s*1/ });
  expect(working.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(working);
  expect(p.onWorkingToggle).toHaveBeenCalledOnce();
  expect(screen.getByRole("button", { name: "Open Completed" })).toBeTruthy();
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
