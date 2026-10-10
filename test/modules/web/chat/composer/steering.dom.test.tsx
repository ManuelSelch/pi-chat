// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComposerContainer } from "../../../../../src/web/chat/composer/ComposerContainer.js";
import { initialChatState, type ChatState } from "../../../../../src/web/app/state/chat-state.js";

const chat = {
  app: { activeSessionId: "s1", tabs: [{ sessionId: "s1" }], tabsKnown: true, openingTabs: 0, closingSessionIds: [], connection: "open", appFeatures: [] },
  state: { ...initialChatState, status: "running" } as ChatState,
  prompt: vi.fn(), completeCommandArguments: vi.fn(async () => []),
};
vi.mock("../../../../../src/web/app/AppControllerContext.js", () => ({ useAppController: () => chat }));
vi.mock("../../../../../src/web/ui/confirm/ConfirmDialogProvider.js", () => ({ useConfirmDialog: () => ({ confirm: vi.fn() }) }));
vi.mock("../../../../../src/web/app/overlays/OverlayController.js", () => ({ useOverlays: () => ({ anyOpen: false }) }));
function mount() { return render(<MantineProvider><ComposerContainer onHeightChange={() => {}} /></MantineProvider>); }
function enter(text: string) {
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "Enter" });
  return input;
}
beforeEach(() => {
  Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  chat.state = { ...initialChatState, status: "running" };
  chat.app.connection = "open";
  vi.clearAllMocks();
});
afterEach(cleanup);
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
    chat.state.steeringMessages = ["Keep keyboard shortcuts", "Do not add buttons"];
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
  it.each(["!pwd", "/reload", "/new"])("keeps busy command %s in the draft", text => {
    mount();
    expect(enter(text).value).toBe(text);
    expect(chat.prompt).not.toHaveBeenCalled();
  });
  it.each(["aborting", "connecting", "superseded"] as const)("does not submit while %s", status => {
    chat.state.status = status;
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
