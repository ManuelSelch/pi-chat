// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServerSettingsPanel, type ServerSettingsPanelProps } from "../../../../../../src/web/settings/server/ui/ServerSettingsPanel.js";

afterEach(cleanup);
function mount(overrides: Partial<ServerSettingsPanelProps> = {}) {
  const props: ServerSettingsPanelProps = {
    placeholder: "wss://pi.example/ws", connected: false, failed: true,
    draft: "wss://offline/ws", otherHost: false, busy: false, canSave: true, canReset: true,
    onEdit: vi.fn(), onSave: vi.fn(), onReset: vi.fn(), ...overrides,
  };
  render(<MantineProvider><ServerSettingsPanel {...props}/></MantineProvider>);
  return props;
}
describe("backend server panel", () => {
  it("shows the editable endpoint and status without duplicate endpoint text or routine descriptions", () => {
    mount({ draft: "wss://pi.example/ws?profile=work", connected: true, failed: false });
    const field = screen.getByRole("textbox", { name: "WebSocket endpoint" }) as HTMLInputElement;

    expect(field.value).toBe("wss://pi.example/ws?profile=work");
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.queryByText("Current endpoint")).toBeNull();
    expect(screen.queryByText("wss://pi.example/ws?…")).toBeNull();
    expect(screen.queryByText("Leave blank to use this page’s server.")).toBeNull();
    expect(screen.queryByText("Remembered in this browser for this site. Applying reloads the page; server sessions keep running.")).toBeNull();
  });

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
