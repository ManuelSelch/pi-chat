// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../../src/web/app/App.js";
import type { AppController } from "../../../../src/web/app/AppControllerContext.js";
import { initialAppState } from "../../../../src/web/app/state/app-state.js";
import { initialChatState, type ChatState } from "../../../../src/web/app/state/chat-state.js";
import { finishUiTransitions as finishTransitions } from "../../../infra/ui/finish-ui-transitions.js";

// Only the transport/controller boundary is replaced. App, providers, composer,
// dialogs, drawers, portals and Mantine focus/transition behavior are real.
vi.mock("../../../../src/web/app/use-pi-chat.js", () => ({ usePiChat: () => controller }));
let controller: Omit<AppController, "promptPresentation">;
let view: ReturnType<typeof render>;
const session = (id = "s1"): ChatState => ({ ...initialChatState, sessionId: id, projectPath: "/project", status: "idle" });
const tab = (id = "s1", status: "idle" | "running" = "idle") => ({ sessionId: id, title: id, projectPath: "/project", projectName: "project", status });
const composer = () => screen.getByRole("textbox", { name: "Message Pi" }) as HTMLTextAreaElement;
const dialog = (name: string) => screen.getByRole("dialog", { name });
function redraw() { view.rerender(<MantineProvider><App /></MantineProvider>); }
function update(state: Partial<ChatState>) {
  controller.state = { ...controller.state, ...state };
  controller.app = { ...controller.app, sessions: { ...controller.app.sessions, [controller.app.activeSessionId]: controller.state } };
  redraw();
}
function click(element: HTMLElement) { element.focus(); fireEvent.click(element); }
function escape() { fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape", code: "Escape", bubbles: true }); }
function expectDialogFocus(name: string) { expect(dialog(name).contains(document.activeElement)).toBe(true); }
function mount() { view = render(<MantineProvider><App /></MantineProvider>); }
async function finishBatchedExit(beforeCommit?: () => void) {
  // Deliberately batch the exit and any post-exit frame before React commits.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
    beforeCommit?.();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  controller = {
    app: { ...initialAppState, connection: "open", tabsKnown: true, activeSessionId: "s1", tabs: [tab()], sessions: { s1: session() },
      appFeatures: [{ id: "app.restart", group: "app", kind: "action", title: "Restart server", state: { label: "Restart" } }] },
    state: session(),
    serverEndpoint: { endpoint: "ws://localhost:3000/ws", override: "", hasStoredOverride: false },
    inboxEnabled: false, setInboxEnabled: vi.fn(), closeView: vi.fn(),
    inbox: { later: [], pending: false, error: undefined, canUndo: false, select: vi.fn(async () => {}), park: vi.fn(async () => {}), resume: vi.fn(async () => {}), archive: vi.fn(async () => {}), undo: vi.fn(async () => {}), dismissError: vi.fn() },
    browseDirectories: vi.fn(async () => ({ path: "/project", parentPath: "/", breadcrumbs: [{ name: "project", path: "/project" }], entries: [] })),
    startFolderSession: vi.fn(async () => "s2"), completeCommandArguments: vi.fn(async () => []),
    openFile: vi.fn(), prompt: vi.fn(), abort: vi.fn(), respondToPrompt: vi.fn(),
    openProject: vi.fn(), openSession: vi.fn(), newSession: vi.fn(), focusTab: vi.fn(), closeTab: vi.fn(),
    archiveSession: vi.fn(async () => {}), pinProject: vi.fn(async () => {}), removeProject: vi.fn(async () => {}),
    setModel: vi.fn(), compactSession: vi.fn(), restartServer: vi.fn(), setThinkingLevel: vi.fn(),
    runExtensionAction: vi.fn(), dismissError: vi.fn(), takeControl: vi.fn(),
  };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

function mountDesktop() {
  const matchMedia = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({
    ...matchMedia(query), matches: query === "(min-width: 640px)",
  }));
  mount();
}
function openProjects() { click(screen.getByRole("button", { name: "Projects and sessions" })); }
function projects() { return screen.getByRole("navigation", { name: "Projects" }); }

describe("desktop projects sidebar focus", () => {
  it("keeps typing usable with projects open and preserves the draft", () => {
    mountDesktop();
    fireEvent.change(composer(), { target: { value: "Existing draft" } });

    openProjects();

    expect(projects()).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(composer());
    expect(composer().value).toBe("Existing draft");
    fireEvent.keyDown(composer(), { key: "Enter" });
    expect(controller.prompt).toHaveBeenCalledWith("Existing draft");
    expect(projects()).toBeTruthy();
  });

  it("toggles from the header and returns focus after closing inside the sidebar", () => {
    mountDesktop();
    openProjects();
    openProjects();
    expect(screen.queryByRole("navigation", { name: "Projects" })).toBeNull();

    openProjects();
    click(within(projects()).getByRole("button", { name: "Close projects" }));
    expect(document.activeElement).toBe(composer());
  });

  it("closes on sidebar Escape without aborting, but allows composer Escape to abort", () => {
    mountDesktop();
    update({ status: "running" });
    openProjects();
    within(projects()).getByRole("button", { name: "Open folder" }).focus();

    escape();

    expect(controller.abort).not.toHaveBeenCalled();
    expect(screen.queryByRole("navigation", { name: "Projects" })).toBeNull();
    expect(document.activeElement).toBe(composer());
    escape();
    expect(controller.abort).toHaveBeenCalledOnce();
  });

  it("keeps navigation focus across background updates and gives a real modal ownership", async () => {
    mountDesktop();
    openProjects();
    const folder = within(projects()).getByRole("button", { name: "Open folder" });
    folder.focus();

    update({ status: "running", steeringMessages: ["Keep working"] });
    expect(document.activeElement).toBe(folder);

    click(screen.getByRole("button", { name: "Settings" }));
    await finishTransitions();
    expectDialogFocus("Settings");
    expect(projects()).toBeTruthy();
    escape();
    await finishTransitions();
    expect(document.activeElement).toBe(composer());
    expect(projects()).toBeTruthy();
    expect(controller.abort).not.toHaveBeenCalled();
  });

  it("keeps command completion usable while the sidebar is open", () => {
    mountDesktop();
    openProjects();

    fireEvent.change(composer(), { target: { value: "/" } });

    expect(screen.getByRole("listbox", { name: "Commands" })).toBeTruthy();
    expect(projects()).toBeTruthy();
    escape();
    expect(screen.queryByRole("listbox", { name: "Commands" })).toBeNull();
    expect(projects()).toBeTruthy();
    expect(controller.abort).not.toHaveBeenCalled();
  });

  it("does not steal resized navigation focus when the phone modal becomes a sidebar", async () => {
    let desktop = false;
    let change: ((event: MediaQueryListEvent) => void) | undefined;
    const matchMedia = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation(query => query === "(min-width: 640px)" ? {
      ...matchMedia(query), matches: desktop,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { change = listener; },
      removeEventListener: vi.fn(),
    } as MediaQueryList : matchMedia(query));
    mount();
    openProjects();
    await finishTransitions();
    expectDialogFocus("Projects");

    act(() => { desktop = true; change?.({ matches: true } as MediaQueryListEvent); });
    await finishTransitions();

    expect(projects().contains(document.activeElement)).toBe(true);
    expect(screen.queryByRole("dialog", { name: "Projects" })).toBeNull();
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
    click(within(projects()).getByRole("button", { name: "Close projects" }));
    expect(document.activeElement).toBe(composer());
  });

  it("returns focus to the header when closing navigation at Home", () => {
    controller.app.activeSessionId = "";
    controller.app.tabs = [];
    controller.state = initialChatState;
    mountDesktop();
    openProjects();

    click(within(projects()).getByRole("button", { name: "Close projects" }));

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Projects and sessions" }));
  });
});

describe("composer focus across real app overlays", () => {
  it.each([["Settings", "Settings"], ["Projects and sessions", "Projects"]])("restores composer focus after closing %s from its header button", async (button, name) => {
    mount();
    click(screen.getByRole("button", { name: button }));
    await finishTransitions();
    expectDialogFocus(name);
    escape();
    // The overlay has logically closed, but its exit has not finished yet.
    expect(document.activeElement).not.toBe(composer());
    await finishTransitions();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(composer());
  });

  it.each([["Settings", "Settings"], ["Projects and sessions", "Projects"]])("restores focus after %s exits even when React commits after the animation-frame window", async (button, name) => {
    mount();
    click(screen.getByRole("button", { name: button }));
    await finishTransitions();
    expectDialogFocus(name);
    escape();
    // Focus must be restored by the commit, without another frame or click.
    await finishBatchedExit();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(composer());
  });

  it("does not restore an old exit when Settings reopens before the exit commit", async () => {
    mount();
    const settings = screen.getByRole("button", { name: "Settings" });
    click(settings);
    await finishTransitions();
    const focus = vi.spyOn(composer(), "focus");
    escape();
    await finishBatchedExit(() => click(settings));
    expect(focus).not.toHaveBeenCalled();
    await finishTransitions();
    expectDialogFocus("Settings");
    escape();
    await finishTransitions();
    expect(document.activeElement).toBe(composer());
  });

  it("preserves a newer prompt's ownership when the Settings exit commits", async () => {
    mount();
    click(screen.getByRole("button", { name: "Settings" }));
    await finishTransitions();
    const focus = vi.spyOn(composer(), "focus");
    escape();
    update({ prompts: [{ id: "newer", kind: "input", title: "Newer question" }] });
    expect(dialog("Newer question")).toBeTruthy();
    await finishBatchedExit();
    expect(focus).not.toHaveBeenCalled();
    await finishTransitions();
    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
    expectDialogFocus("Newer question");
    update({ prompts: [] });
    await finishTransitions();
    expect(document.activeElement).toBe(composer());
  });

  it("does not replay a consumed exit on background updates or the next close", async () => {
    mount();
    const settings = screen.getByRole("button", { name: "Settings" });
    click(settings);
    await finishTransitions();
    escape();
    await finishBatchedExit();
    expect(document.activeElement).toBe(composer());
    settings.focus();
    update({ status: "running", steeringMessages: ["Keep working"] });
    await finishTransitions();
    expect(document.activeElement).toBe(settings);
    click(settings);
    await finishTransitions();
    escape();
    expect(document.activeElement).not.toBe(composer());
    await finishBatchedExit();
    expect(document.activeElement).toBe(composer());
  });

  it("waits for a closing drawer when session loading finishes", async () => {
    controller.app.openingTabs = 1;
    mount();
    expect(composer().disabled).toBe(true);
    click(screen.getByRole("button", { name: "Settings" }));
    await finishTransitions();
    controller.app.openingTabs = 0;
    update({});
    expect(composer().disabled).toBe(false);
    expectDialogFocus("Settings");
    escape();
    await finishTransitions();
    expect(document.activeElement).toBe(composer());
  });

  it("keeps focus in the folder picker after the older projects drawer exits", async () => {
    mount();
    click(screen.getByRole("button", { name: "Projects and sessions" }));
    await finishTransitions();
    click(within(dialog("Projects")).getByRole("button", { name: "Open folder" }));
    await finishTransitions();
    expect(screen.queryByRole("dialog", { name: "Projects" })).toBeNull();
    expectDialogFocus("Open server folder");
    click(within(dialog("Open server folder")).getByRole("button", { name: "Cancel" }));
    await finishTransitions();
    expect(document.activeElement).toBe(composer());
  });

  it("restores the composer after cancelling quick open launched from a toolbar control", async () => {
    mount();
    screen.getByRole("button", { name: "Settings" }).focus();
    fireEvent.keyDown(document.activeElement!, { key: "o", code: "KeyO", metaKey: true, bubbles: true });
    await finishTransitions();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Search folders, worktrees, sessions and actions" }));
    escape();
    await finishTransitions();
    expect(document.activeElement).toBe(composer());
  });

  it.each(["Cancel", "Restart"])("keeps nested confirmation ownership on %s and restores only after the drawer closes", async action => {
    mount();
    click(screen.getByRole("button", { name: "Settings" }));
    await finishTransitions();
    click(within(dialog("Settings")).getByRole("button", { name: "Restart" }));
    await finishTransitions();
    expectDialogFocus("Restart server?");
    click(within(dialog("Restart server?")).getByRole("button", { name: action }));
    await finishTransitions();
    expect(controller.restartServer).toHaveBeenCalledTimes(action === "Restart" ? 1 : 0);
    expectDialogFocus("Settings");
    escape();
    await finishTransitions();
    expect(document.activeElement).toBe(composer());
  });

  it("does not focus the composer during prompt handover, then restores after the final prompt", async () => {
    mount();
    screen.getByRole("button", { name: "Settings" }).focus();
    update({ prompts: [{ id: "first", kind: "input", title: "First question" }] });
    await finishTransitions();
    expectDialogFocus("First question");
    update({ prompts: [] });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expectDialogFocus("First question");
    update({ prompts: [{ id: "second", kind: "input", title: "Second question" }] });
    await finishTransitions();
    expectDialogFocus("Second question");
    update({ prompts: [] });
    await finishTransitions();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(composer());
  });

  it("keeps an extension prompt focused when the active session changes", async () => {
    mount();
    update({ prompts: [{ id: "question", kind: "input", title: "Question" }] });
    await finishTransitions();
    controller.app.activeSessionId = "s2";
    controller.app.tabs = [tab(), tab("s2")];
    update({ sessionId: "s2" });
    expect(composer().disabled).toBe(true);
    expect(document.activeElement).not.toBe(composer());
    await finishTransitions();
    expectDialogFocus("Question");
  });

  it("switches ready sessions without losing per-session drafts", () => {
    mount();
    fireEvent.change(composer(), { target: { value: "First draft" } });
    const settings = screen.getByRole("button", { name: "Settings" });
    settings.focus();
    controller.app.activeSessionId = "s2";
    controller.app.tabs = [tab(), tab("s2")];
    update({ sessionId: "s2" });
    expect(document.activeElement).toBe(composer());
    expect(composer().value).toBe("");
    fireEvent.change(composer(), { target: { value: "Second draft" } });
    controller.app.activeSessionId = "s1";
    update({ sessionId: "s1" });
    expect(composer().value).toBe("First draft");
    expect(document.activeElement).toBe(composer());
  });

  it("restores the existing draft and focus when opening another session fails", async () => {
    mount();
    fireEvent.change(composer(), { target: { value: "Keep the existing draft" } });
    controller.app.openingTabs = 1;
    redraw();
    expect(composer().disabled).toBe(true);
    controller.app.openingTabs = 0;
    controller.app.error = "Session opening failed";
    redraw();
    await finishTransitions();
    expect(composer().disabled).toBe(false);
    expect(composer().value).toBe("Keep the existing draft");
    expect(document.activeElement).toBe(composer());
  });

  it("does not steal deliberate toolbar focus on background status or queue updates", async () => {
    mount();
    const settings = screen.getByRole("button", { name: "Settings" });
    settings.focus();
    update({ status: "running", steeringMessages: ["Keep working"] });
    await finishTransitions();
    expect(document.activeElement).toBe(settings);
  });

  it("preserves composer caret and selection across background updates", async () => {
    mount();
    fireEvent.change(composer(), { target: { value: "Keep this selection" } });
    composer().setSelectionRange(5, 9);
    update({ status: "running", steeringMessages: ["Keep working"] });
    await finishTransitions();
    expect(document.activeElement).toBe(composer());
    expect([composer().selectionStart, composer().selectionEnd]).toEqual([5, 9]);
  });

  it("restores steering focus after cancelling a running-session close", async () => {
    controller.app.tabs = [tab("s1", "running")];
    controller.state = { ...controller.state, status: "running" };
    mount();
    click(screen.getByRole("button", { name: "Close s1" }));
    await finishTransitions();
    expectDialogFocus("Close running session?");
    click(within(dialog("Close running session?")).getByRole("button", { name: "Keep open" }));
    await finishTransitions();
    expect(controller.closeTab).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(composer());
  });

  it("restores the remaining session after confirming a running-session close", async () => {
    controller.app.tabs = [tab("s2"), tab("s1", "running")];
    controller.state = { ...controller.state, status: "running" };
    mount();
    click(screen.getByRole("button", { name: "Close s1" }));
    await finishTransitions();
    click(within(dialog("Close running session?")).getByRole("button", { name: "Stop and close" }));
    expect(controller.closeTab).toHaveBeenCalledWith("s1");
    // The authoritative tab reply arrives while the dialog is exiting.
    controller.app.activeSessionId = "s2";
    controller.app.tabs = [tab("s2")];
    update({ sessionId: "s2", status: "idle" });
    await finishTransitions();
    expect(document.activeElement).toBe(composer());
  });

  it("returns Home without attempting to refocus an unmounted composer", async () => {
    mount();
    controller.app.activeSessionId = "";
    controller.app.tabs = [];
    controller.app.sessions = {};
    controller.state = initialChatState;
    redraw();
    await finishTransitions();
    expect(screen.queryByRole("textbox", { name: "Message Pi" })).toBeNull();
    expect((document.activeElement as HTMLElement | null)?.getAttribute("aria-label")).not.toBe("Message Pi");
  });
});
