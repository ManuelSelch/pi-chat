import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { clientMessageSchema, serverMessageSchema, type ClientMessage, type ServerMessage } from "../../../src/shared/protocol.js";
import { activeSession, initialAppState, reduceAppMessage, type AppState } from "../../../src/web/app/state/app-state.js";
import type { PiChatServer } from "../../../src/server/bootstrap/server.js";

/** Private implementation detail: domain tests never send protocol messages. */
export class BrowserClient {
  private state: AppState = initialAppState;
  private readonly messages: ServerMessage[] = [];
  private readonly changed = new Set<() => void>();
  private failure?: Error;
  private closing = false;
  private closeInfo?: { code: number; reason: string };
  private readonly socket: WebSocket;

  constructor(server: PiChatServer, private readonly timeoutMs: number) {
    const port = (server.httpServer.address() as AddressInfo).port;
    this.socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.socket.on("message", data => {
      try {
        const message = serverMessageSchema.parse(JSON.parse(data.toString()));
        this.messages.push(message);
        // Use the actual browser reducers, including sequencing/deduplication.
        this.state = reduceAppMessage(this.state, message);
        if (message.type === "protocolError") this.failure = new Error(message.error);
      } catch (error) {
        this.failure = error instanceof Error ? error : new Error(String(error));
      }
      this.notify();
    });
    this.socket.on("error", error => { this.failure = error; this.notify(); });
    this.socket.on("close", (code, reason) => {
      this.closeInfo = { code, reason: reason.toString() };
      this.state = reduceAppMessage(this.state, { type: "connectionLost" });
      if (!this.closing) this.failure ??= new Error(`Connection closed: ${code} ${reason}`);
      this.notify();
    });
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
      if (this.socket.readyState !== WebSocket.OPEN || !this.state.tabsKnown) return false;
      if (!this.state.activeSessionId) return this.state.tabs.length === 0 && this.messages.some(m => m.type === "catalogue");
      return this.state.tabs.some(tab => tab.sessionId === this.state.activeSessionId) &&
        this.state.tabs.every(tab => this.state.sessions[tab.sessionId]?.sessionId === tab.sessionId);
    });
  }

  send(message: ClientMessage): void {
    if (this.socket.readyState !== WebSocket.OPEN) throw new Error(`Client is not connected: ${this.diagnostics()}`);
    this.socket.send(JSON.stringify(clientMessageSchema.parse(message)));
  }

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

  async close(): Promise<void> {
    if (this.socket.readyState === WebSocket.CLOSED) return;
    this.closing = true;
    // Reject outstanding command waiters instead of leaving them until timeout.
    this.failure ??= new Error("Client disposed");
    this.notify();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.terminate();
        reject(new Error(`Browser.Close: timed out. ${this.diagnostics()}`));
      }, this.timeoutMs);
      this.socket.once("close", () => { clearTimeout(timer); resolve(); });
      if (this.socket.readyState === WebSocket.CONNECTING) this.socket.terminate();
      else this.socket.close();
    });
  }
}
