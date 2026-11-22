import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { expect, vi } from "vitest";
import { App } from "../../../src/web/app/App.js";
import { FakeBrowserWebSocket as Socket } from "../fake-browser-websocket.js";
import { snapshotData, summary, themeData } from "../v2-fixtures.js";

/** Real shell, plugin, picker and SDK; only the server transport is simulated. */
export class FolderPluginDriver {
  constructor() {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem("pi-chat:session-inbox", "false");
    Socket.instances = [];
    vi.stubGlobal("WebSocket", Socket);
    Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
  }

  async mount() {
    render(<MantineProvider><App /></MantineProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => { Socket.current.acceptConnection(); Socket.current.initialize([]); });
  }

  async openPicker(entry: "menus" | "projects" = "menus") {
    if (entry === "menus") {
      fireEvent.click(screen.getByRole("textbox", { name: "Search sessions and projects" }));
      fireEvent.click(screen.getByRole("button", { name: "/ Actions" }));
      fireEvent.click(screen.getByRole("option", { name: /Action: Open folder/ }));
    } else {
      fireEvent.click(screen.getByRole("button", { name: "Projects and sessions" }));
      await this.settleTransitions();
      fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    }
    await this.settleTransitions();
  }

  shouldBrowseThroughPlugin(path = "~") {
    expect(Socket.current.requests.at(-1)).toMatchObject({ method: "plugin.call", params: { contractId: "folder-opening", contractVersion: 1, method: "browse", input: { path, showHidden: false } } });
    expect(Socket.current.requests.some(request => request.method === "directory.browse")).toBe(false);
  }

  async showFolder(path = "/server/work") {
    await act(async () => { Socket.current.reply({ value: { ok: true, listing: { path, breadcrumbs: [{ name: "work", path }], entries: [] } } }); });
  }

  startSession() {
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(Socket.current.requests.at(-1)).toMatchObject({ method: "session.create", params: { projectPath: "/server/work" } });
  }

  async rejectCreation() {
    await act(async () => { Socket.current.reject("operationFailed", "Cannot create session"); });
  }

  async completeCreation() {
    const snapshot = snapshotData({ sessionId: "created", projectPath: "/server/work" });
    await act(async () => { Socket.current.reply({ summary: summary(snapshot), snapshot, theme: themeData() }); });
    await this.settleTransitions();
  }

  shouldKeepPickerError() {
    expect(screen.getByRole("dialog", { name: "Open server folder" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Cannot create session");
    expect(screen.queryByRole("textbox", { name: "Message Pi" })).toBeNull();
  }

  shouldShowSession() {
    expect(screen.queryByRole("dialog", { name: "Open server folder" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Message Pi" })).toBeTruthy();
  }

  async reconnect() {
    act(() => Socket.current.close());
    await act(async () => { await vi.advanceTimersByTimeAsync(250); });
    act(() => { Socket.current.acceptConnection(); Socket.current.initialize([]); });
    await this.settleTransitions();
  }

  async cancelPicker() {
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await this.settleTransitions();
  }

  shouldNotCreateSession() {
    expect(Socket.instances.flatMap(socket => socket.requests).filter(request => request.method === "session.create")).toEqual([]);
  }

  private async settleTransitions() {
    for (let phase = 0; phase < 3; phase++)
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  }

  dispose() {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
}
