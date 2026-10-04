import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { parseBashInput } from "../../src/shared/bash-input.js";
import type { ChatMessage, ThinkingLevel, UiPromptResult } from "../../src/shared/protocol.js";
import type { RuntimeAdapter, RuntimeEvent, RuntimeSnapshot } from "../../src/server/runtime/contracts.js";
import { UiPromptRegistry } from "../../src/server/extensions/ui/ui-prompt-registry.js";
import { createWebUiContext } from "../../src/server/runtime/pi/web-ui-context.js";

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
      footer: [],
    };
  }

  async prompt(message: string): Promise<void> {
    if (this.streaming) throw new Error("The runtime is already streaming");
    const runId = `fake-${++this.run}`;
    const bash = parseBashInput(message);
    if (bash) {
      if (!bash.command.trim()) throw new Error("Bash command is empty.");
      this.messages.push({ id: runId, role: "bash", bash: { ...bash, output: "Fake bash output\n", status: "success", exitCode: 0, truncated: false } });
      return;
    }
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
