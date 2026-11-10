// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initialAppState, type AppState } from "../../../../../../../src/web/app/state/app-state.js";
import { InboxContainer } from "../../../../../../../src/web/sessions/inbox/ui/containers/InboxContainer.js";

const chat = { app: initialAppState as AppState, inbox: { later: [], pending: false }, focusTab: vi.fn() };
vi.mock("../../../../../../../src/web/app/AppControllerContext.js", () => ({ useAppController: () => chat }));
vi.mock("../../../../../../../src/web/app/overlays/OverlayController.js", () => ({ useOverlays: () => ({
  open: vi.fn(), close: vi.fn(), state: { projects: true }, projectsPresentation: "sidebar",
}) }));

function setStatuses(...statuses: ("running" | "idle" | "blocked")[]) {
  chat.app = { ...chat.app, tabs: statuses.map((status, index) => ({
    sessionId: `session-${index}`, title: `Session ${index}`, projectName: "Project", projectPath: "/project", status,
  })) };
}
const panel = () => <MantineProvider><InboxContainer /></MantineProvider>;
const toggle = () => screen.getByRole("button", { name: /^Working/ });
beforeEach(() => { chat.app = { ...initialAppState, connection: "open" }; });
afterEach(cleanup);

it("starts collapsed with running sessions and supports manual expansion and collapse", () => {
  setStatuses("running");

  render(panel());

  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  expect(toggle().textContent).toBe("Working1");
  expect(screen.queryByRole("button", { name: "Open Session 0" })).toBeNull();

  fireEvent.click(toggle());

  expect(screen.getByRole("button", { name: "Open Session 0" })).toBeTruthy();

  fireEvent.click(toggle());

  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("button", { name: "Open Session 0" })).toBeNull();
});

it("collapses the first working session that arrives after an empty section", () => {
  const view = render(panel());
  expect(screen.queryByRole("button", { name: /^Working/ })).toBeNull();

  setStatuses("running");
  view.rerender(panel());

  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("button", { name: "Open Session 0" })).toBeNull();
});

it("resets expansion when the last working session leaves, without hiding Ready or Needs you", () => {
  setStatuses("running", "blocked");
  const view = render(panel());
  fireEvent.click(toggle());

  setStatuses("idle", "blocked");
  view.rerender(panel());

  expect(screen.queryByRole("button", { name: /^Working/ })).toBeNull();
  expect(screen.getByRole("button", { name: "Open Session 0" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open Session 1" })).toBeTruthy();

  setStatuses("running", "blocked");
  view.rerender(panel());

  expect(toggle().getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("button", { name: "Open Session 0" })).toBeNull();
});

it("keeps expansion while working sessions join or leave a nonempty section", () => {
  setStatuses("running");
  const view = render(panel());
  fireEvent.click(toggle());

  setStatuses("running", "running");
  view.rerender(panel());

  expect(toggle().getAttribute("aria-expanded")).toBe("true");
  expect(toggle().textContent).toBe("Working2");
  expect(screen.getByRole("button", { name: "Open Session 1" })).toBeTruthy();

  setStatuses("idle", "running");
  view.rerender(panel());

  expect(toggle().getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("button", { name: "Open Session 1" })).toBeTruthy();
});

it("starts collapsed again on a fresh mount rather than persisting expansion", () => {
  setStatuses("running");
  const view = render(panel());
  fireEvent.click(toggle());
  view.unmount();

  render(panel());

  expect(toggle().getAttribute("aria-expanded")).toBe("false");
});
