// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../../../src/web/app/App.js";
import type { usePiChat } from "../../../../../src/web/app/use-pi-chat.js";
import { initialAppState } from "../../../../../src/web/app/state/app-state.js";
import { initialChatState, type ChatState } from "../../../../../src/web/app/state/chat-state.js";
import { finishUiTransitions } from "../../../../infra/ui/finish-ui-transitions.js";

vi.mock("../../../../../src/web/app/use-pi-chat.js", () => ({ usePiChat: () => controller }));
let controller: ReturnType<typeof usePiChat>;
let view: ReturnType<typeof render>;
const question = { id: "question", kind: "editor" as const, title: "Explain", prefill: "Start" };
const composer = () => screen.getByRole("textbox", { name: "Message Pi" }) as HTMLTextAreaElement;
const reasoning = () => screen.getByRole("textbox", { name: "Explain" }) as HTMLTextAreaElement;
function redraw() { view.rerender(<MantineProvider><App /></MantineProvider>); }
function update(patch: Partial<ChatState>) {
  controller.state = { ...controller.state, ...patch };
  controller.app = { ...controller.app, sessions: { ...controller.app.sessions, [controller.app.activeSessionId]: controller.state } };
  redraw();
}
function mount() { view = render(<MantineProvider><App /></MantineProvider>); }
function minimize() { fireEvent.click(screen.getByRole("button", { name: /^Minimize$/ })); }
function reopen() { fireEvent.click(screen.getByRole("button", { name: "Reopen" })); }

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  const state = { ...initialChatState, sessionId: "one", status: "running" as const };
  controller = {
    app: { ...initialAppState, serverInstanceId: "server", connection: "open", tabsKnown: true, activeSessionId: "one", sessions: { one: state },
      tabs: [{ sessionId: "one", title: "One", projectPath: "/project", projectName: "project", status: "running" }] },
    state, serverEndpoint: { endpoint: "ws://localhost:3000/ws", override: "", hasStoredOverride: false },
    inboxEnabled: false, setInboxEnabled: vi.fn(), closeView: vi.fn(),
    inbox: { later: [], pending: false, error: undefined, select: vi.fn(async () => {}), park: vi.fn(async () => {}), resume: vi.fn(async () => {}), archive: vi.fn(async () => {}), dismissError: vi.fn() },
    browseDirectories: vi.fn(), startFolderSession: vi.fn(), completeCommandArguments: vi.fn(async () => []),
    openFile: vi.fn(), prompt: vi.fn(), abort: vi.fn(), respondToPrompt: vi.fn().mockResolvedValue(undefined),
    openProject: vi.fn(), openSession: vi.fn(), newSession: vi.fn(), focusTab: vi.fn(), closeTab: vi.fn(),
    archiveSession: vi.fn(), pinProject: vi.fn(), removeProject: vi.fn(), setModel: vi.fn(), compactSession: vi.fn(),
    restartServer: vi.fn(), setThinkingLevel: vi.fn(), runExtensionAction: vi.fn(), dismissError: vi.fn(), takeControl: vi.fn(),
  };
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("pending prompt focus in the real application", () => {
  it("releases the focus trap on minimize and preserves both reasoning and composer drafts", async () => {
    mount();
    fireEvent.change(composer(), { target: { value: "Existing composer draft" } });
    update({ prompts: [question] });
    await finishUiTransitions();
    fireEvent.change(reasoning(), { target: { value: "My explanation\nπ" } });
    minimize();
    await finishUiTransitions();
    expect(screen.queryByRole("dialog")).toBeNull();
    const pending = screen.getByRole("button", { name: "Reopen" });
    expect(document.activeElement).toBe(pending);
    expect(composer().disabled).toBe(true);
    fireEvent.submit(composer().closest("form")!);
    expect(controller.prompt).not.toHaveBeenCalled();
    const settings = screen.getByRole("button", { name: "Settings" });
    settings.focus();
    expect(document.activeElement).toBe(settings);
    reopen();
    await finishUiTransitions();
    expect(reasoning().value).toBe("My explanation\nπ");
    expect(document.activeElement).toBe(reasoning());
    update({ prompts: [] });
    await finishUiTransitions();
    expect(screen.queryByRole("region", { name: "Pending question" })).toBeNull();
    expect(composer().disabled).toBe(false);
    expect(composer().value).toBe("Existing composer draft");
    expect(document.activeElement).toBe(composer());
  });

  it("does not cancel or globally abort on Escape while minimized, but keeps Stop available", async () => {
    mount(); update({ prompts: [question] });
    await finishUiTransitions();
    minimize(); await finishUiTransitions();
    fireEvent.keyDown(document.activeElement!, { key: "Escape", code: "Escape" });
    expect(controller.abort).not.toHaveBeenCalled();
    expect(controller.respondToPrompt).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Stop/ }));
    expect(controller.abort).toHaveBeenCalledExactlyOnceWith();
    update({ prompts: [] });
    await finishUiTransitions();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Reopen" })).toBeNull();
  });

  it("allows reopening for reading during disconnect without allowing an answer", async () => {
    mount(); update({ prompts: [question] });
    await finishUiTransitions();
    fireEvent.change(reasoning(), { target: { value: "Retain offline" } });
    minimize(); await finishUiTransitions();
    controller.app = { ...controller.app, connection: "connecting" }; redraw();
    reopen(); await finishUiTransitions();
    expect(reasoning().value).toBe("Retain offline");
    expect(reasoning().disabled).toBe(true);
    expect((screen.getByRole("button", { name: "OK" }) as HTMLButtonElement).disabled).toBe(true);
    minimize(); await finishUiTransitions();
    controller.app = { ...controller.app, connection: "open" }; redraw();
    reopen(); await finishUiTransitions();
    expect(reasoning().disabled).toBe(false);
    expect(reasoning().value).toBe("Retain offline");
  });

  it("clears expired controls during a minimize transition and sends an empty editor result once", async () => {
    mount(); update({ prompts: [question] });
    await finishUiTransitions();
    fireEvent.change(reasoning(), { target: { value: "" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "OK" }));
      fireEvent.click(screen.getByRole("button", { name: "OK" }));
    });
    expect(controller.respondToPrompt).toHaveBeenCalledExactlyOnceWith("question", { cancelled: false, value: "" }, "one");
    minimize(); update({ prompts: [] });
    expect(screen.queryByRole("dialog")).toBeNull();
    await finishUiTransitions();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("region", { name: "Pending question" })).toBeNull();
  });
});
