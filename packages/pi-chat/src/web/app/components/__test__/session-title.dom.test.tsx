// @vitest-environment jsdom
import { AppShell, MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { snapshotEvent } from "../../../../../testing/infra/v2-fixtures.js";
import { initialAppState } from "../../stores/app-state.js";
import { initialChatState, reduceServerMessage } from "../../../../../testing/infra/pi-chat/browser-session-view.js";
import { HeaderContainer } from "../HeaderContainer.js";

const chat = { app: { ...initialAppState }, state: initialChatState, inbox: { pending: false } };
vi.mock("../../AppControllerContext.js", () => ({ useAppController: () => chat }));
vi.mock("../../overlays/OverlayController.js", () => ({ useOverlays: () => ({ state: { projects: false }, toggle: vi.fn() }) }));
afterEach(cleanup);

function snapshot(name: string | undefined, sequence: number, isStreaming = false) {
  const message = snapshotEvent({ sessionId: "s1", sessionName: name, throughSequence: sequence, projectPath: "/project", runtime: { status: isStreaming ? "running" : "idle" } });
  chat.state = reduceServerMessage(chat.state, message);
  chat.app = { ...chat.app, tabsKnown: true, activeSessionId: "s1", tabs: [{ sessionId: "s1", title: name ?? "New session", projectPath: "/project", projectName: "project", status: isStreaming ? "running" : "idle" }] };
}

function header() {
  return <MantineProvider><AppShell><HeaderContainer /></AppShell></MantineProvider>;
}

it("omits the title label at home instead of showing a placeholder", () => {
  chat.app = { ...initialAppState, tabsKnown: true };
  chat.state = initialChatState;
  render(header());
  expect(screen.queryByText("No session open")).toBeNull();
  expect(screen.getByRole("button", { name: "Sessions" })).toBeTruthy();
});

it("shows Pi's session title, refreshes it while running, and clears it on a later snapshot", () => {
  chat.app = { ...initialAppState, tabsKnown: false };
  chat.state = initialChatState;
  snapshot("Original title", 0);
  expect(chat.state).toHaveProperty("sessionName", "Original title");
  expect(chat.state.actions.features.map((feature) => feature.id)).not.toContain("session.rename");
  const view = render(header());
  expect(screen.getByText("Original title").textContent).toBe("Original title");
  expect(screen.queryByTestId("status")).toBeNull();
  snapshot("Generated title", 1, true);
  view.rerender(header());
  expect(screen.getByText("Generated title").textContent).toBe("Generated title");
  expect(screen.queryByText("Original title")).toBeNull();
  expect(screen.queryByTestId("status")).toBeNull();
  snapshot(undefined, 2);
  view.rerender(header());
  expect(screen.getByText("New session").textContent).toBe("New session");
  expect(screen.queryByText("Generated title")).toBeNull();
});
