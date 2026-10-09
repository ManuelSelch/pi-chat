import type { ClientMessage, ServerMessage } from "../../../shared/protocol.js";
type ProjectCommand = Extract<ClientMessage, { type: "setSessionArchived" | "pinProject" }>;

/** Correlated success matters: do not offer Undo for a write the server refused. */
export class ProjectRequests {
  private readonly pending = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();

  request(command: ProjectCommand, send: (command: ClientMessage) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pending.set(command.requestId, { resolve, reject });
      try { send(command); }
      catch (error) {
        this.pending.delete(command.requestId);
        reject(error instanceof Error ? error : new Error("Unable to send project request."));
      }
    });
  }

  receive(message: ServerMessage): boolean {
    if (message.type !== "projectMutationResult") return false;
    const pending = this.pending.get(message.requestId);
    this.pending.delete(message.requestId);
    if (message.error !== undefined) pending?.reject(new Error(message.error));
    else pending?.resolve();
    return true;
  }

  disconnect(): void {
    for (const pending of this.pending.values()) pending.reject(new Error("Connection lost. Check the project panel after reconnecting."));
    this.pending.clear();
  }
}
