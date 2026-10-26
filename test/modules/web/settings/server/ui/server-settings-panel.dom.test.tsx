// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServerSettingsPanel, type ServerSettingsPanelProps } from "../../../../../../src/web/settings/server/ui/ServerSettingsPanel.js";

afterEach(cleanup);
function mount(overrides: Partial<ServerSettingsPanelProps> = {}) {
  const props: ServerSettingsPanelProps = {
    endpoint: "wss://pi.example/ws?…", placeholder: "wss://pi.example/ws", connected: false, failed: true,
    draft: "wss://offline/ws", otherHost: false, busy: false, canSave: true, canReset: true,
    onEdit: vi.fn(), onSave: vi.fn(), onReset: vi.fn(), ...overrides,
  };
  render(<MantineProvider><ServerSettingsPanel {...props}/></MantineProvider>);
  return props;
}
describe("backend server panel", () => {
  it("retains edit/save/reset controls without a connection", () => {
    const props = mount();
    expect(screen.getByText("Disconnected")).toBeTruthy();
    expect(screen.getByText(/Could not connect/)).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "WebSocket endpoint" }), { target: { value: "wss://new/ws" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and reload" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(props.onEdit).toHaveBeenCalledWith("wss://new/ws");
    expect(props.onSave).toHaveBeenCalledOnce();
    expect(props.onReset).toHaveBeenCalledOnce();
  });
  it("disables unavailable actions and exposes validation", () => {
    const props = mount({ canSave: false, canReset: false, validation: "Use a WebSocket URL." });
    expect(screen.getByText("Use a WebSocket URL.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save and reload" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onReset).not.toHaveBeenCalled();
  });
  it("shows storage failure and origin restriction without hiding recovery", () => {
    mount({ otherHost: true, error: "Could not save.", warning: "Saved endpoint ignored." });
    expect(screen.getByText(/same host and port/)).toBeTruthy();
    expect(screen.getByText("Could not save.")).toBeTruthy();
    expect(screen.getByText("Saved endpoint ignored.")).toBeTruthy();
  });
});
