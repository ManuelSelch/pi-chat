import type { ClientMessage, ServerMessage } from "../../../shared/protocol.js";

type FolderReply = Extract<ServerMessage, { requestId: string }>;
type FolderCommand = Extract<ClientMessage, { type: "newSession" | "browseDirectories" }> & { requestId: string };

/** Request-scoped state stays outside transcript snapshots and is disposed on disconnect. */
export class FolderRequests {
  private readonly pending = new Map<string, { resolve: (reply: FolderReply) => void; reject: (error: Error) => void }>();

  request(command: FolderCommand, send: (command: ClientMessage) => void, signal?: AbortSignal): Promise<FolderReply> {
    return new Promise((resolve, reject) => {
      const cancel = () => finish(undefined, new Error("Folder request cancelled."));
      const finish = (reply?: FolderReply, error?: Error) => {
        this.pending.delete(command.requestId);
        signal?.removeEventListener("abort", cancel);
        if (error) reject(error);
        else resolve(reply!);
      };
      if (signal?.aborted) { reject(new Error("Folder request cancelled.")); return; }
      this.pending.set(command.requestId, { resolve: (reply) => finish(reply), reject: (error) => finish(undefined, error) });
      signal?.addEventListener("abort", cancel, { once: true });
      try { send(command); } catch (error) { finish(undefined, error instanceof Error ? error : new Error("Unable to send folder request.")); }
    });
  }

  receive(message: ServerMessage): boolean {
    if (!("requestId" in message)) return false;
    const pending = this.pending.get(message.requestId);
    if (pending) {
      if ("error" in message) pending.reject(new Error(message.error));
      else pending.resolve(message);
    }
    return true;
  }

  disconnect(): void {
    for (const pending of this.pending.values()) pending.reject(new Error("Connection lost. Reconnect to browse server folders."));
    this.pending.clear();
  }
}
