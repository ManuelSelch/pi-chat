import type { ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import type { ActionRegistry, CommandCompletionItem, ChatMessage, FooterItem, PiChatExtensions, ThinkingLevel, ToolCard, UiPrompt, UiPromptResult, Widget } from "../../shared/protocol.js";

export type RuntimeEvent =
  | { type: "assistantDelta"; runId: string; delta: string }
  | { type: "thinkingDelta"; runId: string; delta: string }
  | { type: "messageFinal"; runId: string; message: ChatMessage }
  | { type: "toolEvent"; runId: string; tool: ToolCard }
  | { type: "notification"; level: "info" | "warning" | "error"; message: string }
  | { type: "prompts"; prompts: UiPrompt[] }
  | { type: "widgets"; widgets: Widget[] }
  | { type: "footer"; footer: FooterItem[] }
  | { type: "runtimeStatus"; status: "idle" | "running" | "aborting"; error?: string }
  | { type: "sessionMetadataChanged" }
  | { type: "sessionSwitch"; previousSessionId: string; sessionId: string };

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
  /**
   * The composer footer: what the session runs with, plus the labels extensions
   * pinned with `ctx.ui.setStatus`.
   */
  footer: FooterItem[];
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
  setThinkingLevel(level: ThinkingLevel): Promise<void> | void;
  setModel(model: string): Promise<void>;
  compact(): Promise<void>;
  completeCommandArguments(commandName: string, argumentPrefix: string): Promise<CommandCompletionItem[]>;
  subscribe(listener: (event: RuntimeEvent) => void): () => void;
  dispose(): Promise<void> | void;
}

export interface RuntimeAdapterFactory {
  continueProject(path: string): Promise<RuntimeAdapter>;
  openSession(path: string): Promise<RuntimeAdapter>;
  newSession(path: string): Promise<RuntimeAdapter>;
  invalidateExtensionCache?(): Promise<void>;
}
