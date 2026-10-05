// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialChatState } from "../src/web/app/state/chat-state.js";
import { SettingsDrawer } from "../src/web/settings/SettingsDrawer.js";

afterEach(cleanup);

const noop = () => {};

function renderDrawer(extensions: typeof initialChatState.extensions, runExtensionAction = vi.fn()) {
  render(
    <MantineProvider>
      <SettingsDrawer
        opened
        onClose={noop}
        state={{ ...initialChatState, sessionName: "Pi-generated title", extensions }}
        busy={false}
        setThinkingLevel={noop}
        setModel={noop}
        compactSession={noop}
        restartServer={noop}
        appFeatures={[]}
        chimesEnabled={false}
        setChimesEnabled={noop}
        chimesAvailable
        displayPathShow={true}
        setDisplayPathShow={noop}
        runExtensionAction={runExtensionAction}
      />
    </MantineProvider>,
  );
  return runExtensionAction;
}

describe("SettingsDrawer extension section", () => {
  it("has no custom name editor and retains other settings", () => {
    renderDrawer(initialChatState.extensions);
    expect(screen.queryByRole("textbox", { name: "Session name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save session name" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Show folder path in projects panel" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Chime when a run finishes or needs an answer" })).toBeTruthy();
  });

  it("renders settings.section buttons and dispatches their action", () => {
    const runExtensionAction = renderDrawer({
      buttons: [
        { id: "demo.enable", slot: "settings.section", label: "Enable demo", actionId: "demo.toggleEnabled" },
        { id: "demo.header", slot: "session.header.right", label: "Users", actionId: "demo.status" },
      ],
      badges: [],
      state: {},
    });

    fireEvent.click(screen.getByRole("button", { name: "Enable demo" }));

    expect(screen.getByText("Extensions")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Users" })).toBeNull();
    expect(runExtensionAction).toHaveBeenCalledWith("demo.toggleEnabled");
  });

  it("omits the section when no extension registered a settings control", () => {
    renderDrawer({
      buttons: [{ id: "demo.header", slot: "session.header.right", label: "Users", actionId: "demo.status" }],
      badges: [],
      state: {},
    });

    expect(screen.queryByText("Extensions")).toBeNull();
  });
});
