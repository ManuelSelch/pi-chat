// @vitest-environment jsdom
import { AppShell, MantineProvider } from "@mantine/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { snapshotEvent } from "../../../../infra/v2-fixtures.js";
import { initialAppState } from "../../../../../src/web/app/state/app-state.js";
import { initialChatState, reduceServerMessage } from "../../../../infra/pi-chat/browser-session-view.js";
import { HeaderContainer } from "../../../../../src/web/app/shell/HeaderContainer.js";

const chat = { app: { ...initialAppState }, state: initialChatState };
vi.mock("../../../../../src/web/app/AppControllerContext.js", () => ({ useAppController: () => chat }));
vi.mock("../../../../../src/web/app/overlays/OverlayController.js", () => ({ useOverlays: () => ({ state: { projects: false }, toggle: vi.fn() }) }));
afterEach(cleanup);

function snapshot(name: string | undefined, sequence: number, isStreaming = false) {
  const message = snapshotEvent({ sessionId: "s1", sessionName: name, throughSequence: sequence, projectPath: "/project", runtime: { status: isStreaming ? "running" : "idle" } });
  chat.state = reduceServerMessage(chat.state, message);
}

function header() {
  return <MantineProvider><AppShell><HeaderContainer /></AppShell></MantineProvider>;
}

it("omits the title label at home instead of showing a placeholder", () => {
  chat.app = { ...initialAppState, tabsKnown: true };
  chat.state = initialChatState;
  render(header());
  expect(screen.queryByText("No session open")).toBeNull();
  expect(screen.getByRole("button", { name: "Projects and sessions" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
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
