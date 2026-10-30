// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initialAppState, type AppState } from "../../../../../src/web/app/state/app-state.js";
import { initialChatState, type ChatState } from "../../../../../src/web/app/state/chat-state.js";
import { OverlayController, useOverlays } from "../../../../../src/web/app/overlays/OverlayController.js";
import { ConfirmDialogProvider } from "../../../../../src/web/ui/confirm/ConfirmDialogProvider.js";
import { SessionActionsProvider } from "../../../../../src/web/sessions/actions/SessionActionsProvider.js";
import { ComposerContainer } from "../../../../../src/web/chat/composer/ComposerContainer.js";
import { QuickOpenContainer } from "../../../../../src/web/sessions/quick-open/QuickOpenContainer.js";

const chat = vi.hoisted(() => ({
  app: {} as AppState, state: {} as ChatState,
  newSession: vi.fn(), closeTab: vi.fn(), archiveSession: vi.fn(), restartServer: vi.fn(),
  openSession: vi.fn(), openProject: vi.fn(), prompt: vi.fn(), dismissError: vi.fn(),
  completeCommandArguments: vi.fn(async () => []),
}));
vi.mock("../../../../../src/web/app/AppControllerContext.js", () => ({ useAppController: () => chat }));
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  chat.app = { ...initialAppState, activeSessionId: "one", tabsKnown: true, connection: "open",
    tabs: [{ sessionId: "one", title: "One", projectPath: "/repo", projectName: "repo", status: "idle" }],
    appFeatures: [{ id: "app.restart", group: "app", kind: "action", title: "Restart server", state: { label: "Restart" } }],
  };
  chat.state = { ...initialChatState, status: "idle", projectPath: "/repo", sessionPath: "/sessions/one" };
  chat.archiveSession.mockResolvedValue(undefined);
});
afterEach(cleanup);
function Contents() {
  const overlays = useOverlays();
  return <SessionActionsProvider>
    <button onClick={() => overlays.open("quickOpen")}>Open palette</button>
    <QuickOpenContainer /><ComposerContainer widgetsDocked={false} onHeightChange={() => {}} />
    <output>{JSON.stringify(overlays.state)}</output>
  </SessionActionsProvider>;
}
function mount() {
  return render(<MantineProvider><ConfirmDialogProvider><OverlayController><Contents /></OverlayController></ConfirmDialogProvider></MantineProvider>);
}
async function select(menu: "composer" | "palette", name: string) {
  if (menu === "composer") fireEvent.change(screen.getByRole("textbox", { name: "Message Pi" }), { target: { value: "/" } });
  else {
    fireEvent.click(screen.getByText("Open palette"));
    fireEvent.click(await screen.findByRole("button", { name: "/ Actions" }));
  }
  const option = screen.getByRole("option", { name: new RegExp(name) });
  if (menu === "composer") fireEvent.mouseDown(option);
  else fireEvent.click(option);
}
for (const menu of ["composer", "palette"] as const) {
  it.each(["New session", "Close tab", "Archive session", "Open folder…", "Settings"])(`${menu}: runs shared %s`, async name => {
    mount();
    await select(menu, name);
    if (name === "New session") expect(chat.newSession).toHaveBeenCalledExactlyOnceWith("/repo");
    if (name === "Close tab") expect(chat.closeTab).toHaveBeenCalledExactlyOnceWith("one");
    if (name === "Archive session") await waitFor(() => expect(chat.archiveSession).toHaveBeenCalledExactlyOnceWith("/sessions/one", true));
    if (name === "Open folder…") expect(screen.getByRole("status").textContent).toContain('"folderPicker":true');
    if (name === "Settings") expect(screen.getByRole("status").textContent).toContain('"settings":true');
    if (menu === "composer") expect((screen.getByRole("textbox", { name: "Message Pi" }) as HTMLTextAreaElement).value).toBe("");
    else expect(screen.getByRole("status").textContent).toContain('"quickOpen":false');
    expect(chat.prompt).not.toHaveBeenCalled();
  });
  it(`${menu}: excludes Restart server even when the server advertises it`, async () => {
    mount();
    await select(menu, "Settings");
    if (menu === "composer") fireEvent.change(screen.getByRole("textbox", { name: "Message Pi" }), { target: { value: "/" } });
    else {
      fireEvent.click(screen.getByText("Open palette"));
      fireEvent.click(await screen.findByRole("button", { name: "/ Actions" }));
    }
    expect(screen.queryByRole("option", { name: /Restart server/ })).toBeNull();
    expect(chat.restartServer).not.toHaveBeenCalled();
  });
  it(`${menu}: archive failures use the composer error display and dismissal`, async () => {
    chat.archiveSession.mockRejectedValue(new Error("Archive failed"));
    mount(); await select(menu, "Archive session");
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Archive failed");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
}
it("keeps palette archive errors session-scoped across catalogue/state refreshes", async () => {
  chat.archiveSession.mockRejectedValue(new Error("Archive failed"));
  const view = mount();
  await select("palette", "Archive session");
  await screen.findByRole("alert");
  const refresh = () => view.rerender(<MantineProvider><ConfirmDialogProvider><OverlayController><Contents /></OverlayController></ConfirmDialogProvider></MantineProvider>);
  chat.app = { ...chat.app, catalogue: { projects: [] } };
  refresh();
  expect(screen.getByRole("alert").textContent).toBe("Archive failed");
  chat.app = { ...chat.app, activeSessionId: "two" };
  chat.state = { ...chat.state, sessionPath: "/sessions/two" };
  refresh();
  expect(screen.queryByRole("alert")).toBeNull();
  chat.app = { ...chat.app, activeSessionId: "one" };
  refresh();
  expect(screen.getByRole("alert").textContent).toBe("Archive failed");
});

it("refreshes palette availability when the active session starts running", async () => {
  const view = mount();
  fireEvent.click(screen.getByText("Open palette"));
  fireEvent.click(await screen.findByRole("button", { name: "/ Actions" }));
  expect(screen.getByRole("option", { name: /Action: Archive session/ })).toBeTruthy();
  chat.state = { ...chat.state, status: "running" };
  view.rerender(<MantineProvider><ConfirmDialogProvider><OverlayController><Contents /></OverlayController></ConfirmDialogProvider></MantineProvider>);
  expect(screen.queryByRole("option", { name: /Action: Archive session/ })).toBeNull();
  expect(screen.getByRole("option", { name: /Action: New session/ })).toBeTruthy();
  expect(screen.getByRole("option", { name: /Action: Close tab/ })).toBeTruthy();
});
