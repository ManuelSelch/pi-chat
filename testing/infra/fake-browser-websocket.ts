import type { Request, SessionSnapshot, ProjectCatalogue } from "@manuelselch/pi-sdk";
import { initializeResult, snapshotData } from "./v2-fixtures.js";
/** Browser transport double: frames are real v2 envelopes, never translated legacy fixtures. */
export class FakeBrowserWebSocket extends EventTarget {
  static CONNECTING = 0; static OPEN = 1; static CLOSED = 3;
  static instances: FakeBrowserWebSocket[] = [];
  static get current(): FakeBrowserWebSocket { return this.instances.at(-1)!; }
  bufferedAmount = 0; readyState = 0; closedWhileConnecting = false;
  readonly sent: string[] = [];
  get requests(): Request[] { return this.sent.map(text => JSON.parse(text)); }
  constructor(readonly url: string) { super(); FakeBrowserWebSocket.instances.push(this); }
  send(text: string): void { this.sent.push(text); }
  acceptConnection(): void { this.readyState = 1; this.dispatchEvent(new Event("open")); }
  initialize(snapshots: SessionSnapshot[] = [snapshotData({ sessionId: "s" })], catalogue?: ProjectCatalogue): void {
    const request = this.requests.findLast(request => request.method === "server.initialize")!; this.reply(initializeResult(snapshots, catalogue), request.requestId);
  }
  reply(result: unknown, requestId = this.requests.at(-1)!.requestId): void { this.deliver({ version: 2, type: "response", requestId, ok: true, result }); }
  reject(code: string, message: string, requestId = this.requests.at(-1)!.requestId): void { this.deliver({ version: 2, type: "response", requestId, ok: false, error: { code, message } }); }
  deliver(value: unknown): void { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(value) })); }
  close(code = 1000, reason = "", wasClean = true): void { if (this.readyState === 0) this.closedWhileConnecting = true; if (this.readyState === 3) return; this.readyState = 3; this.dispatchEvent(new CloseEvent("close", { code, reason, wasClean })); }
  replaceByNewController(): void { this.close(4001); }
  refuseConnection(): void { this.dispatchEvent(new Event("error")); this.close(); }
}
