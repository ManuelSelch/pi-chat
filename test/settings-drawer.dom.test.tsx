// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialChatState } from "../src/web/chat/chat-state.js";
import { SettingsDrawer } from "../src/web/settings/SettingsDrawer.js";

afterEach(cleanup);

const noop = () => {};

function renderDrawer(extensions: typeof initialChatState.extensions, runExtensionAction = vi.fn()) {
  render(
    <MantineProvider>
      <SettingsDrawer
        opened
        onClose={noop}
        state={{ ...initialChatState, extensions }}
        busy={false}
        renameSession={noop}
        setThinkingLevel={noop}
        setModel={noop}
        compactSession={noop}
        restartServer={noop}
        appFeatures={[]}
        chimesEnabled={false}
        setChimesEnabled={noop}
        chimesAvailable
        runExtensionAction={runExtensionAction}
      />
    </MantineProvider>,
  );
  return runExtensionAction;
}

describe("SettingsDrawer extension section", () => {
  it("renders settings.section buttons and dispatches their action", () => {
    const runExtensionAction = renderDrawer({
      buttons: [
        { id: "demo.enable", slot: "settings.section", label: "Enable multi-user demo", actionId: "demo.toggleEnabled" },
        { id: "demo.header", slot: "session.header.right", label: "Users", actionId: "demo.status" },
      ],
      badges: [],
      state: {},
    });

    fireEvent.click(screen.getByRole("button", { name: "Enable multi-user demo" }));

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
