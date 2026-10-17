import type { ClientMessage, CommandCompletionItem, ServerMessage } from "../contract/index.js";
import type { SDKError } from "../errors.js";
import type { CancellationSignal } from "../platform.js";
import { PendingRequests, type TrackerOptions } from "./pending-requests.js";

type CompletionCommand = Extract<ClientMessage, { type: "completeCommandArguments" }>;
export class CompletionRequests {
  private readonly pending: PendingRequests<CommandCompletionItem[]>;
  constructor(options: TrackerOptions = {}) { this.pending = new PendingRequests(options, { cancelled: "Completion cancelled.", disconnected: "Connection lost." }); }
  request(command: CompletionCommand, send: (command: ClientMessage) => void, signal?: CancellationSignal): Promise<CommandCompletionItem[]> {
    return this.pending.request(command.requestId, { sessionId: command.sessionId }, () => send(command), signal);
  }
  receive(message: ServerMessage): boolean {
    if (message.type !== "commandArgumentCompletions") return false;
    if (this.pending.get(message.requestId)?.sessionId === message.sessionId) {
      if (message.error) this.pending.reject(message.requestId, message.error);
      else this.pending.resolve(message.requestId, message.items);
    }
    return true;
  }
  closeSession(sessionId: string): void { this.pending.closeSession(sessionId); }
  retainSessions(ids: readonly string[]): void { this.pending.retainSessions(ids); }
  disconnect(reason?: SDKError): void { this.pending.disconnect(reason); }
}
