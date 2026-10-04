import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
  type AgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory,
  type ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";
import type { ChatMessage, SlashCommand, ThinkingLevel, UiPromptResult } from "../../../shared/protocol.js";

import type { RuntimeAdapter, RuntimeEvent, RuntimeSnapshot } from "../contracts.js";
import { UiPromptRegistry } from "../../extensions/ui/ui-prompt-registry.js";
import { createWebUiContext } from "./web-ui-context.js";
import { StatusRegistry } from "../../extensions/ui/status-registry.js";
import { WidgetRegistry } from "../../extensions/ui/widget-registry.js";
import { sessionStatsMarkdown, type SessionStatsView } from "./session-stats.js";
import { customMessageFromEntry, MessageIdentity, mergeEntriesById, messagesFromBranch, textFromContent, toChatMessage, toChatMessages } from "./message-mapping.js";
import { clampToolOutput, toolCardFromCall } from "./tool-mapping.js";
import { projectEditDiff } from "../../../shared/edit-diff.js";
import { projectFooter, projectSnapshot } from "./snapshot.js";
import { offeredModels, resolveModelOverride } from "./models.js";

/** How often, and for how long, an abort is checked against the session. */
const ABORT_WATCH_INTERVAL_MS = 250;
const ABORT_WATCH_TIMEOUT_MS = 15_000;

/** Built-ins this host implements, surfaced in the web command menu. */
const NATIVE_COMMANDS: SlashCommand[] = [
  { name: "model", description: "Switch the model for this session", source: "native" },
  { name: "session", description: "Show session stats, token use, and context window", source: "native" },
  { name: "thinking", description: "Set the reasoning effort for this session", source: "native" },
  { name: "compact", description: "Summarise the conversation to free up context", source: "native" },
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

export class PiRuntimeAdapter implements RuntimeAdapter {
  private readonly listeners = new Set<(event: RuntimeEvent) => void>();
  private readonly identity = new MessageIdentity();
  private unsubscribe?: () => void;
  private currentRunId = "";
  private boundSessionId = "";
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
  private abortWatchdog?: ReturnType<typeof setInterval>;
  private readonly prompts = new UiPromptRegistry((prompts) => this.emit({ type: "prompts", prompts }));
  /** Assigned by `bindUi` from the constructor, before anything can reach it. */
  private ui!: ExtensionUIContext;
  private readonly widgets = new WidgetRegistry((widgets) => this.emit({ type: "widgets", widgets }));
  private readonly statuses = new StatusRegistry(() => this.emit({ type: "footer", footer: projectFooter(this.runtime.session, this.statuses.list()) }));

  private constructor(
    private readonly runtime: AgentSessionRuntime,
    private models: string[] = [],
  ) {
    const runtimeHooks = this.runtime as AgentSessionRuntime & {
      setBeforeSessionInvalidate?: (handler: () => void) => void;
      setRebindSession?: (handler: () => Promise<void>) => void;
    };
    runtimeHooks.setBeforeSessionInvalidate?.(() => {
      this.prompts.cancelAll();
      this.widgets.clear();
      this.statuses.clear();
    });
    runtimeHooks.setRebindSession?.(async () => {
      const previousSessionId = this.boundSessionId;
      this.bindSession();
      this.bindUi();
      this.bindCommandContext();
      await this.startExtensions("resume");
      this.emit({ type: "sessionSwitch", previousSessionId, sessionId: this.runtime.session.sessionId });
    });
    this.bindSession();
    this.bindUi();
    this.bindCommandContext();
  }

  /**
   * `session_start` is otherwise never emitted in this host: Pi fires it from
   * `session.bindExtensions`, which the terminal modes call and this host does
   * not. Extensions that capture their dialog surface from that event — the
   * documented way to reach `ctx.ui`, since the extension factory is not given
   * one — were left without it and could not ask a question at all.
   *
   * Emitted after `bindUi`, so the surface handed out is this host's browser
   * modal rather than the no-op one it replaces, and exactly once per adapter:
   * a second `session_start` would look like a session change to an extension.
   */
  private async startExtensions(reason: "startup" | "resume" = "startup"): Promise<void> {
    await this.runtime.session.extensionRunner.emit({ type: "session_start", reason });
    await this.refreshModels();
  }

  private async refreshModels(): Promise<void> {
    // /defaults writes settings.json directly, outside the SDK's settings cache.
    await this.runtime.session.settingsManager.reload();
    this.models = await offeredModels(this.runtime.session);
  }

  /**
   * Without a UI context Pi falls back to a no-op one, so extension output such
   * as `/memory-status` is discarded. Bound on the runner rather than through
   * `session.bindExtensions`, which would bind the terminal's own mode.
   */
  private bindUi(): void {
    this.ui = createWebUiContext({
      onNotify: (message, level) => this.emit({ type: "notification", level, message }),
      onPrompt: (request) => this.prompts.ask(request),
      onWidget: (key, lines, placement) => this.widgets.set(key, lines, placement),
      onStatus: (key, text) => this.statuses.set(key, text),
    });
    // "rpc" rather than "print": this host can answer blocking questions.
    this.runtime.session.extensionRunner.setUIContext(this.ui, "rpc");
  }

  /**
   * Slash-command handlers receive an ExtensionCommandContext. Without these
   * bindings commands that call ctx.newSession()/ctx.switchSession() hit the
   * runner's safe no-op defaults, which makes web-only commands appear to do
   * nothing.
   */
  private bindCommandContext(): void {
    const runner = this.runtime.session.extensionRunner as typeof this.runtime.session.extensionRunner & {
      bindCommandContext?: (context: {
        waitForIdle: () => Promise<void>;
        newSession: AgentSessionRuntime["newSession"];
        fork: AgentSessionRuntime["fork"];
        navigateTree: AgentSessionRuntime["session"]["navigateTree"];
        switchSession: AgentSessionRuntime["switchSession"];
        reload: () => Promise<void>;
      }) => void;
    };
    runner.bindCommandContext?.({
      waitForIdle: () => this.runtime.session.agent.waitForIdle(),
      newSession: (options) => this.runtime.newSession(options),
      fork: (entryId, options) => this.runtime.fork(entryId, options),
      navigateTree: (targetId, options) => this.runtime.session.navigateTree(targetId, options),
      switchSession: (sessionPath, options) => this.runtime.switchSession(sessionPath, options),
      reload: async () => {
        throw new Error("Use /reload in Pi Chat to reload this session.");
      },
    });
  }

  /**
   * Also handed to extension actions, so a button opens its dialog in the
   * session it was pressed in rather than in whichever session happened to
   * start last.
   */
  uiContext(): ExtensionUIContext {
    return this.ui;
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
      const override = resolveModelOverride(services);
      return {
        ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent, ...override })),
        services,
        diagnostics: services.diagnostics,
      };
    };

    const runtime = await createAgentSessionRuntime(createRuntime, { cwd, agentDir, sessionManager });
    // session_start can register providers or change defaults: resolve afterwards.
    const adapter = new PiRuntimeAdapter(runtime);
    await adapter.startExtensions();
    return adapter;
  }

  snapshot(): RuntimeSnapshot {
    const branch = (this.runtime.session as { sessionManager?: { getBranch(): Iterable<unknown> } }).sessionManager?.getBranch();
    const messages = branch
      ? messagesFromBranch(branch, this.identity)
      : mergeEntriesById(this.runtime.session.messages.flatMap((message) => toChatMessages(message, this.identity)));
    return projectSnapshot({
      session: this.runtime.session,
      cwd: this.runtime.cwd,
      messages,
      inFlightTools: this.inFlightTools,
      ...(this.lastError ? { lastError: this.lastError } : {}),
      models: this.models,
      commands: this.commands(),
      prompts: this.prompts.list(),
      widgets: this.widgets.list(),
      statuses: this.statuses.list(),
    });

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
      source: "extension" as const,
    }));
    const occupied = new Set([...registered, ...NATIVE_COMMANDS].map((command) => command.name));
    const templates = this.runtime.session.promptTemplates
      .filter((template) => !occupied.has(template.name))
      .map((template) => ({
        name: template.name,
        description: template.description,
        ...(template.argumentHint ? { argumentHint: template.argumentHint } : {}),
        source: "prompt" as const,
      }));
    return [...registered, ...NATIVE_COMMANDS, ...templates].sort((left, right) => left.name.localeCompare(right.name));
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
      await this.refreshModels();
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
    // A new run owns the status from here; a watchdog left from the previous
    // abort would report idle in the middle of it.
    clearInterval(this.abortWatchdog);
    this.abortWatchdog = undefined;
    if (await this.handleNativeCommand(message.trim())) return;
    await this.runtime.session.prompt(message);
    // Extension commands may have changed settings or registered providers.
    if (message.trim().startsWith("/")) await this.refreshModels();
  }

  async abort(): Promise<void> {
    // A pending dialog would otherwise keep a blocked tool call waiting after
    // the user already asked the run to stop.
    this.prompts.cancelAll();
    // Only a turn that reached the agent loop ends in `agent_settled`, and that
    // is the single event clearing an "aborting" status. Stopping while the
    // session is between turns — or during compaction, a queued prompt, a run
    // that already failed — produces none, and the composer sits on
    // "stopping…" for good. So the status is confirmed against the session
    // itself rather than trusted to arrive.
    if (this.runtime.session.isIdle) {
      this.emit({ type: "runtimeStatus", status: "idle" });
      return;
    }
    this.emit({ type: "runtimeStatus", status: "aborting" });
    try {
      await this.runtime.session.abort();
    } finally {
      this.watchAbort();
    }
  }

  /**
   * Polls the session after an abort and reports idle as soon as it stops. A
   * settled event that does arrive gets there first and this only re-states
   * what the browser already shows; when none arrives, this is what ends the
   * "stopping…" state.
   */
  private watchAbort(): void {
    clearInterval(this.abortWatchdog);
    const started = Date.now();
    this.abortWatchdog = setInterval(() => {
      const settled = this.runtime.session.isIdle;
      if (!settled && Date.now() - started < ABORT_WATCH_TIMEOUT_MS) return;
      clearInterval(this.abortWatchdog);
      this.abortWatchdog = undefined;
      // A session still working after this long was never stopped. Saying so
      // and handing the composer back to "running" is more honest than a
      // "stopping…" that will never end, and escape can try again from there.
      if (!settled) {
        this.emit({ type: "notification", level: "warning", message: "The run did not stop. Press escape again to retry." });
      }
      this.emit({ type: "runtimeStatus", status: settled ? "idle" : "running" });
    }, ABORT_WATCH_INTERVAL_MS);
    this.abortWatchdog.unref?.();
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
    clearInterval(this.abortWatchdog);
    this.abortWatchdog = undefined;
    // Cancel before clearing listeners: a switched-away session must not leave
    // an extension waiting on a dialog nobody can answer.
    this.prompts.dispose();
    // Panels belong to the runtime that pushed them; a disposed adapter must
    // not keep reporting them in a snapshot.
    this.widgets.clear();
    this.statuses.clear();
    this.listeners.clear();
    await this.runtime.dispose();
  }

  private bindSession(): void {
    this.unsubscribe?.();
    this.boundSessionId = this.runtime.session.sessionId;
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
      // Redacted reasoning emits no deltas at all, so it only ever appears on
      // the final message; this stream is the readable case.
      if (event.type === "message_update" && event.assistantMessageEvent.type === "thinking_delta") {
        this.emit({ type: "thinkingDelta", runId: this.currentRunId, delta: event.assistantMessageEvent.delta });
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
            ...(output ? { outputText: clampToolOutput(output) } : {}),
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
            editDiff: projectEditDiff(event.toolName, event.isError, (event.result as { details?: unknown })?.details),
            ...(output ? { outputText: clampToolOutput(output) } : {}),
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
        clearInterval(this.abortWatchdog);
        this.abortWatchdog = undefined;
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
