// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppOverlays } from "../../../../../src/web/app/overlays/AppOverlays.js";

const mocks = vi.hoisted(() => ({
  respondToPrompt: vi.fn(),
  closeTab: vi.fn(),
  renameSession: vi.fn(),
  closeOverlay: vi.fn(),
  requestRename: vi.fn(),
  settingsMounted: vi.fn(),
  settingsUnmounted: vi.fn(),
}));

vi.mock("../../../../../src/web/app/AppControllerContext.js", () => ({
  useAppController: () => ({
    state: { prompts: [{ id: "older" }, { id: "latest" }] },
    respondToPrompt: mocks.respondToPrompt,
    closeTab: mocks.closeTab,
    renameSession: mocks.renameSession,
  }),
}));
vi.mock("../../../../../src/web/app/overlays/OverlayController.js", () => ({
  useOverlays: () => ({
    state: { closingTab: { sessionId: "session-1" }, renamingSession: "Old name" },
    close: mocks.closeOverlay,
    requestRename: mocks.requestRename,
  }),
}));
vi.mock("../../../../../src/web/extensions/prompts/PromptModal.js", () => ({
  PromptModal: ({ prompt, onRespond }: { prompt: { id: string }; onRespond: (id: string, result: { cancelled: boolean }) => void }) => (
    <button data-overlay="prompt" onClick={() => onRespond(prompt.id, { cancelled: true })}>Answer prompt</button>
  ),
}));
vi.mock("../../../../../src/web/sessions/dialogs/CloseSessionDialog.js", () => ({
  CloseSessionDialog: ({ tab, onConfirm, onClose }: { tab: { sessionId: string }; onConfirm: (id: string) => void; onClose: () => void }) => (
    <div data-overlay="close"><button onClick={() => onConfirm(tab.sessionId)}>Confirm close</button><button onClick={onClose}>Cancel close</button></div>
  ),
}));
vi.mock("../../../../../src/web/sessions/dialogs/RenameSessionDialog.js", () => ({
  RenameSessionDialog: ({ onRename, onChange }: { onRename: (name: string) => void; onChange: (name: string | undefined) => void }) => (
    <div data-overlay="rename"><button onClick={() => onRename("New name")}>Confirm rename</button><button onClick={() => onChange("Draft name")}>Edit name</button><button onClick={() => onChange(undefined)}>Cancel rename</button></div>
  ),
}));
vi.mock("../../../../../src/web/sessions/quick-open/QuickOpenContainer.js", () => ({ QuickOpenContainer: () => <div data-overlay="quick-open" /> }));
vi.mock("../../../../../src/web/sessions/projects/ProjectSessionContainer.js", () => ({ ProjectSessionContainer: () => <div data-overlay="projects" /> }));
vi.mock("../../../../../src/web/sessions/folders/FolderPickerContainer.js", () => ({ FolderPickerContainer: () => <div data-overlay="folders" /> }));
vi.mock("../../../../../src/web/settings/SettingsContainer.js", () => ({
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
      .toEqual(["prompt", "close", "rename", "quick-open", "projects", "folders", "settings"]);
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
    fireEvent.click(screen.getByText("Confirm rename"));
    expect(mocks.renameSession).toHaveBeenCalledWith("New name");
    fireEvent.click(screen.getByText("Edit name"));
    expect(mocks.requestRename).toHaveBeenCalledWith("Draft name");
    fireEvent.click(screen.getByText("Cancel rename"));
    expect(mocks.closeOverlay).toHaveBeenCalledWith("renamingSession");
  });
});
