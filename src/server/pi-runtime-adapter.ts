import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  resolveCliModel,
  SessionManager,
  type AgentSessionRuntime,
  type AgentSessionServices,
  type CreateAgentSessionRuntimeFactory,
} from "@earendil-works/pi-coding-agent";
import type { ChatMessage, ThinkingLevel, ToolCard } from "../shared/protocol.js";

/** Derived from the SDK so no direct `@earendil-works/pi-ai` dependency is needed. */
type ModelOverride = Partial<
  Pick<Parameters<typeof createAgentSessionFromServices>[0], "model" | "thinkingLevel">
>;
import { AttachmentService, withReferences } from "./attachment-service.js";
import type { RuntimeAdapter, RuntimeEvent, RuntimeSnapshot } from "./runtime-adapter.js";

const ARGS_TEXT_MAX = 4_000;
const OUTPUT_TEXT_MAX = 20_000;

function clampText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}… [truncated]` : text;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Deterministic so a live tool event and a rebuilt snapshot never duplicate. */
export function toolMessageId(toolCallId: string): string {
  return `tool:${toolCallId}`;
}

interface ToolCallBlock {
  id: string;
  name: string;
  arguments?: unknown;
}

function toolCallsFromContent(content: unknown): ToolCallBlock[] {
  if (!Array.isArray(content)) return [];
  const calls: ToolCallBlock[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const value = part as Record<string, unknown>;
    if (value.type !== "toolCall" || typeof value.id !== "string" || value.id.length === 0) continue;
    calls.push({
      id: value.id,
      name: typeof value.name === "string" && value.name.length > 0 ? value.name : "tool",
      arguments: value.arguments,
    });
  }
  return calls;
}

/**
 * Merges flattened entries by id. A tool call appears twice in history — the
 * assistant's tool-call block (running, with arguments) and its toolResult
 * (final, with output) — so the merge keeps the latest status/output while
 * preserving argsText from the earlier entry.
 */
export function mergeEntriesById(flattened: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  const order: string[] = [];
  for (const entry of flattened) {
    if (!byId.has(entry.id)) order.push(entry.id);
    const previous = byId.get(entry.id);
    if (previous?.role === "tool" && entry.role === "tool") {
      byId.set(entry.id, {
        ...entry,
        tool: {
          ...previous.tool,
          ...entry.tool,
          ...(previous.tool.argsText !== undefined && entry.tool.argsText === undefined
            ? { argsText: previous.tool.argsText }
            : {}),
        },
      });
    } else {
      byId.set(entry.id, entry);
    }
  }
  return order.map((id) => byId.get(id)!);
}

export function toolCardFromCall(call: ToolCallBlock): ToolCard {
  return {
    toolCallId: call.id,
    name: call.name,
    status: "running",
    ...(call.arguments === undefined ? {} : { argsText: clampText(safeStringify(call.arguments), ARGS_TEXT_MAX) }),
  };
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const value = part as Record<string, unknown>;
      if (value.type === "text" && typeof value.text === "string") return value.text;
      return "";
    })
    .join("");
}

/**
 * Stable per-message identity.
 *
 * Ids must match whether a message is first seen as a live `message_end` event
 * or later read back from `session.messages` for a snapshot, otherwise a reload
 * would duplicate messages the client already holds. Pi hands out the same
 * object in both paths, so identity is keyed on the object itself rather than
 * on its position, timestamp, or text.
 */
export class MessageIdentity {
  private readonly ids = new WeakMap<object, string>();
  private next = 0;

  idFor(message: object): string {
    const existing = this.ids.get(message);
    if (existing) return existing;
    const id = `msg-${++this.next}`;
    this.ids.set(message, id);
    return id;
  }
}

/**
 * Maps one Pi session message to zero or more transcript entries.
 *
 * - user/system/assistant text becomes one text entry.
 * - an assistant tool-call block becomes a *running* tool entry; the matching
 *   toolResult message, which follows in session order, overwrites it as
 *   success/error, so flattening the whole session in order yields final cards.
 * - an assistant message with neither text nor tool calls yields nothing, so a
 *   failed turn never leaves an empty bubble.
 */
export function toChatMessages(message: unknown, identity: MessageIdentity): ChatMessage[] {
  if (!message || typeof message !== "object") return [];
  const value = message as Record<string, unknown>;
  const timestamp = typeof value.timestamp === "number" ? value.timestamp : undefined;
  const stamp = timestamp === undefined ? {} : { timestamp };

  if (value.role === "toolResult") {
    if (typeof value.toolCallId !== "string" || value.toolCallId.length === 0) return [];
    const output = textFromContent(value.content).trim();
    return [
      {
        id: toolMessageId(value.toolCallId),
        role: "tool",
        tool: {
          toolCallId: value.toolCallId,
          name: typeof value.toolName === "string" && value.toolName.length > 0 ? value.toolName : "tool",
          status: value.isError === true ? "error" : "success",
          ...(output ? { outputText: clampText(output, OUTPUT_TEXT_MAX) } : {}),
        },
        ...stamp,
      },
    ];
  }

  if (value.role !== "user" && value.role !== "assistant" && value.role !== "system") return [];

  const entries: ChatMessage[] = [];
  const text = textFromContent(value.content);
  if (text.length > 0) {
    entries.push({ id: identity.idFor(message), role: value.role, text, ...stamp });
  }
  for (const call of toolCallsFromContent(value.content)) {
    entries.push({ id: toolMessageId(call.id), role: "tool", tool: toolCardFromCall(call), ...stamp });
  }
  return entries;
}

/** @deprecated single-text-entry view, kept for callers that only want text */
export function toChatMessage(message: unknown, identity: MessageIdentity): ChatMessage | undefined {
  return toChatMessages(message, identity).find((entry) => entry.role !== "tool");
}

export class PiRuntimeAdapter implements RuntimeAdapter {
  private readonly listeners = new Set<(event: RuntimeEvent) => void>();
  private readonly identity = new MessageIdentity();
  private unsubscribe?: () => void;
  private currentRunId = "";
  /** toolCallIds between tool_execution_start and end; only those may stay "running" in a snapshot. */
  private readonly inFlightTools = new Set<string>();
  /**
   * A failed turn ends as an ordinary `message_end` with `stopReason: "error"`,
   * so without this the UI shows an empty assistant bubble and no reason. Held
   * until the run settles, because `agent_settled` publishes the final status.
   */
  private lastError?: string;
  private readonly attachments = new AttachmentService();

  private constructor(private readonly runtime: AgentSessionRuntime) {
    this.bindSession();
  }

  /**
   * `PI_CHAT_MODEL` overrides the model for this server only, so testing a
   * specific provider never edits the user's global Pi settings. Accepts the
   * same spelling as the CLI, e.g. `doppelclaude/claude-opus-5`, optionally
   * suffixed with a thinking level (`:high`).
   *
   * It must resolve against the services' runtime, not a bare `ModelRuntime`:
   * providers contributed by extensions (doppelclaude among them) only exist
   * once the resource loader has run.
   */
  private static resolveOverride(services: AgentSessionServices): ModelOverride {
    const requested = process.env.PI_CHAT_MODEL?.trim();
    if (!requested) return {};

    const resolved = resolveCliModel({ cliModel: requested, modelRuntime: services.modelRuntime });
    if (resolved.error) throw new Error(`PI_CHAT_MODEL=${requested}: ${resolved.error}`);
    if (resolved.warning) console.warn(`PI_CHAT_MODEL: ${resolved.warning}`);
    if (!resolved.model) throw new Error(`PI_CHAT_MODEL=${requested}: no matching model`);

    console.log(`Model: ${resolved.model.provider}/${resolved.model.id}`);
    return {
      model: resolved.model,
      ...(resolved.thinkingLevel ? { thinkingLevel: resolved.thinkingLevel } : {}),
    };
  }

  static async create(cwd: string): Promise<PiRuntimeAdapter> {
    return PiRuntimeAdapter.fromSessionManager(cwd, SessionManager.continueRecent(cwd));
  }

  static async openSession(path: string): Promise<PiRuntimeAdapter> {
    const sessionManager = SessionManager.open(path);
    return PiRuntimeAdapter.fromSessionManager(sessionManager.getCwd(), sessionManager);
  }

  static async newSession(cwd: string): Promise<PiRuntimeAdapter> {
    return PiRuntimeAdapter.fromSessionManager(cwd, SessionManager.create(cwd));
  }

  private static async fromSessionManager(cwd: string, sessionManager: SessionManager): Promise<PiRuntimeAdapter> {
    const agentDir = getAgentDir();
    const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd: targetCwd, sessionManager, sessionStartEvent }) => {
      const services = await createAgentSessionServices({ cwd: targetCwd, agentDir });
      const override = PiRuntimeAdapter.resolveOverride(services);
      return {
        ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent, ...override })),
        services,
        diagnostics: services.diagnostics,
      };
    };

    const runtime = await createAgentSessionRuntime(createRuntime, { cwd, agentDir, sessionManager });
    return new PiRuntimeAdapter(runtime);
  }

  snapshot(): RuntimeSnapshot {
    const flattened = this.runtime.session.messages.flatMap((message) => toChatMessages(message, this.identity));
    const messages = mergeEntriesById(flattened);
    const isStreaming = this.runtime.session.isStreaming;
    // A "running" card is only honest while its tool is actually executing.
    // After a server restart mid-run (or any missed end event) nothing will
    // ever finalize it, so report it as interrupted instead of spinning forever.
    for (const entry of messages) {
      if (entry.role === "tool" && entry.tool.status === "running" && !this.inFlightTools.has(entry.tool.toolCallId)) {
        entry.tool = {
          ...entry.tool,
          status: "error",
          ...(entry.tool.outputText === undefined ? { outputText: "Tool run was interrupted before its result was recorded." } : {}),
        };
      }
    }
    return {
      sessionId: this.runtime.session.sessionId,
      ...(this.runtime.session.sessionFile ? { sessionPath: this.runtime.session.sessionFile } : {}),
      ...(this.runtime.session.sessionName ? { sessionName: this.runtime.session.sessionName } : {}),
      projectPath: this.runtime.cwd,
      messages,
      isStreaming,
      actions: {
        features: [
          {
            id: "session.rename",
            group: "session",
            kind: "form",
            title: "Rename session",
            description: "Set the display name shown in Pi session lists.",
            state: { name: this.runtime.session.sessionName ?? "" },
          },
          {
            id: "thinking.level",
            group: "model",
            kind: "select",
            title: "Thinking level",
            description: "Change the reasoning effort for the current session when the model supports it.",
            state: {
              value: this.runtime.session.thinkingLevel as ThinkingLevel,
              options: this.runtime.session.getAvailableThinkingLevels() as ThinkingLevel[],
            },
          },
        ],
      },
    };
  }

  async prompt(message: string, attachments: readonly string[] = []): Promise<void> {
    this.lastError = undefined;
    if (attachments.length === 0) {
      await this.runtime.session.prompt(message);
      return;
    }
    // Resolution can reject (missing path, folder), and that must surface before
    // the run starts rather than as an unexplained model answer.
    const { images, references } = await this.attachments.resolve(attachments, this.snapshot().projectPath);
    await this.runtime.session.prompt(withReferences(message, references), images.length > 0 ? { images } : undefined);
  }

  async abort(): Promise<void> {
    this.emit({ type: "runtimeStatus", status: "aborting" });
    await this.runtime.session.abort();
  }

  renameSession(name: string): void {
    this.runtime.session.setSessionName(name);
  }

  setThinkingLevel(level: ThinkingLevel): void {
    this.runtime.session.setThinkingLevel(level);
  }

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    this.unsubscribe?.();
    this.listeners.clear();
    await this.runtime.dispose();
  }

  private bindSession(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.runtime.session.subscribe((event) => {
      if (event.type === "agent_start") {
        this.currentRunId = crypto.randomUUID();
        this.emit({ type: "runtimeStatus", status: "running" });
        return;
      }
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        this.emit({ type: "assistantDelta", runId: this.currentRunId, delta: event.assistantMessageEvent.delta });
        return;
      }
      if (event.type === "message_end") {
        const failure = event.message as { stopReason?: string; errorMessage?: string };
        if (failure.stopReason === "error") {
          this.lastError = failure.errorMessage?.trim() || "The model ended the turn with an error.";
        }
        // Tool entries come from tool_execution events instead, so only text
        // entries become messageFinal here; a tool-call-only assistant message
        // therefore does not leave an empty bubble.
        const final = toChatMessage(event.message, this.identity);
        if (final && (final.role === "user" || final.role === "assistant")) {
          this.emit({ type: "messageFinal", runId: this.currentRunId, message: final });
        }
        return;
      }
      if (event.type === "tool_execution_start") {
        this.inFlightTools.add(event.toolCallId);
        this.emit({
          type: "toolEvent",
          runId: this.currentRunId,
          tool: toolCardFromCall({ id: event.toolCallId, name: event.toolName, arguments: event.args }),
        });
        return;
      }
      if (event.type === "tool_execution_update") {
        const output = textFromContent((event.partialResult as { content?: unknown })?.content).trim();
        this.emit({
          type: "toolEvent",
          runId: this.currentRunId,
          tool: {
            toolCallId: event.toolCallId,
            name: event.toolName,
            status: "running",
            ...(output ? { outputText: clampText(output, OUTPUT_TEXT_MAX) } : {}),
          },
        });
        return;
      }
      if (event.type === "tool_execution_end") {
        this.inFlightTools.delete(event.toolCallId);
        const output = textFromContent((event.result as { content?: unknown })?.content).trim();
        this.emit({
          type: "toolEvent",
          runId: this.currentRunId,
          tool: {
            toolCallId: event.toolCallId,
            name: event.toolName,
            status: event.isError ? "error" : "success",
            ...(output ? { outputText: clampText(output, OUTPUT_TEXT_MAX) } : {}),
          },
        });
        return;
      }
      if (event.type === "agent_settled") {
        const error = this.lastError;
        this.lastError = undefined;
        this.emit({ type: "runtimeStatus", status: "idle", ...(error ? { error } : {}) });
      }
    });
  }

  private emit(event: RuntimeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
