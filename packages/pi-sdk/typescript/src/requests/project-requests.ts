import type { ClientMessage, ServerMessage } from "../contract/index.js";
import type { SDKError } from "../errors.js";
import type { CancellationSignal } from "../platform.js";
import { PendingRequests, type TrackerOptions } from "./pending-requests.js";

type ProjectCommand = Extract<ClientMessage, { type: "setSessionArchived" | "pinProject" | "removeProject" }>;
export class ProjectRequests {
  private readonly pending: PendingRequests<void>;
  constructor(options: TrackerOptions = {}) { this.pending = new PendingRequests(options, { cancelled: "Project request cancelled.", disconnected: "Connection lost. Check the project panel after reconnecting." }); }
  request(command: ProjectCommand, send: (command: ClientMessage) => void, signal?: CancellationSignal): Promise<void> {
    return this.pending.request(command.requestId, {}, () => send(command), signal);
  }
  receive(message: ServerMessage): boolean {
    if (message.type !== "projectMutationResult") return false;
    if (message.error !== undefined) this.pending.reject(message.requestId, message.error);
    else this.pending.resolve(message.requestId, undefined);
    return true;
  }
  disconnect(reason?: SDKError): void { this.pending.disconnect(reason); }
}
