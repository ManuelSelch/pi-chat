import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, vi } from "vitest";
import { App } from "../../../src/web/app/App.js";
import { FakeBrowserWebSocket as Socket } from "../fake-browser-websocket.js";
import { coreEvent, snapshotData, summary } from "../v2-fixtures.js";

/** Real App, plugin and SDK; audio output and the server socket are simulated. */
export class ChimesPluginDriver {
  private notes = 0;
  private closes = 0;
  private sequence = 0;

  constructor(available = true) {
    vi.useFakeTimers();
    localStorage.clear();
    localStorage.setItem("pi-chat:session-inbox", "false");
    Socket.instances = [];
    vi.stubGlobal("WebSocket", Socket);
    Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    const driver = this;
    class Audio {
      state = "running";
      currentTime = 0;
      destination = {};
      resume = async () => {};
      close = async () => { driver.closes++; };
      createOscillator() {
        return { type: "", frequency: { value: 0 }, connect: (node: unknown) => node, start() {}, stop() { driver.notes++; } };
      }
      createGain() {
        return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (node: unknown) => node };
      }
    }
    vi.stubGlobal("AudioContext", available ? Audio : undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
  }

  async mount() {
    render(<MantineProvider><App /></MantineProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    act(() => {
      Socket.current.acceptConnection();
      Socket.current.initialize([
        snapshotData({ sessionId: "foreground" }),
        snapshotData({ sessionId: "background", runtime: { status: "running" } }),
      ]);
    });
  }

  async openSettings() {
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    await this.settle();
  }

  shouldKeepExistingFeatureToggles() {
    const switches = within(screen.getByRole("group", { name: "Feature Toggles" })).getAllByRole("switch");
    expect(switches).toHaveLength(6);
    for (const name of ["Agentation UI feedback", "Show open sessions in sidebar", "Show folder path in projects panel", "Hide archived sessions", "Compact transcript"])
      expect(within(screen.getByRole("group", { name: "Feature Toggles" })).getByRole("switch", { name })).toBeTruthy();
    expect(switches[2]).toBe(this.toggle());
    expect(screen.queryByRole("group", { name: "Sounds" })).toBeNull();
  }

  async enableChimes() {
    await act(async () => { fireEvent.click(this.toggle()); });
    expect(this.toggle().checked).toBe(true);
    expect(JSON.parse(localStorage.getItem("pi-chat:chimes")!)).toBe(true);
  }

  async closeSettings() {
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape", code: "Escape", bubbles: true });
    await this.settle();
    expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
  }

  async finishBackgroundRun() {
    await act(async () => {
      Socket.current.deliver(coreEvent("runtime.status", { status: "idle" }, "background", ++this.sequence));
      Socket.current.deliver({
        version: 2, type: "event", serverInstanceId: "process", event: "session.list.changed",
        data: { revision: this.sequence, sessions: [summary(snapshotData({ sessionId: "foreground" })), summary(snapshotData({ sessionId: "background" }))] },
      });
    });
  }

  shouldHavePlayedChimes(count: number) { expect(this.notes).toBe(count * 2); }
  shouldKeepEnabled() { expect(this.toggle().checked).toBe(true); }
  shouldDisableUnavailableAudio() { expect(this.toggle().disabled).toBe(true); }
  shouldReleaseAudio() { expect(this.closes).toBe(1); }
  unmount() { cleanup(); }

  dispose() {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }

  private toggle() {
    return screen.getByRole("switch", { name: "Chime when a run finishes or needs an answer" }) as HTMLInputElement;
  }

  private async settle() {
    for (let phase = 0; phase < 3; phase++)
      await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  }
}
