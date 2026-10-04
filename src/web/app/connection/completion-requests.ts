import type { ClientMessage, CommandCompletionItem, ServerMessage } from "../../../shared/protocol.js";

type CompletionCommand = Extract<ClientMessage, { type: "completeCommandArguments" }>;

/** Ephemeral replies never enter the transcript reducer. */
export class CompletionRequests {
  private readonly pending = new Map<string, { sessionId: string; resolve: (items: CommandCompletionItem[]) => void; reject: (error: Error) => void }>();

  request(command: CompletionCommand, send: (command: ClientMessage) => void, signal?: AbortSignal): Promise<CommandCompletionItem[]> {
    return new Promise((resolve, reject) => {
      const cancel = () => finish(undefined, new Error("Completion cancelled."));
      const finish = (items?: CommandCompletionItem[], error?: Error) => {
        this.pending.delete(command.requestId);
        signal?.removeEventListener("abort", cancel);
        if (error) reject(error);
        else resolve(items!);
      };
      if (signal?.aborted) { reject(new Error("Completion cancelled.")); return; }
      this.pending.set(command.requestId, { sessionId: command.sessionId, resolve: (items) => finish(items), reject: (error) => finish(undefined, error) });
      signal?.addEventListener("abort", cancel, { once: true });
      try { send(command); } catch (error) { finish(undefined, error instanceof Error ? error : new Error("Unable to request completions.")); }
    });
  }

  receive(message: ServerMessage): boolean {
    if (message.type !== "commandArgumentCompletions") return false;
    const pending = this.pending.get(message.requestId);
    if (pending?.sessionId === message.sessionId) {
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.items);
    }
    return true;
  }

  disconnect(): void {
    for (const pending of this.pending.values()) pending.reject(new Error("Connection lost."));
    this.pending.clear();
  }
}
