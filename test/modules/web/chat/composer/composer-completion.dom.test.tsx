// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionDraftProvider } from "../../../../../src/web/sessions/drafts/app/SessionDraftProvider.js";
import { SessionActionsProvider } from "../../../../../src/web/sessions/actions/SessionActionsProvider.js";
import { ComposerContainer as ActualComposerContainer } from "../../../../../src/web/chat/composer/ComposerContainer.js";
import { initialChatState } from "../../../../../src/web/app/state/chat-state.js";
import type { CommandCompletionItem } from "../../../../../src/shared/protocol.js";

const chat = {
  promptPresentation: { minimized: false, prompt: undefined },
  app: { activeSessionId: "s1", tabs: [{ sessionId: "s1" }], tabsKnown: true, openingTabs: 0, closingSessionIds: [], connection: "open", appFeatures: [] },
  state: { ...initialChatState, sessionName: undefined as string | undefined, sessionPath: undefined as string | undefined, status: "idle" as typeof initialChatState.status, actions: { features: [], commands: [{ name: "deploy", source: "extension" }] } },
  completeCommandArguments: vi.fn<(session: string, name: string, prefix: string, signal?: AbortSignal) => Promise<CommandCompletionItem[]>>(),
  prompt: vi.fn(),
  archiveSession: vi.fn().mockResolvedValue(undefined),
};
vi.mock("../../../../../src/web/app/AppControllerContext.js", () => ({ useAppController: () => chat }));
const confirm = vi.fn();
vi.mock("../../../../../src/web/ui/confirm/ConfirmDialogProvider.js", () => ({ useConfirmDialog: () => ({ confirm }) }));
vi.mock("../../../../../src/web/app/overlays/OverlayController.js", () => ({ useOverlays: () => ({ anyOpen: false }) }));

function ComposerContainer(props: { onHeightChange: (height: number) => void; widgetsDocked: boolean }) {
  return <SessionDraftProvider><SessionActionsProvider><ActualComposerContainer {...props} /></SessionActionsProvider></SessionDraftProvider>;
}
function mount() {
  return render(<MantineProvider><ComposerContainer widgetsDocked={false} onHeightChange={() => {}} /></MantineProvider>);
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
  chat.state.sessionName = undefined;
  chat.state.sessionPath = undefined;
  chat.state.status = "idle";
  chat.archiveSession.mockResolvedValue(undefined);
  confirm.mockResolvedValue(false);
  chat.completeCommandArguments.mockResolvedValue([{ value: "staging", label: "Staging", description: "Test environment" }]);
});
afterEach(cleanup);

describe("composer session actions", () => {
  it("offers /archive instead of deletion and preserves the transcript without confirmation", async () => {
    chat.state.sessionName = "Pi-generated title";
    chat.state.sessionPath = "/sessions/s1.jsonl";
    mount();
    const textarea = type("/");
    expect(screen.queryByRole("option", { name: /Rename session/ })).toBeNull();
    expect(screen.getByRole("option", { name: /New session/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Close tab/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Delete session/ })).toBeNull();
    type("/archive");
    fireEvent.keyDown(textarea, { key: "Enter" });
    await waitFor(() => expect(chat.archiveSession).toHaveBeenCalledWith("/sessions/s1.jsonl", true));
    expect(confirm).not.toHaveBeenCalled();
    expect(chat.prompt).not.toHaveBeenCalled();
    expect(textarea.value).toBe("");
  });

  it("handles an exact /archive submission after dismissing completion", async () => {
    chat.state.sessionPath = "/sessions/s1.jsonl";
    mount();
    const textarea = type("/archive");
    fireEvent.keyDown(textarea, { key: "Escape" });
    fireEvent.keyDown(textarea, { key: "Enter" });
    await waitFor(() => expect(chat.archiveSession).toHaveBeenCalledWith("/sessions/s1.jsonl", true));
    expect(chat.prompt).not.toHaveBeenCalled();
  });

  it("shows archive failures without prompting the agent", async () => {
    chat.state.sessionPath = "/sessions/s1.jsonl";
    chat.archiveSession.mockRejectedValueOnce(new Error("Cannot save archive metadata"));
    mount();
    const textarea = type("/archive");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(await screen.findByText("Cannot save archive metadata")).toBeTruthy();
    expect(chat.prompt).not.toHaveBeenCalled();
  });

  it("does not offer or execute archive while the session is running", () => {
    chat.state.sessionPath = "/sessions/s1.jsonl";
    chat.state.status = "running";
    mount();
    const textarea = type("/archive");
    expect(screen.queryByRole("option", { name: /Archive session/ })).toBeNull();
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(chat.archiveSession).not.toHaveBeenCalled();
    expect(chat.prompt).not.toHaveBeenCalled();
  });
});

describe("composer argument completion", () => {
  it("offers commands and argument completion while running", async () => {
    chat.state.status = "running";
    mount();
    const textarea = type("/dep");
    expect(screen.getByRole("option", { name: /deploy/ })).toBeTruthy();
    type("/deploy ");
    expect(await screen.findByRole("option", { name: /Staging/ })).toBeTruthy();
    expect(chat.completeCommandArguments).toHaveBeenCalledWith("s1", "deploy", "", expect.any(AbortSignal));
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(textarea.value).toBe("/deploy staging");
    expect(chat.prompt).not.toHaveBeenCalled();
  });

  it("hides after acceptance and resumes completing the same argument only when typing continues", async () => {
    chat.state.actions.commands.push({ name: "cwd", source: "extension" });
    chat.completeCommandArguments.mockImplementation(async (_session, _name, prefix) => {
      if (prefix === "") return [{ value: "/projects/", label: "Projects" }];
      if (prefix === "/projects/" || prefix === "/projects/a") return [{ value: "/projects/app/", label: "App" }];
      if (prefix === "/projects/app/" || prefix === "/projects/app/s") return [{ value: "/projects/app/src/", label: "Source" }];
      return [];
    });
    try {
      mount();
      const textarea = type("/cwd ");
      await screen.findByRole("option", { name: "Projects" });
      fireEvent.keyDown(textarea, { key: "Tab" });
      expect(textarea.value).toBe("/cwd /projects/");
      await act(async () => {});
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(chat.completeCommandArguments).toHaveBeenCalledTimes(1);
      type("/cwd /projects/a");
      const subfolder = await screen.findByRole("option", { name: "App" });
      expect(chat.completeCommandArguments).toHaveBeenLastCalledWith("s1", "cwd", "/projects/a", expect.any(AbortSignal));
      fireEvent.mouseDown(subfolder);
      expect(textarea.value).toBe("/cwd /projects/app/");
      expect(textarea.selectionStart).toBe(textarea.value.length);
      expect(document.activeElement).toBe(textarea);
      await act(async () => {});
      expect(screen.queryByRole("listbox")).toBeNull();
      expect(chat.completeCommandArguments).toHaveBeenCalledTimes(2);
      type("/cwd /projects/app/s");
      await screen.findByRole("option", { name: "Source" });
      fireEvent.keyDown(textarea, { key: "Enter" });
      expect(textarea.value).toBe("/cwd /projects/app/src/");
      expect(chat.prompt).not.toHaveBeenCalled();
      await act(async () => {});
      expect(chat.completeCommandArguments).toHaveBeenCalledTimes(3);
      expect(screen.queryByRole("listbox")).toBeNull();
      fireEvent.keyDown(textarea, { key: "Enter" });
      expect(chat.prompt).toHaveBeenCalledWith("/cwd /projects/app/src/");
    } finally {
      chat.state.actions.commands = chat.state.actions.commands.filter((command) => command.name !== "cwd");
    }
  });

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

  it("replaces all arguments with the provider value, not just the last token", async () => {
    chat.completeCommandArguments.mockResolvedValue([{ value: "first staging", label: "Staging" }]);
    mount();
    const draft = "/deploy first st --flag\nnotes";
    const caret = draft.indexOf(" --flag");
    const textarea = type(draft, caret);
    await screen.findByRole("option", { name: /Staging/ });
    expect(chat.completeCommandArguments).toHaveBeenCalledWith("s1", "deploy", "first st", expect.any(AbortSignal));
    fireEvent.keyDown(textarea, { key: "Tab" });
    expect(textarea.value).toBe("/deploy first staging --flag\nnotes");
    expect(textarea.selectionStart).toBe("/deploy first staging".length);
    expect(chat.prompt).not.toHaveBeenCalled();
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
    view.rerender(<MantineProvider><ComposerContainer widgetsDocked={false} onHeightChange={() => {}} /></MantineProvider>);
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
    view.rerender(<MantineProvider><ComposerContainer widgetsDocked={false} onHeightChange={() => {}} /></MantineProvider>);
    expect(screen.queryByRole("listbox")).toBeNull();
    type("/deploy pr");
    await screen.findByRole("option");
    chat.app.connection = "connecting";
    view.rerender(<MantineProvider><ComposerContainer widgetsDocked={false} onHeightChange={() => {}} /></MantineProvider>);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
