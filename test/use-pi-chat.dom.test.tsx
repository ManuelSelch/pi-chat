// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTROLLER_REPLACED_CODE, PROTOCOL_VERSION } from "../src/shared/protocol.js";
import { usePiChat } from "../src/web/app/use-pi-chat.js";

/** Minimal stand-in for the browser WebSocket, recording every instance. */
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  closedWhileConnecting = false;
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const existing = this.listeners.get(type) ?? new Set();
    existing.add(listener);
    this.listeners.set(type, existing);
  }

  close(code = 1000): void {
    if (this.readyState === FakeWebSocket.CONNECTING) this.closedWhileConnecting = true;
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.emit("close", { code });
  }

  /** The server kicked this tab because another browser took the controller slot. */
  replaceByNewController(): void {
    this.close(CONTROLLER_REPLACED_CODE);
  }

  readonly sent: string[] = [];
  send(message: string): void { this.sent.push(message); }

  acceptConnection(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.emit("open", {});
  }

  refuseConnection(): void {
    this.emit("error", {});
    this.close();
  }

  deliver(message: unknown): void {
    this.emit("message", { data: JSON.stringify(message) });
  }

  private emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

function Probe() {
  const { app, state, takeControl } = usePiChat();
  // Mirrors App: connection state wins until a session is on screen.
  return (
    <>
      <output data-testid="status">{app.connection === "open" ? state.status : app.connection}</output>
      <button onClick={takeControl} type="button">Take control here</button>
    </>
  );
}

function FolderProbe() {
  const { browseDirectories, startFolderSession, takeControl } = usePiChat();
  const [result, setResult] = useState("");
  return <>
    <button onClick={takeControl}>Reclaim</button>
    <button onClick={() => void browseDirectories({ path: "~" }).then((listing) => setResult(listing.path), (error: Error) => setResult(error.message))}>Browse</button>
    <button onClick={() => void startFolderSession("/server/fresh").then(setResult, (error: Error) => setResult(error.message))}>Start folder</button>
    <output data-testid="result">{result}</output>
  </>;
}

describe("usePiChat connection lifecycle", () => {
  it("sends correlated folder requests without a session and receives their results", async () => {
    render(<FolderProbe />);
    act(() => void vi.advanceTimersByTime(0));
    const socket = FakeWebSocket.instances[0]!;
    act(() => socket.acceptConnection());
    act(() => screen.getByText("Browse").click());
    const browse = JSON.parse(socket.sent[0]!);
    expect(browse).toMatchObject({ type: "browseDirectories", path: "~" });
    await act(async () => socket.deliver({ version: 1, type: "directoryListing", requestId: browse.requestId, listing: { path: "/server/home", entries: [], breadcrumbs: [] } }));
    expect(screen.getByTestId("result").textContent).toBe("/server/home");
    act(() => screen.getByText("Start folder").click());
    const start = JSON.parse(socket.sent[1]!);
    expect(start).toMatchObject({ type: "newSession", path: "/server/fresh" });
    await act(async () => socket.deliver({ version: 1, type: "sessionOpenError", requestId: start.requestId, error: "Permission denied" }));
    expect(screen.getByTestId("result").textContent).toBe("Permission denied");
  });

  it("does not cancel new requests when a disposed socket closes late", async () => {
    render(<FolderProbe />);
    act(() => void vi.advanceTimersByTime(0));
    const old = FakeWebSocket.instances[0]!;
    act(() => old.acceptConnection());
    const close = vi.spyOn(old, "close").mockImplementation(() => {});
    act(() => screen.getByText("Reclaim").click());
    act(() => void vi.advanceTimersByTime(0));
    const next = FakeWebSocket.instances[1]!;
    act(() => next.acceptConnection());
    act(() => screen.getByText("Browse").click());
    const request = JSON.parse(next.sent[0]!);
    close.mockRestore();
    await act(async () => old.close());
    await act(async () => next.deliver({ version: 1, type: "directoryListing", requestId: request.requestId, listing: { path: "/new", entries: [], breadcrumbs: [] } }));
    expect(screen.getByTestId("result").textContent).toBe("/new");
  });

  it("rejects in-flight folder requests when the socket disconnects", async () => {
    render(<FolderProbe />);
    act(() => void vi.advanceTimersByTime(0));
    const socket = FakeWebSocket.instances[0]!;
    act(() => socket.acceptConnection());
    act(() => screen.getByText("Browse").click());
    await act(async () => socket.close());
    expect(screen.getByTestId("result").textContent).toContain("Connection lost");
  });
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("never aborts a half-open handshake under StrictMode's double mount", () => {
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    act(() => void vi.advanceTimersByTime(0));

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances.every((socket) => !socket.closedWhileConnecting)).toBe(true);
  });

  it("retries with backoff until the server accepts, then reports idle", () => {
    render(<Probe />);
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.getByTestId("status").textContent).toBe("connecting");

    act(() => FakeWebSocket.instances[0]!.refuseConnection());
    expect(FakeWebSocket.instances).toHaveLength(1);

    act(() => void vi.advanceTimersByTime(250));
    expect(FakeWebSocket.instances).toHaveLength(2);

    act(() => FakeWebSocket.instances[1]!.refuseConnection());
    act(() => void vi.advanceTimersByTime(250));
    expect(FakeWebSocket.instances).toHaveLength(2); // backoff doubled, not yet due
    act(() => void vi.advanceTimersByTime(250));
    expect(FakeWebSocket.instances).toHaveLength(3);

    const connected = FakeWebSocket.instances[2]!;
    act(() => connected.acceptConnection());
    act(() =>
      connected.deliver({
        version: PROTOCOL_VERSION, type: "snapshot", sequence: 0, throughSequence: 0,
        sessionId: "session", projectPath: "/project", messages: [], isStreaming: false,
      }),
    );

    expect(screen.getByTestId("status").textContent).toBe("idle");
  });

  it("forwards the page query string to the WebSocket", () => {
    window.history.replaceState(null, "", "/?invite=demo");

    render(<Probe />);
    act(() => void vi.advanceTimersByTime(0));

    expect(FakeWebSocket.instances[0]!.url).toBe("ws://localhost:3000/ws?invite=demo");
  });

  it("stops reconnecting when another tab takes the controller slot", () => {
    render(<Probe />);
    act(() => void vi.advanceTimersByTime(0));
    const first = FakeWebSocket.instances[0]!;
    act(() => first.acceptConnection());

    act(() => first.replaceByNewController());
    expect(screen.getByTestId("status").textContent).toBe("superseded");

    // The displaced tab must stay quiet; otherwise both tabs kick each other
    // forever and neither can prompt.
    act(() => void vi.advanceTimersByTime(30_000));
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it("reconnects only when the user explicitly takes control back", () => {
    render(<Probe />);
    act(() => void vi.advanceTimersByTime(0));
    act(() => FakeWebSocket.instances[0]!.acceptConnection());
    act(() => FakeWebSocket.instances[0]!.replaceByNewController());
    expect(FakeWebSocket.instances).toHaveLength(1);

    act(() => screen.getByRole("button", { name: "Take control here" }).click());
    act(() => void vi.advanceTimersByTime(0));
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("returns to connecting and reconnects when an established socket drops", () => {
    render(<Probe />);
    act(() => void vi.advanceTimersByTime(0));
    const first = FakeWebSocket.instances[0]!;
    act(() => first.acceptConnection());
    act(() =>
      first.deliver({
        version: PROTOCOL_VERSION, type: "snapshot", sequence: 0, throughSequence: 0,
        sessionId: "session", projectPath: "/project", messages: [], isStreaming: false,
      }),
    );
    expect(screen.getByTestId("status").textContent).toBe("idle");

    act(() => first.close());
    expect(screen.getByTestId("status").textContent).toBe("connecting");

    act(() => void vi.advanceTimersByTime(250));
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
