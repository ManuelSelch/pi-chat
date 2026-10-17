import type { ClientMessage, ServerMessage } from "../contract/index.js";
import type { SDKError } from "../errors.js";
import type { CancellationSignal } from "../platform.js";
import { PendingRequests, type TrackerOptions } from "./pending-requests.js";

type FileCommand = Extract<ClientMessage, { type: "openFile" }>;
export class FileRequests {
  private readonly pending: PendingRequests<void>;
  constructor(options: TrackerOptions = {}) {
    this.pending = new PendingRequests({ maxPending: 32, timeoutMs: 10_000, ...options }, {
      cancelled: "Stopped waiting for the file open on the server.", disconnected: "Stopped waiting for the file open on the server.",
      timeout: "Stopped waiting for the server; the file may still open. No retry was sent.", abortName: true,
    });
  }
  request(command: FileCommand, send: (command: ClientMessage) => void, signal?: CancellationSignal): Promise<void> {
    // Independent cancellable callers must not cancel one another's waits.
    const key = signal ? undefined : JSON.stringify([command.sessionId, command.path]);
    const duplicate = key === undefined ? undefined : this.pending.findKey(key);
    return duplicate ?? this.pending.request(command.requestId, { sessionId: command.sessionId, key }, () => send(command), signal);
  }
  receive(message: ServerMessage): boolean {
    if (message.type !== "fileOpenResult") return false;
    if (this.pending.get(message.requestId)?.sessionId === message.sessionId) {
      if (message.result.ok) this.pending.resolve(message.requestId, undefined);
      else this.pending.reject(message.requestId, message.result.error.message);
    }
    return true;
  }
  closeSession(sessionId: string): void { this.pending.closeSession(sessionId); }
  retainSessions(ids: readonly string[]): void { this.pending.retainSessions(ids); }
  disconnect(reason?: SDKError): void { this.pending.disconnect(reason); }
}
