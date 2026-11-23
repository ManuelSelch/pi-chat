// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { initialAppState, type AppState } from "../../../../app/stores/app-state.js";
import { initialChatState, type ChatState } from "../../../../app/stores/chat-state.js";
import { RegisteredPlugins } from "../../../../app/plugins/RegisteredPlugins.js";
import { PluginOverlayOutlet } from "../../../../app/plugins/PluginProvider.js";
import { OverlayController, useOverlays } from "../../../../app/overlays/OverlayController.js";
import { ConfirmDialogProvider } from "../../../../components/confirm/ConfirmDialogProvider.js";
import { SessionActionsProvider } from "../stores/SessionActionsProvider.js";
import { SessionDraftProvider } from "../../drafts/stores/SessionDraftProvider.js";
import { ComposerContainer } from "../../../chat/composer/components/ComposerContainer.js";
import { QuickOpenContainer } from "../../quick-open/components/QuickOpenContainer.js";

const chat = vi.hoisted(() => ({
  promptPresentation: { minimized: false, prompt: undefined },
  app: {} as AppState, state: {} as ChatState,
  inbox: { park: vi.fn(), archive: vi.fn(), later: [] as { path: string }[] },
  newSession: vi.fn(), closeTab: vi.fn(), closeView: vi.fn(), restartServer: vi.fn(),
  openSession: vi.fn(), openProject: vi.fn(), prompt: vi.fn(), dismissError: vi.fn(),
  completeCommandArguments: vi.fn(async () => []),
}));
vi.mock("../../../../app/AppControllerContext.js", () => ({ useAppController: () => chat }));
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  chat.app = { ...initialAppState, activeSessionId: "one", tabsKnown: true, connection: "open",
    tabs: [{ sessionId: "one", title: "One", projectPath: "/repo", projectName: "repo", status: "idle" }],
    catalogue: { projects: [{ path: "/repo", displayPath: "~/repo", name: "repo", exists: true, modified: 0, sessionCount: 1, sessions: [{ path: "/sessions/one", id: "one", title: "One", nameSource: "manual", modified: 0, created: 0, messageCount: 1 }] }] },
    appFeatures: [{ id: "app.restart", group: "app", kind: "action", title: "Restart server", state: { label: "Restart" } }],
  };
  chat.state = { ...initialChatState, status: "idle", projectPath: "/repo", sessionPath: "/sessions/one" };
  chat.inbox.later = [];
});
afterEach(cleanup);
function Contents() {
  const overlays = useOverlays();
  return <SessionDraftProvider><SessionActionsProvider>
    <button onClick={() => overlays.open("quickOpen")}>Open palette</button>
    <PluginOverlayOutlet /><QuickOpenContainer /><ComposerContainer widgetsDocked={false} onHeightChange={() => {}} />
    <output>{JSON.stringify(overlays.state)}</output>
  </SessionActionsProvider></SessionDraftProvider>;
}
function mount() {
  return render(<MantineProvider><ConfirmDialogProvider><RegisteredPlugins><OverlayController><Contents /></OverlayController></RegisteredPlugins></ConfirmDialogProvider></MantineProvider>);
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
  it.each(["New session", "Close Session", "Archive Session", "Open folder…", "Settings"])(`${menu}: runs shared %s`, async name => {
    mount();
    await select(menu, name);
    if (name === "New session") expect(chat.newSession).toHaveBeenCalledExactlyOnceWith("/repo");
    if (name === "Close Session") expect(chat.closeView).toHaveBeenCalledOnce();
    if (name === "Archive Session") await waitFor(() => expect(chat.inbox.archive).toHaveBeenCalledExactlyOnceWith("/sessions/one"));
    if (name === "Open folder…") expect(await screen.findByRole("dialog", { name: "Open server folder" })).toBeTruthy();
    if (name === "Settings") expect(screen.getByRole("status").textContent).toContain('"settings":true');
    if (menu === "composer") expect((screen.getByRole("textbox", { name: "Message Pi" }) as HTMLTextAreaElement).value).toBe("");
    else expect(screen.getByRole("status").textContent).toContain('"quickOpen":false');
    expect(chat.prompt).not.toHaveBeenCalled();
  });
  it(`${menu}: uses the header close-view behavior`, async () => {
    mount();
    await select(menu, "Close Session");
    expect(chat.closeView).toHaveBeenCalledOnce();
    expect(chat.closeTab).not.toHaveBeenCalled();
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
}

it("keeps Archive Session listed but disabled when the active session starts running", async () => {
  const view = mount();
  fireEvent.click(screen.getByText("Open palette"));
  fireEvent.click(await screen.findByRole("button", { name: "/ Actions" }));
  expect(screen.getByRole("option", { name: /Action: Archive Session/ })).toBeTruthy();
  chat.state = { ...chat.state, status: "running" };
  view.rerender(<MantineProvider><ConfirmDialogProvider><RegisteredPlugins><OverlayController><Contents /></OverlayController></RegisteredPlugins></ConfirmDialogProvider></MantineProvider>);
  const archive = screen.getByRole("option", { name: /Action: Archive Session/ });
  expect(archive.getAttribute("disabled")).not.toBeNull();
  expect(screen.getByRole("option", { name: /Action: New session/ })).toBeTruthy();
  expect(screen.getByRole("option", { name: /Action: Close Session/ })).toBeTruthy();
});

it("runs Later through inbox.park", async () => {
  mount();
  await select("palette", "Later");
  expect(chat.inbox.park).toHaveBeenCalledExactlyOnceWith("one");
});
