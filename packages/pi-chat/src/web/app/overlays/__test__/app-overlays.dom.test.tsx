// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppOverlays } from "../AppOverlays.js";

const mocks = vi.hoisted(() => ({
  respondToPrompt: vi.fn(),
  closeTab: vi.fn(),
  closeOverlay: vi.fn(),
  settingsMounted: vi.fn(),
  settingsUnmounted: vi.fn(),
}));

vi.mock("../../AppControllerContext.js", () => ({
  useAppController: () => ({
    app: { serverInstanceId: "server", activeSessionId: "session" },
    state: { prompts: [{ id: "older" }, { id: "latest" }] },
    promptPresentation: { prompt: { id: "latest" }, respond: mocks.respondToPrompt },
    respondToPrompt: mocks.respondToPrompt,
    closeTab: mocks.closeTab,
  }),
}));
vi.mock("../OverlayController.js", () => ({
  useOverlays: () => ({
    state: { closingTab: { sessionId: "session-1" } },
    close: mocks.closeOverlay,
  }),
}));
vi.mock("../../../features/extensions/prompts/components/PromptModal.js", () => ({
  PromptModal: ({ prompt, onRespond }: { prompt: { id: string }; onRespond: (id: string, result: { cancelled: boolean }) => void }) => (
    <button data-overlay="prompt" onClick={() => onRespond(prompt.id, { cancelled: true })}>Answer prompt</button>
  ),
}));
vi.mock("../../../features/sessions/dialogs/components/CloseSessionDialog.js", () => ({
  CloseSessionDialog: ({ tab, onConfirm, onClose }: { tab: { sessionId: string }; onConfirm: (id: string) => void; onClose: () => void }) => (
    <div data-overlay="close"><button onClick={() => onConfirm(tab.sessionId)}>Confirm close</button><button onClick={onClose}>Cancel close</button></div>
  ),
}));
vi.mock("../../../features/sessions/quick-open/components/QuickOpenContainer.js", () => ({ QuickOpenContainer: () => <div data-overlay="quick-open" /> }));
vi.mock("../../../features/sessions/projects/components/ProjectSessionContainer.js", () => ({ ProjectSessionContainer: () => <div data-overlay="projects" /> }));
vi.mock("../../plugins/PluginProvider.js", () => ({ PluginOverlayOutlet: () => <div data-overlay="plugin" /> }));
vi.mock("../../../features/settings/components/SettingsContainer.js", () => ({
  SettingsContainer: () => {
    useEffect(() => {
      mocks.settingsMounted();
      return () => { mocks.settingsUnmounted(); };
    }, []);
    return <div data-overlay="settings" />;
  },
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("AppOverlays composition", () => {
  it("assembles every overlay in the existing relative order", () => {
    const { container } = render(<AppOverlays />);
    expect([...container.querySelectorAll("[data-overlay]")].map((node) => node.getAttribute("data-overlay")))
      .toEqual(["prompt", "close", "quick-open", "projects", "plugin", "settings"]);
  });

  it("keeps Settings mounted across rerenders so its chime hook remains active", () => {
    const { rerender } = render(<AppOverlays />);
    rerender(<AppOverlays />);
    expect(mocks.settingsMounted).toHaveBeenCalledTimes(1);
    expect(mocks.settingsUnmounted).not.toHaveBeenCalled();
  });

  it("routes the latest runtime prompt and session dialog actions to their owners", () => {
    render(<AppOverlays />);
    fireEvent.click(screen.getByText("Answer prompt"));
    expect(mocks.respondToPrompt).toHaveBeenCalledWith("latest", { cancelled: true });
    fireEvent.click(screen.getByText("Confirm close"));
    expect(mocks.closeTab).toHaveBeenCalledWith("session-1");
    fireEvent.click(screen.getByText("Cancel close"));
    expect(mocks.closeOverlay).toHaveBeenCalledWith("closingTab");
  });
});
