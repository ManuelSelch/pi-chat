// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { MantineProvider, Switch } from "@mantine/core";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsDrawer } from "../components/SettingsDrawer.js";

afterEach(cleanup);

const noop = () => {};

function renderDrawer(transcriptDensity: "comfortable" | "compact" = "compact", setTranscriptDensity = vi.fn(), overrides: Partial<ComponentProps<typeof SettingsDrawer>> = {}) {
  render(
    <MantineProvider>
      <SettingsDrawer
        opened
        onClose={noop}
        serverSettings={null}
        versions={<div role="group" aria-label="Versions">Versions</div>}
        agentationEnabled={false}
        setAgentationEnabled={noop}
        pluginFeatureToggles={<Switch label="Example plugin" />}
        transcriptDensity={transcriptDensity}
        setTranscriptDensity={setTranscriptDensity}
        {...overrides}
      />
    </MantineProvider>,
  );
}

describe("SettingsDrawer groups", () => {
  it("renders plugin controls inside Feature Toggles without owning their state", () => {
    const toggle = vi.fn();
    renderDrawer("comfortable", vi.fn(), {
      pluginFeatureToggles: <Switch label="Example plugin" onChange={event => toggle(event.currentTarget.checked)} />,
    });

    fireEvent.click(within(screen.getByRole("group", { name: "Feature Toggles" })).getByRole("switch", { name: "Example plugin" }));

    expect(toggle).toHaveBeenCalledExactlyOnceWith(true);
  });
  it("has no custom name editor and retains other settings", () => {
    renderDrawer();
    expect(screen.queryByRole("textbox", { name: "Session name" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save session name" })).toBeNull();
    for (const name of ["Show open sessions in sidebar", "Show folder path in projects panel", "Hide archived sessions"])
      expect(screen.queryByRole("switch", { name })).toBeNull();
    expect(screen.getByRole("switch", { name: "Example plugin" })).toBeTruthy();
  });

  it("groups all switches under Feature Toggles including Agentation", () => {
    renderDrawer();
    const group = screen.getByRole("group", { name: "Feature Toggles" });

    expect(within(group).getAllByRole("switch")).toHaveLength(3);
    for (const name of ["Example plugin", "Compact transcript", "Agentation UI feedback"]) {
      expect(within(group).getByRole("switch", { name })).toBeTruthy();
    }
    for (const name of ["Sessions", "Sounds", "Projects"]) {
      expect(screen.queryByText(name, { exact: true })).toBeNull();
    }
    expect(screen.queryByText("Transcript", { exact: true })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Transcript density" })).toBeNull();
  });

  it("toggles Agentation feedback", () => {
    const setAgentationEnabled = vi.fn();
    renderDrawer("compact", vi.fn(), { setAgentationEnabled });
    const toggle = screen.getByRole("switch", { name: "Agentation UI feedback" }) as HTMLInputElement;

    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);

    expect(setAgentationEnabled).toHaveBeenCalledExactlyOnceWith(true);
  });

  it.each([
    ["comfortable", false, "compact"],
    ["compact", true, "comfortable"],
  ] as const)("reflects %s density and switches to %s", (density, checked, nextDensity) => {
    const setTranscriptDensity = vi.fn();
    renderDrawer(density, setTranscriptDensity);
    const group = screen.getByRole("group", { name: "Feature Toggles" });
    const toggle = within(group).getByRole("switch", { name: "Compact transcript" }) as HTMLInputElement;

    expect(toggle.checked).toBe(checked);
    fireEvent.click(toggle);

    expect(setTranscriptDensity).toHaveBeenCalledExactlyOnceWith(nextDensity);
  });

  it("has no Session controls", () => {
    renderDrawer("comfortable");

    expect(screen.queryByRole("group", { name: "Session" })).toBeNull();
    expect(screen.queryByLabelText("Thinking level")).toBeNull();
    expect(screen.queryByLabelText("Model")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Compact$/ })).toBeNull();
  });

  it("orders Feature Toggles, Backend server and Versions without restart", () => {
    renderDrawer("comfortable", vi.fn(), { serverSettings: <span>Endpoint settings</span> });

    const features = screen.getByRole("group", { name: "Feature Toggles" });
    const backend = screen.getByRole("group", { name: "Backend server" });
    const versions = screen.getByRole("group", { name: "Versions" });

    expect(features.compareDocumentPosition(backend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(backend.compareDocumentPosition(versions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(backend).getByText("Endpoint settings")).toBeTruthy();
    expect(within(backend).queryByRole("button", { name: "Restart" })).toBeNull();
  });
});
