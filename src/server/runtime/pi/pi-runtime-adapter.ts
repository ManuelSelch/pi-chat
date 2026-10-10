import {
  SessionManager,
  type AgentSessionRuntime,
  type ExtensionUIContext,
} from "@earendil-works/pi-coding-agent";
import { parseBashInput } from "../../../shared/bash-input.js";
import { commandCompletionItemSchema, type CommandCompletionItem, type ChatMessage, type SlashCommand, type ThinkingLevel, type UiPromptResult } from "../../../shared/protocol.js";

import type { RuntimeAdapter, RuntimeEvent, RuntimeSnapshot } from "../contracts.js";
import { UiPromptRegistry } from "../../extensions/ui/ui-prompt-registry.js";
import { StatusRegistry } from "../../extensions/ui/status-registry.js";
import { WidgetRegistry } from "../../extensions/ui/widget-registry.js";
import { type SessionStatsView } from "./session-stats.js";
import { MessageIdentity, mergeEntriesById, messagesFromBranch, toChatMessages } from "./message-mapping.js";
import { createSessionEventHandler } from "./event-mapping.js";
import { projectFooter, projectSnapshot } from "./snapshot.js";
import { offeredModels } from "./models.js";
import { createPiRuntime } from "./runtime-factory.js";
import { handleNativeCommand, NATIVE_COMMANDS } from "./native-commands.js";
import { bindExtensionCommandContext, bindWebUiContext, extensionCommandContextActions } from "./extension-bindings.js";

/** How often, and for how long, an abort is checked against the session. */
const ABORT_WATCH_INTERVAL_MS = 250;
const ABORT_WATCH_TIMEOUT_MS = 15_000;

export class PiRuntimeAdapter implements RuntimeAdapter {
  private readonly listeners = new Set<(event: RuntimeEvent) => void>();
  private readonly identity = new MessageIdentity();
  private unsubscribe?: () => void;
  private promptPending = 0;
  private abortPending = false;
  private bashRunning = false;
  private compactPending = false;
  private disposed = false;
  private readonly projectionState = { currentRunId: "", lastError: undefined as string | undefined };
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
      await this.startExtensions();
      this.emit({ type: "sessionSwitch", previousSessionId, sessionId: this.runtime.session.sessionId });
    });
    this.bindSession();
    this.bindUi();
    this.bindCommandContext();
  }

  /** Persist browser bindings in Pi so native reload restores them before session_start. */
  private async startExtensions(): Promise<void> {
    await this.runtime.session.bindExtensions({
      uiContext: this.ui,
      mode: "rpc",
      commandContextActions: extensionCommandContextActions(this.runtime, () => this.reloadResources()),
    });
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
    this.ui = bindWebUiContext(this.runtime, {
      onNotify: (message, level) => this.emit({ type: "notification", level, message }),
      onPrompt: (request) => this.prompts.ask(request),
      onWidget: (key, lines, placement) => this.widgets.set(key, lines, placement),
      onStatus: (key, text) => this.statuses.set(key, text),
    });
  }

  /**
   * Slash-command handlers receive an ExtensionCommandContext. Without these
   * bindings commands that call ctx.newSession()/ctx.switchSession() hit the
   * runner's safe no-op defaults, which makes web-only commands appear to do
   * nothing.
   */
  private bindCommandContext(): void {
    bindExtensionCommandContext(this.runtime, () => this.reloadResources());
  }

  /**
   * Also handed to extension actions, so a button opens its dialog in the
   * session it was pressed in rather than in whichever session happened to
   * start last.
   */
  uiContext(): ExtensionUIContext {
    return this.ui;
  }

  /**
   * Attach the web projection to an already-initialized runtime. The caller
   * owns extension startup before attaching; this adapter owns runtime disposal.
   * Useful for hosts that construct isolated SDK services themselves.
   */
  static fromRuntime(runtime: AgentSessionRuntime): PiRuntimeAdapter {
    return new PiRuntimeAdapter(runtime);
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
    const runtime = await createPiRuntime(cwd, sessionManager);
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
    const snapshot = projectSnapshot({
      session: this.runtime.session,
      cwd: this.runtime.cwd,
      messages,
      inFlightTools: this.inFlightTools,
      ...(this.projectionState.lastError ? { lastError: this.projectionState.lastError } : {}),
      models: this.models,
      commands: this.commands(),
      prompts: this.prompts.list(),
      widgets: this.widgets.list(),
      statuses: this.statuses.list(),
    });
    return { ...snapshot, isStreaming: snapshot.isStreaming || this.compactPending || this.bashRunning || this.runtime.session.isBashRunning === true };
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

  async completeCommandArguments(commandName: string, argumentPrefix: string): Promise<CommandCompletionItem[]> {
    const command = this.runtime.session.extensionRunner.getCommand(commandName);
    const items = await command?.getArgumentCompletions?.(argumentPrefix);
    return commandCompletionItemSchema.array().parse(items ?? []);
  }

  async setModel(model: string): Promise<void> {
    const available = await this.runtime.session.modelRuntime.getAvailable();
    const match = available.find((candidate) => `${candidate.provider}/${candidate.id}` === model);
    if (!match) throw new Error(`Unknown model: ${model}`);
    await this.runtime.session.setModel(match);
    this.emit({ type: "notification", level: "info", message: `Model set to ${model}` });
  }

  async reload(): Promise<void> {
    if (this.disposed) throw new Error("Session is closed.");
    if (this.promptPending || this.abortPending || this.bashRunning || this.compactPending || this.runtime.session.isIdle === false) {
      throw new Error("Wait for the current run to finish before reloading.");
    }
    await this.reloadResources();
  }

  private async reloadResources(): Promise<void> {
    await this.runtime.session.reload({
      beforeSessionStart: async () => {
        this.prompts.cancelAll();
        this.widgets.clear();
        this.statuses.clear();
        this.bindUi();
        this.bindCommandContext();
      },
    });
    await this.refreshModels();
  }

  async compact(): Promise<void> {
    if (this.promptPending) throw new Error("Wait for the current run to finish before compacting.");
    await this.compactSession();
  }

  private async compactSession(): Promise<void> {
    if (this.bashRunning || this.compactPending || this.runtime.session.isIdle === false) throw new Error("Wait for the current run to finish before compacting.");
    this.compactPending = true;
    try {
      await this.performCompact();
    } finally {
      this.compactPending = false;
      this.emit({ type: "runtimeStatus", status: "idle" });
    }
  }

  private async performCompact(): Promise<void> {
    // Compaction is a long model call. Without this the UI looks idle while Pi
    // is busy, and a prompt sent meanwhile is rejected outright.
    this.emit({ type: "notification", level: "info", message: "Compacting session…" });
    this.emit({ type: "runtimeStatus", status: "running" });
    let result;
    try {
      result = await this.runtime.session.compact();
    } catch (error) {
      this.projectionState.lastError = error instanceof Error ? error.message : "Compaction failed.";
      throw error;
    }
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
    return handleNativeCommand(message, {
      hasExtensionCommand: (name) => Boolean(this.runtime.session.extensionRunner.getCommand(name)),
      compact: () => this.compactSession(),
      refreshModels: () => this.refreshModels(),
      models: () => this.models,
      ask: (request) => this.prompts.ask(request),
      setModel: (model) => this.setModel(model),
      setThinkingLevel: (level) => this.setThinkingLevel(level),
      sessionName: this.runtime.session.sessionName,
      currentModel: this.currentModel(),
      sessionStats: () => this.runtime.session.getSessionStats() as SessionStatsView,
      thinkingLevels: this.runtime.session.getAvailableThinkingLevels() as ThinkingLevel[],
      emit: (event) => this.emit(event),
    });
  }

  async prompt(message: string): Promise<void> {
    if (this.disposed) throw new Error("Session is closed.");
    const bash = parseBashInput(message);
    if (bash && !bash.command.trim()) throw new Error("Bash command is empty.");
    const session = this.runtime.session;
    const busy = this.promptPending > 0 || session.isIdle === false;
    // Only ordinary text can steer a live agent. Never run shell/session
    // commands concurrently or start a second run during asynchronous preflight.
    if (this.abortPending || (this.abortWatchdog && !session.isIdle) || this.compactPending || session.isCompacting || this.bashRunning || session.isBashRunning
      || (busy && (bash || message.trimStart().startsWith("/") || !session.isStreaming))) {
      throw new Error("Wait for the current run to finish before submitting another command.");
    }
    this.promptPending++; // Count concurrent steering preflights as well as the original run.
    this.projectionState.lastError = undefined;
    clearInterval(this.abortWatchdog);
    this.abortWatchdog = undefined;
    try {
      if (bash) {
        this.bashRunning = true;
        this.emit({ type: "runtimeStatus", status: "running" });
        const intercepted = await this.runtime.session.extensionRunner.emitUserBash({ type: "user_bash", ...bash, cwd: this.runtime.cwd });
        if (intercepted?.result) {
          this.runtime.session.recordBashResult(bash.command, intercepted.result, { excludeFromContext: bash.excludeFromContext });
        } else {
          await this.runtime.session.executeBash(bash.command, undefined, { excludeFromContext: bash.excludeFromContext, operations: intercepted?.operations });
        }
        return;
      }
      if (await this.handleNativeCommand(message.trim())) return;
      await this.runtime.session.prompt(message, { streamingBehavior: "steer" });
      if (message.trim().startsWith("/")) await this.refreshModels();
    } catch (error) {
      this.projectionState.lastError = error instanceof Error ? error.message : "Command failed.";
      throw error;
    } finally {
      this.promptPending--;
      if (bash) {
        this.bashRunning = false;
        if (!this.disposed) this.emit({ type: "runtimeStatus", status: "idle", ...(this.projectionState.lastError ? { error: this.projectionState.lastError } : {}) });
      }
    }
  }

  async abort(): Promise<void> {
    // A pending dialog would otherwise keep a blocked tool call waiting after
    // the user already asked the run to stop.
    this.prompts.cancelAll();
    if (this.bashRunning || this.runtime.session.isBashRunning) {
      this.emit({ type: "runtimeStatus", status: "aborting" });
      this.runtime.session.abortBash();
      return;
    }
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
    this.abortPending = true;
    try {
      await this.runtime.session.abort();
    } finally {
      this.abortPending = false;
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

  setThinkingLevel(level: ThinkingLevel): void {
    this.runtime.session.setThinkingLevel(level);
    this.emit({ type: "notification", level: "info", message: `Thinking level set to ${level}` });
  }

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
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
    this.unsubscribe = this.runtime.session.subscribe(createSessionEventHandler({
      session: this.runtime.session,
      identity: this.identity,
      state: this.projectionState,
      inFlightTools: this.inFlightTools,
      emit: (event) => this.emit(event),
      clearAbortWatchdog: () => {
        clearInterval(this.abortWatchdog);
        this.abortWatchdog = undefined;
      },
    }));
  }

  private emit(event: RuntimeEvent): void {
    if (this.disposed) return;
    for (const listener of this.listeners) listener(event);
  }
}
