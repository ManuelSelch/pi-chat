import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { PiClient, createWebSocketTransport, serverMessageSchema, type ServerMessage } from "@manuelselch/pi-sdk";
import { activeSession, initialAppState, reduceAppMessage, type AppState } from "../../../src/web/app/state/app-state.js";
import { bindPiChat } from "../../../src/web/app/connection/sdk-binding.js";
import type { PiServer } from "@manuelselch/pi-server";

/** Private implementation detail: domain tests never send protocol messages. */
export class BrowserClient {
  private state: AppState = initialAppState;
  private readonly messages: ServerMessage[] = [];
  private readonly changed = new Set<() => void>();
  private failure?: Error;
  private closing = false;
  private closeInfo?: { code: number; reason: string };
  private socket?: WebSocket;
  private readonly client: PiClient;

  constructor(server: PiServer, private readonly timeoutMs: number, activeSessionId = "") {
    this.state = { ...initialAppState, activeSessionId };
    const port = (server.httpServer.address() as AddressInfo).port;
    this.client = new PiClient({ endpoint: `ws://127.0.0.1:${port}/ws`, connectTimeoutMs: timeoutMs,
      transport: createWebSocketTransport((url) => {
        const socket = new WebSocket(url); this.socket = socket;
        // Observe physical closure for deterministic test teardown, including
        // local disposal after SDK transport listeners have been detached.
        socket.on("error", error => { this.failure = error; this.notify(); });
        socket.on("close", (code, reason) => {
          this.closeInfo = { code, reason: reason.toString() };
          if (!this.closing) this.failure ??= new Error(`Connection closed: ${code} ${reason}`);
          this.notify();
        });
        return socket;
      }),
    });
    bindPiChat(this.client, (action) => { this.state = reduceAppMessage(this.state, action); this.notify(); });
    this.client.onMessage((message) => {
      this.messages.push(serverMessageSchema.parse(message));
      if (message.type === "protocolError") this.failure = new Error(message.error.message);
      this.notify();
    });
    this.client.onError((error) => { this.failure ??= error; this.notify(); });
    this.client.start();
  }

  dismissError(): void {
    this.failure = undefined;
    this.state = reduceAppMessage(this.state, { type: "clearError" });
    this.notify();
  }

  get appState(): AppState { return this.state; }
  get chat() { return activeSession(this.state); }
  mark(): number { return this.messages.length; }

  diagnostics(): string {
    return JSON.stringify({ state: this.state, close: this.closeInfo, recentMessages: this.messages.slice(-12) });
  }

  private notify(): void { for (const check of [...this.changed]) check(); }

  async ready(operation: string): Promise<void> {
    await this.wait(operation, "tab list and authoritative session snapshots or home catalogue", () => {
      if (this.client.getState().connection.phase !== "ready" || !this.state.tabsKnown) return false;
      if (!this.state.activeSessionId) return this.state.tabs.length === 0;
      return this.state.tabs.some(tab => tab.sessionId === this.state.activeSessionId) &&
        this.state.tabs.every(tab => this.state.sessions[tab.sessionId]?.sessionId === tab.sessionId);
    });
  }

  get sdk(): PiClient { return this.client; }
  focus(sessionId: string): void { this.state = reduceAppMessage(this.state, { type: "focusSession", sessionId }); this.notify(); }
  private async openRuntime(invoke: () => Promise<string>): Promise<string> {
    this.state = reduceAppMessage(this.state, { type: "openPending" }); this.notify();
    try { const sessionId = await invoke(); this.state = reduceAppMessage(this.state, { type: "sessionOpened", sessionId }); this.notify(); return sessionId; }
    catch (error) { this.state = reduceAppMessage(this.state, { type: "commandFailed", opening: true, error: error instanceof Error ? error.message : String(error) }); this.notify(); throw error; }
  }
  create(projectPath?: string): Promise<string> { return this.openRuntime(() => this.client.createSession(projectPath)); }
  open(sessionPath: string): Promise<string> { return this.openRuntime(() => this.client.openSession(sessionPath)); }

  async waitForMessage(operation: string, description: string, after: number, predicate: (m: ServerMessage) => boolean): Promise<ServerMessage> {
    let found: ServerMessage | undefined;
    await this.wait(operation, description, () => {
      found = this.messages.slice(after).find(predicate);
      return Boolean(found);
    });
    return found!;
  }

  wait(operation: string, description: string, predicate: () => boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        this.changed.delete(check);
        if (error) reject(error); else resolve();
      };
      const check = () => {
        try {
          if (this.failure) return finish(new Error(`${operation}: ${this.failure.message}. Waiting for ${description}. ${this.diagnostics()}`));
          if (predicate()) finish();
        } catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
      };
      const timer = setTimeout(() => finish(new Error(`${operation}: timed out waiting for ${description}. ${this.diagnostics()}`)), this.timeoutMs);
      this.changed.add(check);
      check();
    });
  }

  async waitForClose(): Promise<void> {
    if (this.closeInfo) return;
    await new Promise<void>(resolve => this.socket!.once("close", () => resolve()));
  }

  async close(): Promise<void> {
    const socket = this.socket;
    if (!socket || socket.readyState === WebSocket.CLOSED) { this.client.dispose(); return; }
    this.closing = true;
    // Reject outstanding command waiters instead of leaving them until timeout.
    this.failure ??= new Error("Client disposed");
    this.notify();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.terminate();
        reject(new Error(`Browser.Close: timed out. ${this.diagnostics()}`));
      }, this.timeoutMs);
      socket.once("close", () => { clearTimeout(timer); resolve(); });
      this.client.dispose();
    });
  }
}
