// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OverlayController, useOverlays } from "../../../../../src/web/app/overlays/OverlayController.js";
import type { Tab } from "../../../../../src/shared/protocol.js";
import { SessionActionsProvider } from "../../../../../src/web/sessions/actions/SessionActionsProvider.js";
import { ConfirmDialogProvider } from "../../../../../src/web/ui/confirm/ConfirmDialogProvider.js";
import { initialChatState } from "../../../../../src/web/app/state/chat-state.js";
import { QuickOpenContainer } from "../../../../../src/web/sessions/quick-open/QuickOpenContainer.js";

const controller = vi.hoisted(() => ({
  app: { activeSessionId: "active", tabs: [] as Tab[], tabsKnown: true, openingTabs: 0, closingSessionIds: [] as string[], connection: "open", appFeatures: [], catalogue: { projects: [] } },
  state: {} as typeof initialChatState, newSession: vi.fn(), openSession: vi.fn(), openProject: vi.fn(),
}));
vi.mock("../../../../../src/web/app/AppControllerContext.js", () => ({ useAppController: () => controller }));
beforeEach(() => {
  controller.app.tabs = [];
  controller.app.activeSessionId = "";
  controller.state = { ...initialChatState, projectPath: "/current" };
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it.each(["home", "session"] as const)("opens via Cmd+O from %s and Escape closes without changing sessions", async (view) => {
  if (view === "session") {
    controller.app.activeSessionId = "one";
    controller.app.tabs = [{ sessionId: "one", title: "One", projectPath: "/current", projectName: "current", status: "idle" }];
  }
  render(<MantineProvider><OverlayController><Harness /></OverlayController></MantineProvider>);
  const event = new KeyboardEvent("keydown", { key: "o", code: "KeyO", metaKey: true, bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  const input = await screen.findByRole("textbox");
  expect(screen.getByRole("status").textContent).toContain('"quickOpen":true');
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.getByRole("status").textContent).toContain('"quickOpen":false');
  expect(controller.newSession).not.toHaveBeenCalled();
  expect(controller.openSession).not.toHaveBeenCalled();
});

function Harness() {
  const overlays = useOverlays();
  return <><button onClick={() => overlays.open("quickOpen")}>Open palette</button><ConfirmDialogProvider><SessionActionsProvider><QuickOpenContainer /></SessionActionsProvider></ConfirmDialogProvider>
    <output>{JSON.stringify(overlays.state)}</output></>;
}
it.each([
  ["Open settings", '"settings":true'], ["Open folder…", '"folderPicker":true'],
] as const)("opens the existing overlay for %s and closes the palette", async (title, state) => {
  render(<MantineProvider><OverlayController><Harness /></OverlayController></MantineProvider>);
  fireEvent.click(screen.getByText("Open palette"));
  fireEvent.click(await screen.findByRole("button", { name: "/ Actions" }));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(`Action: ${title}`) }));
  expect(screen.getByRole("status").textContent).toContain(state);
  expect(screen.getByRole("status").textContent).toContain('"quickOpen":false');
});
it("starts a new session in the current project through the application controller", async () => {
  controller.app.activeSessionId = "one";
  controller.app.tabs = [{ sessionId: "one", title: "One", projectPath: "/current", projectName: "current", status: "idle" }];
  render(<MantineProvider><OverlayController><Harness /></OverlayController></MantineProvider>);
  fireEvent.click(screen.getByText("Open palette"));
  fireEvent.click(await screen.findByRole("button", { name: "/ Actions" }));
  fireEvent.click(screen.getByRole("option", { name: /Action: New session/ }));
  expect(controller.newSession).toHaveBeenCalledWith("/current");
});
