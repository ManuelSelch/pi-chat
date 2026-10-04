// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerContainer } from "../src/web/chat/composer/ComposerContainer.js";
import { initialChatState } from "../src/web/app/state/chat-state.js";
import type { CommandCompletionItem } from "../src/shared/protocol.js";

const chat = {
  app: { activeSessionId: "s1", tabs: [{ sessionId: "s1" }], tabsKnown: true, openingTabs: 0, closingSessionIds: [], connection: "open", appFeatures: [] },
  state: { ...initialChatState, status: "idle" as const, actions: { features: [], commands: [{ name: "deploy", source: "extension" }] } },
  completeCommandArguments: vi.fn<(session: string, name: string, prefix: string, signal?: AbortSignal) => Promise<CommandCompletionItem[]>>(),
  prompt: vi.fn(),
};
vi.mock("../src/web/app/AppControllerContext.js", () => ({ useAppController: () => chat }));
vi.mock("../src/web/ui/confirm/ConfirmDialogProvider.js", () => ({ useConfirmDialog: () => ({ confirm: vi.fn() }) }));
vi.mock("../src/web/app/overlays/OverlayController.js", () => ({ useOverlays: () => ({ anyOpen: false }) }));

function mount() {
  return render(<MantineProvider><ComposerContainer onHeightChange={() => {}} /></MantineProvider>);
}
function type(input: string, caret = input.length) {
  const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value: input, selectionStart: caret, selectionEnd: caret } });
  return textarea;
}
beforeEach(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  chat.app.activeSessionId = "s1";
  chat.app.connection = "open";
  vi.clearAllMocks();
  chat.completeCommandArguments.mockResolvedValue([{ value: "staging", label: "Staging", description: "Test environment" }]);
});
afterEach(cleanup);

describe("composer argument completion", () => {
  it("shows Pi items and inserts without executing, preserving the suffix and caret", async () => {
    mount();
    const textarea = type("/deploy st --flag", 10);
    await screen.findByRole("option", { name: /Staging/ });
    expect(chat.completeCommandArguments).toHaveBeenCalledWith("s1", "deploy", "st", expect.any(AbortSignal));
    fireEvent.keyDown(textarea, { key: "Tab" });
    expect(textarea.value).toBe("/deploy staging --flag");
    expect(textarea.selectionStart).toBe(15);
    expect(chat.prompt).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("requests an empty prefix after command selection and keeps focus on pointer acceptance", async () => {
    mount();
    const textarea = type("/dep");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("/deploy ");
    const item = await screen.findByRole("option", { name: /Staging/ });
    expect(chat.completeCommandArguments).toHaveBeenCalledWith("s1", "deploy", "", expect.any(AbortSignal));
    fireEvent.mouseDown(item);
    expect(textarea.value).toBe("/deploy staging");
    expect(document.activeElement).toBe(textarea);
  });

  it("ignores a delayed reply after Escape, and handles failure without a chat error", async () => {
    let reply!: (items: CommandCompletionItem[]) => void;
    chat.completeCommandArguments.mockImplementationOnce(() => new Promise((resolve) => { reply = resolve; }));
    mount();
    const textarea = type("/deploy st");
    await waitFor(() => expect(chat.completeCommandArguments).toHaveBeenCalledOnce());
    fireEvent.keyDown(textarea, { key: "Escape" });
    await act(async () => reply([{ value: "staging", label: "Late" }]));
    expect(screen.queryByRole("option")).toBeNull();
    chat.completeCommandArguments.mockRejectedValueOnce(new Error("Unavailable"));
    type("/deploy pr");
    await waitFor(() => expect(chat.completeCommandArguments).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(textarea.value).toBe("/deploy pr");
  });

  it("ignores reordered replies after editing and keeps suggestions across snapshots", async () => {
    let oldReply!: (items: CommandCompletionItem[]) => void;
    chat.completeCommandArguments.mockImplementationOnce(() => new Promise((resolve) => { oldReply = resolve; }));
    const view = mount();
    const textarea = type("/deploy st");
    await waitFor(() => expect(chat.completeCommandArguments).toHaveBeenCalledOnce());
    type("/deploy pr");
    await screen.findByRole("option", { name: /Staging/ });
    await act(async () => oldReply([{ value: "old", label: "Old result" }]));
    expect(screen.queryByRole("option", { name: /Old result/ })).toBeNull();
    chat.state = { ...chat.state };
    view.rerender(<MantineProvider><ComposerContainer onHeightChange={() => {}} /></MantineProvider>);
    expect(screen.getByRole("option", { name: /Staging/ })).toBeTruthy();
    expect(chat.completeCommandArguments).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("/deploy staging");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(chat.prompt).toHaveBeenCalledWith("/deploy staging");
  });

  it("navigates provider order with arrows and accepts the highlighted value", async () => {
    chat.completeCommandArguments.mockResolvedValue([{ value: "prod", label: "Production" }, { value: "dev", label: "Development" }]);
    mount();
    const textarea = type("/deploy ");
    await screen.findByRole("option", { name: "Development" });
    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    fireEvent.keyUp(textarea, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: "Development" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("/deploy dev");
  });

  it("keeps Shift+Enter, Shift+Tab and IME input out of completion acceptance", async () => {
    mount();
    const textarea = type("/deploy st");
    await screen.findByRole("option");
    expect(fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(textarea, { key: "Tab", shiftKey: true })).toBe(true);
    expect(fireEvent.keyDown(textarea, { key: "Enter", isComposing: true })).toBe(true);
    expect(textarea.value).toBe("/deploy st");
    expect(chat.prompt).not.toHaveBeenCalled();
  });

  it("drops results on tab switch and disconnect, and reevaluates caret movement", async () => {
    const view = mount();
    const textarea = type("/deploy st");
    await screen.findByRole("option");
    textarea.setSelectionRange(8, 8);
    fireEvent.keyUp(textarea, { key: "ArrowLeft" });
    await waitFor(() => expect(chat.completeCommandArguments).toHaveBeenLastCalledWith("s1", "deploy", "", expect.any(AbortSignal)));
    chat.app.activeSessionId = "s2";
    view.rerender(<MantineProvider><ComposerContainer onHeightChange={() => {}} /></MantineProvider>);
    expect(screen.queryByRole("listbox")).toBeNull();
    type("/deploy pr");
    await screen.findByRole("option");
    chat.app.connection = "connecting";
    view.rerender(<MantineProvider><ComposerContainer onHeightChange={() => {}} /></MantineProvider>);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
