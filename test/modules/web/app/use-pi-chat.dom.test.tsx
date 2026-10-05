// @vitest-environment jsdom
import { MantineProvider } from "@mantine/core";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTROLLER_REPLACED_CODE, PROTOCOL_VERSION } from "../../../../src/shared/protocol.js";
import { usePiChat } from "../../../../src/web/app/use-pi-chat.js";
import { AppControllerProvider } from "../../../../src/web/app/AppControllerContext.js";
import { ComposerContainer } from "../../../../src/web/chat/composer/ComposerContainer.js";

vi.mock("../../../../src/web/ui/confirm/ConfirmDialogProvider.js", () => ({ useConfirmDialog: () => ({ confirm: vi.fn() }) }));
vi.mock("../../../../src/web/app/overlays/OverlayController.js", () => ({ useOverlays: () => ({ anyOpen: false }) }));

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
  const { browseDirectories, startFolderSession, takeControl, completeCommandArguments } = usePiChat();
  const [result, setResult] = useState("");
  return <>
    <button onClick={takeControl}>Reclaim</button>
    <button onClick={() => void completeCommandArguments("s", "deploy", "st").then((items) => setResult(items[0]?.value ?? "empty"), (error: Error) => setResult(error.message))}>Complete</button>
    <button onClick={() => void browseDirectories({ path: "~" }).then((listing) => setResult(listing.path), (error: Error) => setResult(error.message))}>Browse</button>
    <button onClick={() => void startFolderSession("/server/fresh").then(setResult, (error: Error) => setResult(error.message))}>Start folder</button>
    <output data-testid="result">{result}</output>
  </>;
}

describe("usePiChat connection lifecycle", () => {
  it("keeps file actions stable, session-scoped and separate from runtime errors", async () => {
    const { result } = renderHook(() => usePiChat());
    act(() => void vi.advanceTimersByTime(0));
    const socket = FakeWebSocket.instances[0]!;
    act(() => {
      socket.acceptConnection();
      socket.deliver({ version: 1, type: "snapshot", sessionId: "s", sequence: 0, throughSequence: 0, projectPath: "/project", messages: [], isStreaming: true, lastError: "Model failed" });
    });
    const open = result.current.openFile;
    const pending = open("s", "report.pdf");
    expect(open("s", "report.pdf")).toBe(pending);
    expect(socket.sent.map((message) => JSON.parse(message).type)).toEqual(["openFile"]);
    const request = JSON.parse(socket.sent[0]!);
    act(() => {
      socket.deliver({ version: 1, type: "assistantDelta", sessionId: "s", sequence: 1, runId: "r", delta: "token" });
      socket.deliver({ version: 1, type: "tabs", activeSessionId: "other", tabs: ["s", "other"].map((sessionId) => ({ sessionId, title: sessionId, projectPath: "/project", projectName: "project", status: "running" })) });
    });
    expect(result.current.openFile).toBe(open);
    const rejected = expect(pending).rejects.toThrow("File not found");
    await act(async () => socket.deliver({ version: 1, type: "fileOpenResult", sessionId: "s", requestId: request.requestId, result: { ok: false, error: { code: "notFound", message: "File not found" } } }));
    await rejected;
    expect(result.current.app.sessions.s?.error).toBe("Model failed");
    expect(result.current.app.sessions.s?.messages).toEqual([]);
  });

  it("cancels file waits on closure/disconnect and never replays after reconnect", async () => {
    const { result, unmount } = renderHook(() => usePiChat());
    act(() => void vi.advanceTimersByTime(0));
    const socket = FakeWebSocket.instances[0]!;
    act(() => socket.acceptConnection());
    const first = result.current.openFile("s", "report.pdf");
    const cancelled = expect(first).rejects.toMatchObject({ name: "AbortError" });
    await act(async () => result.current.closeTab("s"));
    await cancelled;
    const second = result.current.openFile("other", "report.pdf");
    const disconnected = expect(second).rejects.toMatchObject({ name: "AbortError" });
    await act(async () => socket.close());
    await disconnected;
    act(() => void vi.advanceTimersByTime(250));
    const next = FakeWebSocket.instances[1]!;
    act(() => next.acceptConnection());
    expect(next.sent).toEqual([]);
    const third = result.current.openFile("other", "report.pdf");
    const disposed = expect(third).rejects.toMatchObject({ name: "AbortError" });
    await act(async () => unmount());
    await disposed;
  });


  it("dismisses the active session error when the composer close button is clicked", () => {
    Object.defineProperty(document, "fonts", { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } });
    render(
      <MantineProvider>
        <AppControllerProvider>
          <ComposerContainer onHeightChange={() => {}} />
        </AppControllerProvider>
      </MantineProvider>,
    );
    act(() => void vi.advanceTimersByTime(0));
    const socket = FakeWebSocket.instances[0]!;
    act(() => {
      socket.acceptConnection();
      socket.deliver({
        version: PROTOCOL_VERSION, type: "snapshot", sequence: 0, throughSequence: 0,
        sessionId: "session", projectPath: "/project", messages: [], isStreaming: false,
        lastError: "Model request failed",
      });
      socket.deliver({
        version: PROTOCOL_VERSION, type: "tabs", activeSessionId: "session",
        tabs: [{ sessionId: "session", title: "Test session", projectPath: "/project", projectName: "project", status: "idle" }],
      });
    });

    expect(screen.getByRole("alert").textContent).toContain("Model request failed");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("routes completion replies separately from folder replies and cancels on disconnect", async () => {
    render(<FolderProbe />);
    act(() => void vi.advanceTimersByTime(0));
    const socket = FakeWebSocket.instances[0]!;
    act(() => socket.acceptConnection());
    act(() => screen.getByText("Complete").click());
    const request = JSON.parse(socket.sent[0]!);
    expect(request).toMatchObject({ type: "completeCommandArguments", sessionId: "s", commandName: "deploy", argumentPrefix: "st" });
    await act(async () => socket.deliver({ version: 1, type: "commandArgumentCompletions", sessionId: "s", requestId: request.requestId, items: [{ value: "staging", label: "Staging" }] }));
    expect(screen.getByTestId("result").textContent).toBe("staging");
    act(() => screen.getByText("Complete").click());
    await act(async () => socket.close());
    expect(screen.getByTestId("result").textContent).toContain("Connection lost");
  });
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
