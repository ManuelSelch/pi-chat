// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppOverlays } from "../AppOverlays.js";

const mocks = vi.hoisted(() => ({
  respondToPrompt: vi.fn(),
  settingsMounted: vi.fn(),
  settingsUnmounted: vi.fn(),
}));

vi.mock("../../AppControllerContext.js", () => ({
  useAppController: () => ({
    app: { serverInstanceId: "server", activeSessionId: "session" },
    state: { prompts: [{ id: "older" }, { id: "latest" }] },
    promptPresentation: { prompt: { id: "latest" }, respond: mocks.respondToPrompt },
    respondToPrompt: mocks.respondToPrompt,
  }),
}));
vi.mock("../../../features/extensions/prompts/components/PromptModal.js", () => ({
  PromptModal: ({ prompt, onRespond }: { prompt: { id: string }; onRespond: (id: string, result: { cancelled: boolean }) => void }) => (
    <button data-overlay="prompt" onClick={() => onRespond(prompt.id, { cancelled: true })}>Answer prompt</button>
  ),
}));
vi.mock("../../../features/sessions/quick-open/components/QuickOpenContainer.js", () => ({ QuickOpenContainer: () => <div data-overlay="quick-open" /> }));
vi.mock("../../../features/sessions/inbox/components/InboxContainer.js", () => ({ InboxContainer: () => <div data-overlay="sessions" /> }));
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
      .toEqual(["prompt", "quick-open", "sessions", "plugin", "settings"]);
  });

  it("keeps Settings mounted across rerenders", () => {
    const { rerender } = render(<AppOverlays />);
    rerender(<AppOverlays />);
    expect(mocks.settingsMounted).toHaveBeenCalledTimes(1);
    expect(mocks.settingsUnmounted).not.toHaveBeenCalled();
  });

  it("routes the latest runtime prompt to its owner", () => {
    render(<AppOverlays />);
    fireEvent.click(screen.getByText("Answer prompt"));
    expect(mocks.respondToPrompt).toHaveBeenCalledWith("latest", { cancelled: true });
  });
});
