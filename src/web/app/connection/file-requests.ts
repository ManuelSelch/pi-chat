import type { ClientMessage, ServerMessage } from "../../../shared/protocol.js";

type FileCommand = Extract<ClientMessage, { type: "openFile" }>;
interface Pending {
  sessionId: string;
  key: string;
  promise: Promise<void>;
  finish(error?: Error): void;
}
const cancelled = () => Object.assign(new Error("Stopped waiting for the file open on the server."), { name: "AbortError" });

/** Ephemeral user operations: bounded, deduplicated, never replayed. */
export class FileRequests {
  private readonly pending = new Map<string, Pending>();

  request(command: FileCommand, send: (command: ClientMessage) => void): Promise<void> {
    const key = JSON.stringify([command.sessionId, command.path]);
    const duplicate = [...this.pending.values()].find((entry) => entry.key === key);
    if (duplicate) return duplicate.promise;
    if (this.pending.size >= 32) return Promise.reject(new Error("Too many pending file opens on the server."));
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    const finish = (error?: Error) => {
      if (!this.pending.delete(command.requestId)) return;
      clearTimeout(timer);
      if (error) reject(error); else resolve();
    };
    const timer = setTimeout(() => finish(new Error("Stopped waiting for the server; the file may still open. No retry was sent.")), 10_000);
    this.pending.set(command.requestId, { sessionId: command.sessionId, key, promise, finish });
    try { send(command); } catch (error) { finish(error instanceof Error ? error : new Error("Unable to request a file open on the server.")); }
    return promise;
  }

  receive(message: ServerMessage): boolean {
    if (message.type !== "fileOpenResult") return false;
    const entry = this.pending.get(message.requestId);
    if (entry?.sessionId === message.sessionId) {
      entry.finish(message.result.ok ? undefined : new Error(message.result.error.message));
    }
    return true;
  }

  closeSession(sessionId: string): void {
    for (const entry of this.pending.values()) if (entry.sessionId === sessionId) entry.finish(cancelled());
  }

  retainSessions(sessionIds: string[]): void {
    for (const entry of this.pending.values()) if (!sessionIds.includes(entry.sessionId)) entry.finish(cancelled());
  }

  disconnect(): void {
    for (const entry of this.pending.values()) entry.finish(cancelled());
  }
}
