// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialChatState } from "../../../../src/web/app/state/chat-state.js";
import { SettingsDrawer } from "../../../../src/web/settings/SettingsDrawer.js";

afterEach(cleanup);

const noop = () => {};

function renderDrawer(extensions: typeof initialChatState.extensions, runExtensionAction = vi.fn(), setHideArchivedSessions = vi.fn(), transcriptDensity: "comfortable" | "compact" = "compact", setTranscriptDensity = vi.fn(), overrides: Partial<ComponentProps<typeof SettingsDrawer>> = {}) {
  render(
    <MantineProvider>
      <SettingsDrawer
        opened
        onClose={noop}
        state={{ ...initialChatState, sessionName: "Pi-generated title", extensions }}
        busy={false}
        serverSettings={null}
        setThinkingLevel={noop}
        setModel={noop}
        compactSession={noop}
        restartServer={noop}
        appFeatures={[]}
        inboxEnabled={false}
        setInboxEnabled={noop}
        chimesEnabled={false}
        setChimesEnabled={noop}
        chimesAvailable
        displayPathShow={true}
        setDisplayPathShow={noop}
        hideArchivedSessions={true}
        setHideArchivedSessions={setHideArchivedSessions}
        transcriptDensity={transcriptDensity}
        setTranscriptDensity={setTranscriptDensity}
        runExtensionAction={runExtensionAction}
        {...overrides}
      />
    </MantineProvider>,
  );
  return runExtensionAction;
}

const sessionFeatures: typeof initialChatState.actions.features = [
  { id: "thinking.level", group: "model", kind: "select", title: "Thinking", state: { value: "medium", options: ["low", "medium", "high"] } },
  { id: "model.select", group: "model", kind: "select", title: "Model", state: { value: "p/one", options: ["p/one", "p/two"] } },
  { id: "session.compact", group: "session", kind: "action", title: "Compact session", description: "Summarize older context to free up space.", state: { label: "Compact" } },
];
const restartFeature = { id: "app.restart", group: "app", kind: "action", title: "Restart server", state: { label: "Restart" } } as const;

describe("SettingsDrawer groups", () => {
  it("has no custom name editor and retains other settings", () => {
    renderDrawer(initialChatState.extensions);
    expect(screen.queryByRole("textbox", { name: "Session name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save session name" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Show folder path in projects panel" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Chime when a run finishes or needs an answer" })).toBeTruthy();
  });

  it("groups all five switches under Feature Toggles including Compact transcript", () => {
    renderDrawer(initialChatState.extensions);
    const group = screen.getByRole("group", { name: "Feature Toggles" });

    expect(within(group).getAllByRole("switch")).toHaveLength(5);
    for (const name of ["Show open sessions in sidebar", "Chime when a run finishes or needs an answer", "Show folder path in projects panel", "Hide archived sessions", "Compact transcript"]) {
      expect(within(group).getByRole("switch", { name })).toBeTruthy();
    }
    for (const name of ["Sessions", "Sounds", "Projects"]) {
      expect(screen.queryByText(name, { exact: true })).toBeNull();
    }
    expect(screen.queryByText("Transcript", { exact: true })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Transcript density" })).toBeNull();
  });

  it.each([
    ["comfortable", false, "compact"],
    ["compact", true, "comfortable"],
  ] as const)("reflects %s density and switches to %s", (density, checked, nextDensity) => {
    const setTranscriptDensity = vi.fn();
    renderDrawer(initialChatState.extensions, vi.fn(), vi.fn(), density, setTranscriptDensity);
    const group = screen.getByRole("group", { name: "Feature Toggles" });
    const toggle = within(group).getByRole("switch", { name: "Compact transcript" }) as HTMLInputElement;

    expect(toggle.checked).toBe(checked);
    fireEvent.click(toggle);

    expect(setTranscriptDensity).toHaveBeenCalledExactlyOnceWith(nextDensity);
  });

  it("orders Session, Feature Toggles, extension controls, then Backend server and retains actions", () => {
    const compactSession = vi.fn();
    const restartServer = vi.fn();
    renderDrawer(initialChatState.extensions, vi.fn(), vi.fn(), "comfortable", vi.fn(), {
      state: { ...initialChatState, actions: { ...initialChatState.actions, features: sessionFeatures }, extensions: { ...initialChatState.extensions, buttons: [{ id: "demo", slot: "settings.section", label: "Demo", actionId: "demo" }] } },
      appFeatures: [restartFeature], serverSettings: <span>Endpoint settings</span>, compactSession, restartServer,
    });
    const session = screen.getByRole("group", { name: "Session" });
    const features = screen.getByRole("group", { name: "Feature Toggles" });
    const backend = screen.getByRole("group", { name: "Backend server" });

    expect(within(session).getByLabelText("Thinking level")).toBeTruthy();
    expect(within(session).getByLabelText("Model")).toBeTruthy();
    fireEvent.click(within(session).getByRole("button", { name: "Compact" }));
    expect(within(backend).getByText("Endpoint settings")).toBeTruthy();
    fireEvent.click(within(backend).getByRole("button", { name: "Restart" }));
    expect(session.compareDocumentPosition(features) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(features.compareDocumentPosition(screen.getByText("Extensions")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Extensions").compareDocumentPosition(backend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(compactSession).toHaveBeenCalledOnce();
    expect(restartServer).toHaveBeenCalledOnce();
    expect(screen.queryByText("Summarize older context to free up space.")).toBeNull();
    expect(screen.queryByText(/Hide archived conversations and their Archived sections/)).toBeNull();
  });

  it("omits Session without advertised session features but retains app restart at Home", () => {
    renderDrawer(initialChatState.extensions, vi.fn(), vi.fn(), "comfortable", vi.fn(), { appFeatures: [restartFeature], serverSettings: <span>Endpoint settings</span> });

    expect(screen.queryByRole("group", { name: "Session" })).toBeNull();
    expect(within(screen.getByRole("group", { name: "Backend server" })).getByRole("button", { name: "Restart" })).toBeTruthy();
  });

  it("keeps session controls disabled while busy and chimes disabled when unavailable", () => {
    const compactSession = vi.fn();
    renderDrawer(initialChatState.extensions, vi.fn(), vi.fn(), "comfortable", vi.fn(), {
      state: { ...initialChatState, actions: { ...initialChatState.actions, features: sessionFeatures } }, busy: true, chimesAvailable: false, compactSession,
    });
    const session = screen.getByRole("group", { name: "Session" });

    expect((within(session).getByLabelText("Thinking level") as HTMLInputElement).disabled).toBe(true);
    expect((within(session).getByLabelText("Model") as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(within(session).getByRole("button", { name: "Compact" }));
    expect(compactSession).not.toHaveBeenCalled();
    expect((screen.getByRole("switch", { name: "Chime when a run finishes or needs an answer" }) as HTMLInputElement).disabled).toBe(true);
  });

  it("shows the enabled archive visibility switch and dispatches changes", () => {
    const setHideArchivedSessions = vi.fn();
    renderDrawer(initialChatState.extensions, vi.fn(), setHideArchivedSessions);
    const toggle = screen.getByRole("switch", { name: "Hide archived sessions" }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
    fireEvent.click(toggle);
    expect(setHideArchivedSessions).toHaveBeenCalledWith(false);
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
