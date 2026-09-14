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
import type { ChatMessage, SlashCommand, ThinkingLevel, ToolCard, UiPromptResult } from "../shared/protocol.js";

/** Derived from the SDK so no direct `@earendil-works/pi-ai` dependency is needed. */
type ModelOverride = Partial<
  Pick<Parameters<typeof createAgentSessionFromServices>[0], "model" | "thinkingLevel">
>;
import type { RuntimeAdapter, RuntimeEvent, RuntimeSnapshot } from "./runtime-adapter.js";
import { UiPromptRegistry } from "./ui-prompt-registry.js";
import { createWebUiContext } from "./web-ui-context.js";
import { WidgetRegistry } from "./widget-registry.js";

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

/** Built-ins this host implements, surfaced in the web command menu. */
const NATIVE_COMMANDS: SlashCommand[] = [
  { name: "model", description: "Switch the model for this session" },
  { name: "session", description: "Show session stats, token use, and context window" },
  { name: "thinking", description: "Set the reasoning effort for this session" },
  { name: "compact", description: "Summarise the conversation to free up context" },
];

/**
 * Pi's built-in slash commands. They are implemented by the terminal app, so a
 * web host must either provide its own version or say plainly that it cannot.
 *
 * `reload` is absent on purpose: the chat service implements it by rebuilding
 * this runtime, which an adapter cannot do to itself.
 */
const PI_BUILTIN_COMMANDS = new Set([
  "settings", "model", "tree", "thinking", "scoped-models", "export", "import", "share", "copy",
  "name", "session", "changelog", "hotkeys", "fork", "clone", "trust", "login", "logout", "new",
  "compact", "resume", "quit",
]);

/** The parts of Pi's `SessionStats` this host reports, kept structural for tests. */
export interface SessionStatsView {
  sessionId: string;
  sessionFile?: string | undefined;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  cost: number;
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null } | undefined;
}

/**
 * The terminal prints this with box drawing and colour; the web transcript
 * renders markdown, so the same numbers are laid out as a definition list.
 * Context usage is absent until the model reports it (right after compaction,
 * for instance), and the line is dropped rather than shown as unknown.
 */
export function sessionStatsMarkdown(stats: SessionStatsView, sessionName?: string, model?: string): string {
  const count = (value: number) => value.toLocaleString("en-US");
  const { input, output, cacheRead, cacheWrite, total } = stats.tokens;
  const prompt = input + cacheRead + cacheWrite;
  const lines = [
    "**Session**",
    ...(sessionName ? [`- Name: ${sessionName}`] : []),
    ...(model ? [`- Model: ${model}`] : []),
    `- File: ${stats.sessionFile ?? "in memory"}`,
    `- ID: ${stats.sessionId}`,
    "",
    "**Messages**",
    `- Total: ${count(stats.totalMessages)} (${count(stats.userMessages)} user, ${count(stats.assistantMessages)} assistant)`,
    `- Tools: ${count(stats.toolCalls)} calls, ${count(stats.toolResults)} results`,
    "",
    "**Tokens**",
    `- Input: ${count(prompt)}`,
    // Only meaningful once the provider actually reports cache activity.
    ...(prompt > 0 && (cacheRead > 0 || cacheWrite > 0)
      ? [
          `  - Cached: ${count(cacheRead)} (${((cacheRead / prompt) * 100).toFixed(1)}%)`,
          `  - Uncached: ${count(input + cacheWrite)}`,
        ]
      : []),
    `- Output: ${count(output)}`,
    `- Total: ${count(total)}`,
  ];
  const usage = stats.contextUsage;
  if (usage && usage.tokens !== null) {
    const percent = usage.percent ?? (usage.contextWindow > 0 ? (usage.tokens / usage.contextWindow) * 100 : 0);
    lines.push("", "**Context**", `- Used: ${count(usage.tokens)} of ${count(usage.contextWindow)} (${percent.toFixed(1)}%)`);
  }
  if (stats.cost > 0) lines.push("", "**Cost**", `- Total: $${stats.cost.toFixed(3)}`);
  return lines.join("\n");
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

export function appendCustomEntries(messages: ChatMessage[], branch: Iterable<unknown>): ChatMessage[] {
  // `runtime.session.messages` may contain the in-memory custom message with a
  // WeakMap id, but the session branch contains the durable entry id. Snapshots
  // use the durable form so a reconnect or refresh never duplicates it.
  const nonCustomMessages = messages.filter((entry) => entry.role !== "custom");
  const custom = Array.from(branch, customMessageFromEntry).filter((entry) => entry !== undefined);
  return mergeEntriesById([...nonCustomMessages, ...custom]);
}

export function toolCardFromCall(call: ToolCallBlock): ToolCard {
  return {
    toolCallId: call.id,
    name: call.name,
    status: "running",
    ...(call.arguments === undefined ? {} : { argsText: clampText(safeStringify(call.arguments), ARGS_TEXT_MAX) }),
  };
}

function timestampFromEntry(value: Record<string, unknown>): { timestamp?: number } {
  if (typeof value.timestamp !== "string") return {};
  const timestamp = Date.parse(value.timestamp);
  return Number.isFinite(timestamp) ? { timestamp } : {};
}

export function customMessageFromEntry(entry: unknown): ChatMessage | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const value = entry as Record<string, unknown>;
  if (value.type !== "custom_message") return undefined;
  if (value.display !== true || typeof value.customType !== "string" || value.customType.length === 0) return undefined;
  if (typeof value.id !== "string" || value.id.length === 0) return undefined;
  const text = textFromContent(value.content);
  if (text.length === 0) return undefined;
  return { id: value.id, role: "custom", customType: value.customType, text, ...timestampFromEntry(value) };
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

  if (value.role === "custom") {
    if (value.display !== true || typeof value.customType !== "string" || value.customType.length === 0) return [];
    const text = textFromContent(value.content);
    if (text.length === 0) return [];
    return [{ id: identity.idFor(message), role: "custom", customType: value.customType, text, ...stamp }];
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
   * so without this the UI shows an empty assistant bubble and no reason.
   *
   * It is kept until the next run starts rather than cleared when published: a
   * snapshot refresh follows every prompt, and a snapshot that could not report
   * the failure silently replaced it with a clean state.
   */
  private lastError?: string;
  private readonly prompts = new UiPromptRegistry((prompts) => this.emit({ type: "prompts", prompts }));
  private readonly widgets = new WidgetRegistry((widgets) => this.emit({ type: "widgets", widgets }));

  private constructor(
    private readonly runtime: AgentSessionRuntime,
    private readonly models: string[] = [],
  ) {
    this.bindSession();
    this.bindUi();
  }

  /**
   * Without a UI context Pi falls back to a no-op one, so extension output such
   * as `/memory-status` is discarded. Bound on the runner rather than through
   * `session.bindExtensions`, which would re-emit `session_start`.
   */
  private bindUi(): void {
    this.runtime.session.extensionRunner.setUIContext(
      createWebUiContext({
        onNotify: (message, level) => this.emit({ type: "notification", level, message }),
        onPrompt: (request) => this.prompts.ask(request),
        onWidget: (key, lines, placement) => this.widgets.set(key, lines, placement),
      }),
      // "rpc" rather than "print": this host can answer blocking questions.
      "rpc",
    );
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
    // Snapshots are synchronous, so the model catalogue is resolved once here.
    const models = (await runtime.session.modelRuntime.getAvailable()).map((model) => `${model.provider}/${model.id}`);
    return new PiRuntimeAdapter(runtime, models.sort());
  }

  snapshot(): RuntimeSnapshot {
    const flattened = this.runtime.session.messages.flatMap((message) => toChatMessages(message, this.identity));
    const branch = (this.runtime.session as { sessionManager?: { getBranch(): Iterable<unknown> } }).sessionManager?.getBranch() ?? [];
    const messages = appendCustomEntries(mergeEntriesById(flattened), branch);
    // Compaction is a long model call that the session does not count as
    // streaming, so asking `isStreaming` alone reports a busy session as idle
    // and re-enables the composer mid-compaction.
    const isStreaming = !this.runtime.session.isIdle;
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
      ...(this.lastError ? { lastError: this.lastError } : {}),
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
          {
            id: "model.select",
            group: "model",
            kind: "select",
            title: "Model",
            description: "Switch the model for this session only.",
            state: { value: this.currentModel(), options: this.models },
          },
          {
            id: "session.compact",
            group: "session",
            kind: "action",
            title: "Compact session",
            description: "Summarise the conversation so far to free up context.",
            state: { label: "Compact now" },
          },
        ],
        commands: this.commands(),
      },
      prompts: this.prompts.list(),
      widgets: this.widgets.list(),
    };
  }

  private currentModel(): string {
    const model = this.runtime.session.model;
    return model ? `${model.provider}/${model.id}` : "";
  }

  /**
   * Extension, prompt, and skill commands the current session can dispatch,
   * plus the built-ins this host implements itself. Pi's own built-ins (`/model`,
   * `/compact`, ...) belong to the terminal app rather than the session, so
   * `getRegisteredCommands()` never returns them.
   */
  private commands(): SlashCommand[] {
    const registered = this.runtime.session.extensionRunner.getRegisteredCommands().map((command) => ({
      name: command.invocationName,
      ...(command.description ? { description: command.description } : {}),
    }));
    return [...registered, ...NATIVE_COMMANDS].sort((left, right) => left.name.localeCompare(right.name));
  }

  async setModel(model: string): Promise<void> {
    const available = await this.runtime.session.modelRuntime.getAvailable();
    const match = available.find((candidate) => `${candidate.provider}/${candidate.id}` === model);
    if (!match) throw new Error(`Unknown model: ${model}`);
    await this.runtime.session.setModel(match);
    this.emit({ type: "notification", level: "info", message: `Model set to ${model}` });
  }

  async compact(): Promise<void> {
    // Compaction is a long model call. Without this the UI looks idle while Pi
    // is busy, and a prompt sent meanwhile is rejected outright.
    this.emit({ type: "notification", level: "info", message: "Compacting session…" });
    this.emit({ type: "runtimeStatus", status: "running" });
    let result;
    try {
      result = await this.runtime.session.compact();
    } catch (error) {
      this.emit({ type: "runtimeStatus", status: "idle" });
      throw error;
    }
    this.emit({ type: "runtimeStatus", status: "idle" });
    const after = result.estimatedTokensAfter;
    this.emit({
      type: "notification",
      level: "info",
      message:
        after === undefined
          ? `Session compacted from ${result.tokensBefore} tokens.`
          : `Session compacted: ${result.tokensBefore} → ~${after} tokens.`,
    });
  }

  /**
   * Built-ins never reach `getCommand()`, so without this they would be sent to
   * the model as literal text like "/compact".
   */
  private async handleNativeCommand(message: string): Promise<boolean> {
    if (!message.startsWith("/")) return false;
    const name = message.slice(1).split(/\s+/)[0] ?? "";
    if (this.runtime.session.extensionRunner.getCommand(name)) return false;

    if (name === "compact") {
      await this.compact();
      return true;
    }
    if (name === "model") {
      const result = await this.prompts.ask({ kind: "select", title: "Select a model", options: this.models });
      if (!result.cancelled) await this.setModel(String(result.value));
      return true;
    }
    if (name === "session") {
      const stats = this.runtime.session.getSessionStats() as SessionStatsView;
      this.emit({
        type: "notification",
        level: "info",
        message: sessionStatsMarkdown(stats, this.runtime.session.sessionName, this.currentModel()),
      });
      return true;
    }
    if (name === "thinking") {
      const options = this.runtime.session.getAvailableThinkingLevels() as ThinkingLevel[];
      const result = await this.prompts.ask({ kind: "select", title: "Select a thinking level", options });
      if (!result.cancelled) await this.setThinkingLevel(String(result.value) as ThinkingLevel);
      return true;
    }
    if (PI_BUILTIN_COMMANDS.has(name)) {
      this.emit({
        type: "notification",
        level: "warning",
        message: `/${name} is a Pi terminal command and is not available in Pi Chat.`,
      });
      return true;
    }
    return false;
  }

  async prompt(message: string): Promise<void> {
    this.lastError = undefined;
    if (await this.handleNativeCommand(message.trim())) return;
    await this.runtime.session.prompt(message);
  }

  async abort(): Promise<void> {
    // A pending dialog would otherwise keep a blocked tool call waiting after
    // the user already asked the run to stop.
    this.prompts.cancelAll();
    this.emit({ type: "runtimeStatus", status: "aborting" });
    await this.runtime.session.abort();
  }

  respondToPrompt(promptId: string, result: UiPromptResult): void {
    this.prompts.respond(promptId, result);
  }

  suspendPrompts(): void {
    this.prompts.suspend();
  }

  resumePrompts(): void {
    this.prompts.resume();
  }

  renameSession(name: string): void {
    this.runtime.session.setSessionName(name);
  }

  setThinkingLevel(level: ThinkingLevel): void {
    this.runtime.session.setThinkingLevel(level);
    this.emit({ type: "notification", level: "info", message: `Thinking level set to ${level}` });
  }

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    this.unsubscribe?.();
    // Cancel before clearing listeners: a switched-away session must not leave
    // an extension waiting on a dialog nobody can answer.
    this.prompts.dispose();
    // Panels belong to the runtime that pushed them; a disposed adapter must
    // not keep reporting them in a snapshot.
    this.widgets.clear();
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
        if (final && (final.role === "user" || final.role === "assistant" || final.role === "custom")) {
          this.emit({ type: "messageFinal", runId: this.currentRunId, message: final });
        }
        return;
      }
      if (event.type === "entry_appended") {
        const message = customMessageFromEntry(event.entry);
        if (message) this.emit({ type: "messageFinal", runId: this.currentRunId, message });
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
      // Auto-compaction runs before the turn the user just asked for and can
      // take several seconds. The session does not report it as streaming, so
      // without these the browser shows nothing at all and still believes it is
      // idle, which is how a prompt slips through to the agent underneath and
      // comes back as "Agent is already processing a prompt".
      if (event.type === "compaction_start") {
        this.emit({ type: "runtimeStatus", status: "running" });
        // `compact()` announces the manual case itself.
        if (event.reason !== "manual") {
          this.emit({
            type: "notification",
            level: "info",
            message:
              event.reason === "overflow"
                ? "Context limit reached, compacting the session…"
                : "Context is nearly full, compacting the session…",
          });
        }
        return;
      }
      if (event.type === "compaction_end") {
        if (event.errorMessage) {
          this.emit({ type: "notification", level: "error", message: `Compaction failed: ${event.errorMessage}` });
        } else if (event.aborted) {
          this.emit({ type: "notification", level: "warning", message: "Compaction was cancelled." });
        }
        // More work follows a retry, and a compaction inside a run is followed
        // by the rest of that run, so `agent_settled` reports idle instead.
        // The compaction flag itself is still set here, cleared only after this
        // event, so it cannot be used to make this decision.
        if (!event.willRetry && !this.runtime.session.isStreaming) {
          this.emit({ type: "runtimeStatus", status: "idle" });
        }
        return;
      }
      if (event.type === "agent_settled") {
        // Deliberately not cleared here; `prompt()` drops it when the next run
        // begins, so a late snapshot still reports why this one failed.
        this.emit({ type: "runtimeStatus", status: "idle", ...(this.lastError ? { error: this.lastError } : {}) });
      }
    });
  }

  private emit(event: RuntimeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
