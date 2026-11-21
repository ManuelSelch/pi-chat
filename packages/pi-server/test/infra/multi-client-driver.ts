import { once } from "node:events";
import WebSocket from "ws";
import { expect, vi } from "vitest";
import type { Capability, SessionSnapshot } from "@manuelselch/pi-sdk/protocol";
import { createPiServer, type PiServer } from "../../src/index.js";
import { FakeRuntimeAdapter } from "./fake-runtime-adapter.js";
import { v2Socket } from "./v2-socket.js";
import { ProjectSessionService } from "../../src/projects/project-session-service.js";

type SocketClient = Awaited<ReturnType<typeof v2Socket>>;

export class SessionDriver {
  constructor(readonly id: string, private readonly runtime: FakeRuntimeAdapter) {}

  shouldContainInput(text: string) {
    expect(this.runtime.snapshot().messages[0]).toMatchObject({ role: "user", text });
  }

  askForConfirmation() { return this.runtime.uiContext().confirm("Proceed?", "Allow action"); }

  shouldHavePendingConfirmation() {
    expect(this.runtime.snapshot().prompts).toEqual([expect.objectContaining({ kind: "confirm", title: "Proceed?" })]);
  }

  shouldHaveNoDialogs() { expect(this.runtime.snapshot().prompts).toEqual([]); }
}

export class ClientDriver {
  private request = 0;
  constructor(
    private readonly client: SocketClient,
    private readonly app: MultiClientDriver,
    private readonly initial?: SessionSnapshot[],
    private readonly serverSocket?: WebSocket,
  ) {}

  session() {
    const snapshot = this.initial?.[0];
    if (!snapshot) throw new Error("Client has not initialized");
    return this.app.session(snapshot);
  }

  async createSession() {
    this.client.send("session.create", "create");
    const reply = await this.client.response("create");
    expect(reply).toMatchObject({ ok: true });
    if (!reply.ok) throw new Error(reply.error.message);
    return this.app.session((reply.result as { snapshot: SessionSnapshot }).snapshot);
  }

  async shouldSeeBothSessions() {
    await this.client.wait(message => message.type === "event" && message.event === "session.list.changed" && message.data.sessions.length === 2);
  }

  async send(session: SessionDriver, text: string) {
    this.client.send("message.send", "same-request-id", { message: text }, session.id);
    expect(await this.client.response("same-request-id")).toMatchObject({ ok: true, result: { state: "accepted" } });
  }

  async shouldReceiveRuns(...sessions: SessionDriver[]) {
    for (const session of sessions)
      await this.client.wait(message => message.type === "event" && message.event === "operation.finished" && message.sessionId === session.id);
    expect(this.client.messages.filter(message => message.type === "response" && message.requestId === "same-request-id")).toHaveLength(1);
    const events = this.client.messages.filter(message => message.type === "event" && "sequence" in message);
    for (const session of sessions) {
      const sequences = events.filter(message => "sessionId" in message && message.sessionId === session.id).map(message => "sequence" in message ? message.sequence : undefined);
      expect(sequences).toEqual(sequences.map((_, index) => index + 1));
    }
  }

  async changeSettings(session: SessionDriver) {
    this.client.send("thinking.level", "settings", { level: "off" }, session.id);
    expect(await this.client.response("settings")).toMatchObject({ ok: true });
  }

  async shouldReceivePresentation(included: boolean) {
    expect("presentation" in this.initial![0]!).toBe(included);
    const event = await this.client.wait(message => message.type === "event" && message.event === "session.snapshot");
    if (event.type !== "event" || event.event !== "session.snapshot") throw new Error("Expected snapshot");
    expect("presentation" in event.data).toBe(included);
  }

  async shouldRejectFileOpen(session: SessionDriver) {
    this.client.send("file.open", "unsupported", { path: "anything" }, session.id);
    expect(await this.client.response("unsupported")).toMatchObject({ ok: false, error: { code: "unsupportedOperation" } });
  }

  async answerConfirmation(session: SessionDriver) {
    let prompt = this.initial?.find(snapshot => snapshot.sessionId === session.id)?.prompts[0];
    if (!prompt) {
      const event = await this.client.wait(message => message.type === "event" && message.event === "prompt.list.changed" && message.sessionId === session.id && message.data.prompts.length > 0);
      if (event.type !== "event" || event.event !== "prompt.list.changed") throw new Error("Expected prompt");
      prompt = event.data.prompts[0]!;
    }
    this.client.send("prompt.answer", "answer", { promptId: prompt.id, result: { cancelled: false, value: true } }, session.id);
    expect(await this.client.response("answer")).toMatchObject({ ok: true });
  }

  shouldRecoverConfirmation(session: SessionDriver) {
    expect(this.initial).toContainEqual(expect.objectContaining({ sessionId: session.id,
      prompts: [expect.objectContaining({ kind: "confirm", title: "Proceed?" })] }));
  }

  async shouldRemainUsable() {
    const id = `ping-${++this.request}`;
    this.client.send("server.ping", id);
    expect(await this.client.response(id)).toMatchObject({ ok: true });
  }

  overload() {
    if (!this.serverSocket) throw new Error("Client has not initialized");
    Object.defineProperty(this.serverSocket, "bufferedAmount", { get: () => 16_777_216, configurable: true });
  }

  async shouldDisconnect() {
    await vi.waitFor(() => expect(this.client.socket.readyState).toBe(WebSocket.CLOSED));
  }

  async disconnect() {
    const closed = once(this.client.socket, "close");
    this.client.socket.close();
    await closed;
    await this.app.synchronize();
  }

  get available() { return this.initial !== undefined && this.client.socket.readyState === WebSocket.OPEN; }
  terminate() { this.client.socket.terminate(); }
}

export class MultiClientDriver {
  private server!: PiServer;
  private readonly runtimes = [new FakeRuntimeAdapter("first"), new FakeRuntimeAdapter("second")];
  private readonly clients: ClientDriver[] = [];
  private readonly serverSockets = new Map<string, WebSocket>();
  private readonly releases: (() => void)[] = [];

  async start() {
    vi.spyOn(ProjectSessionService.prototype, "catalogue").mockResolvedValue({ projects: [] });
    vi.spyOn(ProjectSessionService.prototype, "rememberProject").mockResolvedValue(undefined);
    const sockets = this.serverSockets;
    const send = WebSocket.prototype.send;
    vi.spyOn(WebSocket.prototype, "send").mockImplementation(function (this: WebSocket, ...args: Parameters<typeof send>) {
      const message = JSON.parse(String(args[0]));
      if (message.type === "response" && message.requestId === "init" && message.ok)
        sockets.set(message.result.connectionId, this);
      return send.apply(this, args);
    });
    const second = this.runtimes[1]!;
    this.server = await createPiServer({ runtime: this.runtimes[0], runtimeFactory: {
      newSession: async () => second, openSession: async () => second, continueProject: async () => second,
    } });
    await new Promise<void>(resolve => this.server.httpServer.listen(0, "127.0.0.1", resolve));
  }

  session(snapshot: SessionSnapshot) {
    const runtime = this.runtimes.find(runtime => runtime.snapshot().sessionPath === snapshot.sessionPath);
    if (!runtime) throw new Error("Unknown fixture session");
    return new SessionDriver(snapshot.sessionId, runtime);
  }

  async connectUninitialized() {
    const driver = new ClientDriver(await v2Socket(this.server), this);
    this.clients.push(driver);
    return driver;
  }

  async connect(capabilities: Capability[] = ["presentation"]) {
    const client = await v2Socket(this.server);
    // Track before initialization so failed setup still releases the socket.
    const pending = new ClientDriver(client, this);
    this.clients.push(pending);
    const initial = await client.initialize(capabilities);
    expect(client.messages[0]).toMatchObject({ type: "response", requestId: "init", ok: true });
    const driver = new ClientDriver(client, this, initial.snapshots, this.serverSockets.get(initial.connectionId));
    this.clients[this.clients.indexOf(pending)] = driver;
    return driver;
  }

  holdRuns() {
    for (const runtime of this.runtimes) {
      const original = runtime.prompt.bind(runtime);
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      this.releases.push(release);
      vi.spyOn(runtime, "prompt").mockImplementation(async text => { await gate; await original(text); });
    }
  }

  releaseRuns() { for (const release of this.releases) release(); }

  async synchronize() {
    const peer = this.clients.find(client => client.available);
    if (peer) await peer.shouldRemainUsable();
  }

  useDialogClock() { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); }

  async advanceTime(milliseconds: number) { await vi.advanceTimersByTimeAsync(milliseconds); }

  async close() {
    this.releaseRuns();
    for (const client of this.clients) client.terminate();
    if (this.server) await this.server.close();
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
}
