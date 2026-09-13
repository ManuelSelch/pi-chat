import type { ChatMessage, ToolCard } from "../shared/protocol.js";

export type RuntimeEvent =
  | { type: "assistantDelta"; runId: string; delta: string }
  | { type: "messageFinal"; runId: string; message: ChatMessage }
  | { type: "toolEvent"; runId: string; tool: ToolCard }
  | { type: "runtimeStatus"; status: "idle" | "running" | "aborting"; error?: string };

export interface RuntimeSnapshot {
  sessionId: string;
  sessionPath?: string;
  projectPath: string;
  messages: ChatMessage[];
  isStreaming: boolean;
}

export interface RuntimeAdapter {
  snapshot(): RuntimeSnapshot;
  prompt(message: string): Promise<void>;
  abort(): Promise<void>;
  subscribe(listener: (event: RuntimeEvent) => void): () => void;
  dispose(): Promise<void> | void;
}

export class FakeRuntimeAdapter implements RuntimeAdapter {
  private readonly listeners = new Set<(event: RuntimeEvent) => void>();
  private messages: ChatMessage[] = [];
  private streaming = false;
  private run = 0;

  snapshot(): RuntimeSnapshot {
    return {
      sessionId: "fake-session",
      sessionPath: "fake-session.jsonl",
      projectPath: process.cwd(),
      messages: [...this.messages],
      isStreaming: this.streaming,
    };
  }

  async prompt(message: string): Promise<void> {
    if (this.streaming) throw new Error("The runtime is already streaming");
    const runId = `fake-${++this.run}`;
    this.messages.push({ id: `${runId}-user`, role: "user", text: message });
    this.streaming = true;
    this.emit({ type: "runtimeStatus", status: "running" });
    this.emit({ type: "assistantDelta", runId, delta: "Hello " });
    this.emit({ type: "assistantDelta", runId, delta: "from Pi Chat." });
    const final = { id: `${runId}-assistant`, role: "assistant" as const, text: "Hello from Pi Chat." };
    this.messages.push(final);
    this.emit({ type: "messageFinal", runId, message: final });
    this.streaming = false;
    this.emit({ type: "runtimeStatus", status: "idle" });
  }

  async abort(): Promise<void> {
    this.streaming = false;
    this.emit({ type: "runtimeStatus", status: "idle" });
  }

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.listeners.clear();
  }

  private emit(event: RuntimeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
