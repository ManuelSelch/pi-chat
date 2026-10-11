// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OverlayController, useOverlays } from "../../../../../src/web/app/overlays/OverlayController.js";
import { QuickOpenContainer } from "../../../../../src/web/sessions/quick-open/QuickOpenContainer.js";

const controller = vi.hoisted(() => ({
  app: { activeSessionId: "active", tabs: [], catalogue: { projects: [] } },
  state: { projectPath: "/current" }, newSession: vi.fn(), openSession: vi.fn(), openProject: vi.fn(),
}));
vi.mock("../../../../../src/web/app/AppControllerContext.js", () => ({ useAppController: () => controller }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function Harness() {
  const overlays = useOverlays();
  return <><button onClick={() => overlays.open("quickOpen")}>Open palette</button><QuickOpenContainer />
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
  render(<MantineProvider><OverlayController><Harness /></OverlayController></MantineProvider>);
  fireEvent.click(screen.getByText("Open palette"));
  fireEvent.click(await screen.findByRole("button", { name: "/ Actions" }));
  fireEvent.click(screen.getByRole("option", { name: /Action: New session/ }));
  expect(controller.newSession).toHaveBeenCalledWith("/current");
});
