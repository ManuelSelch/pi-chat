import type { ClientMessage, ServerMessage } from "../contract/index.js";
import type { SDKError } from "../errors.js";
import type { CancellationSignal } from "../platform.js";
import { PendingRequests, type TrackerOptions } from "./pending-requests.js";

type FolderReply = Extract<ServerMessage, { type: "directoryListing" | "directoryBrowseError" | "sessionOpened" | "sessionOpenError" }>;
type FolderCommand = Extract<ClientMessage, { type: "newSession" | "browseDirectories" }> & { requestId: string };

export class FolderRequests {
  private readonly pending: PendingRequests<FolderReply>;
  constructor(options: TrackerOptions = {}) { this.pending = new PendingRequests(options, { cancelled: "Folder request cancelled.", disconnected: "Connection lost. Reconnect to browse server folders." }); }
  request(command: FolderCommand, send: (command: ClientMessage) => void, signal?: CancellationSignal): Promise<FolderReply> {
    return this.pending.request(command.requestId, { kind: command.type }, () => send(command), signal);
  }
  receive(message: ServerMessage): boolean {
    if (message.type !== "directoryListing" && message.type !== "directoryBrowseError" && message.type !== "sessionOpened" && message.type !== "sessionOpenError") return false;
    const entry = this.pending.get(message.requestId);
    const kind = message.type === "sessionOpened" || message.type === "sessionOpenError" ? "newSession" : "browseDirectories";
    if (entry?.kind === kind) {
      if ("error" in message) this.pending.reject(message.requestId, message.error);
      else this.pending.resolve(message.requestId, message);
    }
    return true;
  }
  disconnect(reason?: SDKError): void { this.pending.disconnect(reason); }
}
