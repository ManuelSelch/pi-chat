import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { ActionRegistry, ChatMessage, PiChatExtensions, ThinkingLevel, ToolCard, UiPrompt, UiPromptResult, Widget } from "../shared/protocol.js";
import { UiPromptRegistry } from "./ui-prompt-registry.js";
import { createWebUiContext } from "./web-ui-context.js";

export type RuntimeEvent =
  | { type: "assistantDelta"; runId: string; delta: string }
  | { type: "thinkingDelta"; runId: string; delta: string }
  | { type: "messageFinal"; runId: string; message: ChatMessage }
  | { type: "toolEvent"; runId: string; tool: ToolCard }
  | { type: "notification"; level: "info" | "warning" | "error"; message: string }
  | { type: "prompts"; prompts: UiPrompt[] }
  | { type: "widgets"; widgets: Widget[] }
  | { type: "runtimeStatus"; status: "idle" | "running" | "aborting"; error?: string };

export interface RuntimeSnapshot {
  sessionId: string;
  sessionPath?: string;
  sessionName?: string;
  projectPath: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  actions: ActionRegistry;
  prompts: UiPrompt[];
  /** Extension panels from `ctx.ui.setWidget`, rendered around the composer. */
  widgets: Widget[];
  /** Declarative Pi Chat web extension contributions such as slot buttons. */
  extensions?: PiChatExtensions;
  /**
   * How the last turn failed, kept until the next one starts. A snapshot that
   * omitted it erased the message the browser had just shown, which is why a
   * context-limit error used to flash and disappear.
   */
  lastError?: string;
}

export interface RuntimeAdapter {
  snapshot(): RuntimeSnapshot;
  /**
   * This session's dialog surface, so an extension action can ask a question in
   * the session whose button was pressed. Each adapter has its own: a context
   * held from elsewhere posts its modal into another session's prompt list, or
   * into a disposed one once that session is closed.
   */
  uiContext(): ExtensionUIContext;
  prompt(message: string): Promise<void>;
  abort(): Promise<void>;
  respondToPrompt(promptId: string, result: UiPromptResult): void;
  /** Called when no browser controls the session, and when one takes over again. */
  suspendPrompts(): void;
  resumePrompts(): void;
  renameSession(name: string): Promise<void> | void;
  setThinkingLevel(level: ThinkingLevel): Promise<void> | void;
  setModel(model: string): Promise<void>;
  compact(): Promise<void>;
  subscribe(listener: (event: RuntimeEvent) => void): () => void;
  dispose(): Promise<void> | void;
}

export class FakeRuntimeAdapter implements RuntimeAdapter {
  private readonly listeners = new Set<(event: RuntimeEvent) => void>();
  private messages: ChatMessage[] = [];
  private streaming = false;
  private run = 0;
  private ui?: ExtensionUIContext;
  /**
   * A real dialog stack, so a question an extension asks reaches a browser and
   * is answered by it. Auto-cancelling here instead would make every test of a
   * modal-driven flow pass without the modal ever existing.
   */
  private readonly promptRegistry = new UiPromptRegistry((prompts) => this.emit({ type: "prompts", prompts }));

  /** Named when a test needs two tabs: the registry keys them by session id. */
  constructor(private readonly id: string = "fake-session") {}

  snapshot(): RuntimeSnapshot {
    return {
      sessionId: this.id,
      sessionPath: `${this.id}.jsonl`,
      projectPath: process.cwd(),
      messages: [...this.messages],
      isStreaming: this.streaming,
      actions: {
        features: [
          { id: "session.rename", group: "session", kind: "form", title: "Rename session", state: { name: "" } },
          { id: "thinking.level", group: "model", kind: "select", title: "Thinking level", state: { value: "off", options: ["off"] } },
        ],
        commands: [{ name: "fake", description: "A command for tests" }],
      },
      prompts: this.promptRegistry.list(),
      widgets: [],
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

  async setModel(): Promise<void> {}

  async compact(): Promise<void> {}

  /**
   * Built once: a caller may compare the surface it was handed against the
   * session's own.
   */
  uiContext(): ExtensionUIContext {
    this.ui ??= createWebUiContext({
      onNotify: (message, level) => this.emit({ type: "notification", level, message }),
      onPrompt: (request) => this.promptRegistry.ask(request),
    });
    return this.ui;
  }

  respondToPrompt(promptId: string, result: UiPromptResult): void {
    this.promptRegistry.respond(promptId, result);
  }

  suspendPrompts(): void {
    this.promptRegistry.suspend();
  }

  resumePrompts(): void {
    this.promptRegistry.resume();
  }

  async abort(): Promise<void> {
    this.streaming = false;
    this.emit({ type: "runtimeStatus", status: "idle" });
  }

  renameSession(_name: string): void {}

  setThinkingLevel(_level: ThinkingLevel): void {}

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.promptRegistry.cancelAll();
    this.listeners.clear();
  }

  private emit(event: RuntimeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
