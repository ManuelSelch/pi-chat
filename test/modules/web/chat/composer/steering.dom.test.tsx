// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionActionsProvider } from "../../../../../src/web/sessions/actions/SessionActionsProvider.js";
import { ComposerContainer as ActualComposerContainer } from "../../../../../src/web/chat/composer/ComposerContainer.js";
import { initialChatState, type ChatState } from "../../../../../src/web/app/state/chat-state.js";

const chat = {
  app: { activeSessionId: "s1", tabs: [{ sessionId: "s1" }], tabsKnown: true, openingTabs: 0, closingSessionIds: [], connection: "open", appFeatures: [] },
  state: { ...initialChatState, status: "running" } as ChatState,
  prompt: vi.fn(), completeCommandArguments: vi.fn(async () => []),
};
vi.mock("../../../../../src/web/app/AppControllerContext.js", () => ({ useAppController: () => chat }));
vi.mock("../../../../../src/web/ui/confirm/ConfirmDialogProvider.js", () => ({ useConfirmDialog: () => ({ confirm: vi.fn() }) }));
vi.mock("../../../../../src/web/app/overlays/OverlayController.js", () => ({ useOverlays: () => ({ anyOpen: false }) }));
function ComposerContainer(props: { onHeightChange: (height: number) => void }) {
  return <SessionActionsProvider><ActualComposerContainer {...props} /></SessionActionsProvider>;
}
function mount() { return render(<MantineProvider><ComposerContainer onHeightChange={() => {}} /></MantineProvider>); }
function enter(text: string) {
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: text } });
  if (screen.queryByRole("listbox")) fireEvent.keyDown(input, { key: "Escape" });
  fireEvent.keyDown(input, { key: "Enter" });
  return input;
}
beforeEach(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  chat.state = { ...initialChatState, status: "running" };
  chat.app.connection = "open";
  chat.app.activeSessionId = "s1";
  chat.app.openingTabs = 0;
  chat.app.tabsKnown = true;
  vi.clearAllMocks();
});
afterEach(cleanup);
describe("loading composer", () => {
  it("disables input until the first session has finished opening, then focuses it", () => {
    chat.app.activeSessionId = "";
    chat.app.openingTabs = 1;
    chat.state = { ...initialChatState };
    const view = mount();
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe("Loading session…");
    fireEvent.change(input, { target: { value: "Too early" } });
    fireEvent.submit(input.closest("form")!);
    expect(chat.prompt).not.toHaveBeenCalled();
    expect(input.value).toBe("");

    chat.app.activeSessionId = "s2";
    chat.app.openingTabs = 0;
    chat.state = { ...initialChatState, status: "idle" };
    view.rerender(<MantineProvider><ComposerContainer onHeightChange={() => {}} /></MantineProvider>);
    expect(input.disabled).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(enter("Ready now").value).toBe("");
    expect(chat.prompt).toHaveBeenCalledExactlyOnceWith("Ready now");
  });

  it("disables the initial composer before any active session is known", () => {
    chat.app.activeSessionId = "";
    chat.app.tabsKnown = false;
    mount();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
  });

  it("preserves an existing draft while another session is opening", () => {
    const view = mount();
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "Keep this draft" } });
    chat.app.openingTabs = 1;
    view.rerender(<MantineProvider><ComposerContainer onHeightChange={() => {}} /></MantineProvider>);
    expect(input.disabled).toBe(true);
    fireEvent.submit(input.closest("form")!);
    expect(chat.prompt).not.toHaveBeenCalled();
    expect(input.value).toBe("Keep this draft");

    chat.app.openingTabs = 0;
    view.rerender(<MantineProvider><ComposerContainer onHeightChange={() => {}} /></MantineProvider>);
    expect(input.disabled).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("Keep this draft");
  });
});

describe("steering composer", () => {
  it("submits while running and clears the draft without keyboard helper text", () => {
    mount();
    expect(screen.getByPlaceholderText("Steer Pi…")).toBeTruthy();
    const input = enter("Use the native API");
    expect(chat.prompt).toHaveBeenCalledExactlyOnceWith("Use the native API");
    expect(input.value).toBe("");
    expect(screen.queryByText(/Enter to steer/)).toBeNull();
  });
  it("renders native pending messages without an internal scroll area and removes consumed messages", () => {
    chat.state = { ...chat.state, steeringMessages: ["Keep keyboard shortcuts", "Do not add buttons"] };
    const view = mount();
    const panel = screen.getByRole("region", { name: "Queued steering" });
    expect(panel.textContent).toContain("Keep keyboard shortcuts");
    expect(panel.textContent).toContain("Do not add buttons");
    expect(panel.style.overflow).toBe("");
    expect(panel.style.maxHeight).toBe("");
    chat.state = { ...chat.state, steeringMessages: [] };
    view.rerender(<MantineProvider><ComposerContainer onHeightChange={() => {}} /></MantineProvider>);
    expect(screen.queryByRole("region", { name: "Queued steering" })).toBeNull();
  });
  it.each(["/reload", "/compact", "/new", "/skill:review"])("submits %s while running", text => {
    mount();
    expect(enter(text).value).toBe("");
    expect(chat.prompt).toHaveBeenCalledExactlyOnceWith(text);
  });
  it.each(["!pwd", "!!pwd"])("keeps busy bash %s in the draft", text => {
    mount();
    expect(enter(text).value).toBe(text);
    expect(chat.prompt).not.toHaveBeenCalled();
  });
  it.each(["aborting", "connecting", "superseded"] as const)("does not submit while %s", status => {
    chat.state = { ...chat.state, status };
    mount();
    expect(enter("Wait").value).toBe("Wait");
    expect(chat.prompt).not.toHaveBeenCalled();
  });
  it("does not send while disconnected even if the last session state was running", () => {
    chat.app.connection = "connecting";
    mount();
    expect(enter("Wait").value).toBe("Wait");
    expect(chat.prompt).not.toHaveBeenCalled();
  });
});
