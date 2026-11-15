// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initialAppState, type AppState } from "../../../../../../../src/web/app/state/app-state.js";
import { InboxContainer } from "../../../../../../../src/web/sessions/inbox/ui/containers/InboxContainer.js";

const chat = { app: initialAppState as AppState, inbox: { later: [], pending: false }, focusTab: vi.fn() };
const overlays = { open: vi.fn(), close: vi.fn(), state: { projects: true }, projectsPresentation: "sidebar" as "sidebar" | "drawer" };
vi.mock("../../../../../../../src/web/app/AppControllerContext.js", () => ({ useAppController: () => chat }));
vi.mock("../../../../../../../src/web/app/overlays/OverlayController.js", () => ({ useOverlays: () => overlays }));

beforeEach(() => {
  vi.clearAllMocks();
  overlays.projectsPresentation = "sidebar";
  chat.app = { ...initialAppState, tabsKnown: true, connection: "open" };
});
afterEach(cleanup);
const panel = () => <MantineProvider><InboxContainer /></MantineProvider>;

it.each(["sidebar", "drawer"] as const)("opens project navigation without redundant page destinations in the %s", presentation => {
  overlays.projectsPresentation = presentation;
  render(panel());

  expect(overlays.open).toHaveBeenCalledWith("projects");
  expect(screen.queryByRole("button", { name: "Home" })).toBeNull();
  expect(screen.queryByRole("button", { name: /^Inbox/ })).toBeNull();
  expect(chat.focusTab).not.toHaveBeenCalled();
  expect(overlays.close).not.toHaveBeenCalled();
});

it("keeps working sessions accessible alongside idle sessions in their project", () => {
  chat.app = { ...chat.app, activeSessionId: "running", tabs: [
    { sessionId: "running", title: "Work", projectName: "Project", projectPath: "/project", status: "running" },
    { sessionId: "idle", title: "Review", projectName: "Project", projectPath: "/project", status: "idle" },
  ] };
  render(panel());

  expect(screen.getAllByRole("region").map(region => region.getAttribute("aria-label"))).toEqual(["Project"]);
  expect(screen.getByRole("button", { name: "Open Work" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Open Review" }));
  expect(chat.focusTab).toHaveBeenCalledWith("idle");
  expect(screen.queryByRole("button", { name: "Home" })).toBeNull();
});

it("opens Settings from phones after dismissing navigation", () => {
  overlays.projectsPresentation = "drawer";
  render(panel());

  fireEvent.click(screen.getByRole("button", { name: "Settings" }));

  expect(overlays.close).toHaveBeenCalledWith("projects");
  expect(overlays.open).toHaveBeenCalledWith("settings");
});
