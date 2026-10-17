import { CONTROLLER_REPLACED_CODE, clientMessageSchema, serverMessageSchema, type ClientMessage, type ProjectCatalogue, type ServerMessage, type Tab, type WebFeature, type ThinkingLevel, type UiPromptResult, type DirectoryBrowse, type DirectoryListing, type CommandCompletionItem } from "./contract/index.js";
import { SDKError } from "./errors.js";
import { defaultScheduler, type Scheduler, type CancellationSignal } from "./platform.js";
import { initialSessionState, reduceSessionMessage, type SessionState } from "./session-state.js";
import type { Transport, TransportFactory } from "./transport.js";
import { FolderRequests } from "./requests/folder-requests.js";
import { CompletionRequests } from "./requests/completion-requests.js";
import { ProjectRequests } from "./requests/project-requests.js";
import { FileRequests } from "./requests/file-requests.js";

export type ReadonlyDeep<T> = T extends readonly (infer U)[] ? readonly ReadonlyDeep<U>[] : T extends object ? { readonly [K in keyof T]: ReadonlyDeep<T[K]> } : T;
export type ConnectionPhase = "stopped" | "connecting" | "synchronizing" | "ready" | "reconnecting" | "superseded" | "failed" | "disposed";
export interface ClientState {
  connection: { phase: ConnectionPhase; error?: { code: string; message: string } };
  sessions: Record<string, SessionState>;
  /** V1 wire inventory only. Local tabs, focus and optimistic UI are not owned here. */
  inventory: Tab[];
  serverActiveSessionId: string;
  catalogue: ProjectCatalogue;
  features: WebFeature[];
}
export interface PiClientOptions {
  endpoint: string;
  transport: TransportFactory;
  scheduler?: Scheduler;
  connectTimeoutMs?: number;
  maxMessageCharacters?: number;
  maxSessions?: number;
  maxBufferedMessages?: number;
  maxPendingRequests?: number;
  requestTimeoutMs?: number;
}
export interface RequestOptions { signal?: CancellationSignal }

function freeze<T>(value: T): T {
  const pending: unknown[] = [value];
  while (pending.length) {
    const current = pending.pop();
    if (current === null || typeof current !== "object" || Object.isFrozen(current)) continue;
    for (const child of Object.values(current)) pending.push(child);
    Object.freeze(current);
  }
  return value;
}

/** V1 migration client. No authentication, replay, navigation or Pi scheduler. */
export class PiClient {
  private state: ClientState = freeze({ connection: { phase: "stopped" }, sessions: {}, inventory: [], serverActiveSessionId: "", catalogue: { projects: [] }, features: [] });
  private readonly stateListeners = new Set<(state: ReadonlyDeep<ClientState>) => void>();
  private readonly messageListeners = new Set<(message: ReadonlyDeep<ServerMessage>) => void>();
  private readonly errorListeners = new Set<(error: SDKError) => void>();
  private readonly scheduler: Scheduler;
  private readonly connectTimeoutMs: number;
  private readonly maxMessageCharacters: number;
  private readonly maxSessions: number;
  private readonly maxBufferedMessages: number;
  private readonly inbox: { text: string; generation: number }[] = [];
  private bufferedCharacters = 0;
  private processing = false;
  private readonly folders: FolderRequests;
  private readonly completions: CompletionRequests;
  private readonly projects: ProjectRequests;
  private readonly files: FileRequests;
  private requestSequence = 0;
  private transport?: Transport;
  private timer?: unknown;
  private watchdog?: unknown;
  private generation = 0;
  private running = false;
  private shuttingDown = false;
  private retryMs = 250;
  private inventoryReceived = false;
  private catalogueReceived = false;
  private readonly snapshots = new Set<string>();

  constructor(private readonly options: PiClientOptions) {
    if (!/^wss?:\/\/[^\s]+$/.test(options.endpoint)) throw new SDKError("invalidRequest", "An explicit ws:// or wss:// endpoint is required.");
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
    this.maxMessageCharacters = options.maxMessageCharacters ?? 16_777_216;
    this.maxSessions = options.maxSessions ?? 256;
    this.maxBufferedMessages = options.maxBufferedMessages ?? 64;
    const requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    const maxPendingRequests = options.maxPendingRequests ?? 64;
    for (const value of [this.connectTimeoutMs, this.maxMessageCharacters, this.maxSessions, this.maxBufferedMessages, requestTimeoutMs, maxPendingRequests]) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new SDKError("invalidRequest", "Client limits must be positive safe integers.");
    }
    const policy = { scheduler: this.scheduler, timeoutMs: requestTimeoutMs, budget: { used: 0, limit: maxPendingRequests } };
    this.folders = new FolderRequests(policy);
    this.completions = new CompletionRequests(policy);
    this.projects = new ProjectRequests(policy);
    this.files = new FileRequests(policy);
  }

  getState(): ReadonlyDeep<ClientState> { return this.state; }
  getSession(sessionId: string): ReadonlyDeep<SessionState> | undefined {
    return Object.hasOwn(this.state.sessions, sessionId) ? this.state.sessions[sessionId] : undefined;
  }
  subscribe(listener: (state: ReadonlyDeep<ClientState>) => void): () => void {
    this.assertAlive(); this.stateListeners.add(listener);
    return () => { this.stateListeners.delete(listener); };
  }
  onMessage(listener: (message: ReadonlyDeep<ServerMessage>) => void): () => void {
    this.assertAlive(); this.messageListeners.add(listener);
    return () => { this.messageListeners.delete(listener); };
  }
  onError(listener: (error: SDKError) => void): () => void {
    this.assertAlive(); this.errorListeners.add(listener);
    return () => { this.errorListeners.delete(listener); };
  }

  start(): void {
    this.assertAlive();
    if (this.running || this.state.connection.phase === "superseded") return;
    this.running = true;
    this.retryMs = 250;
    const generation = this.generation;
    this.publish({ ...this.state, connection: { phase: "connecting" } });
    if (this.active(generation)) this.timer = this.scheduler.setTimeout(() => this.connect(), 0);
  }
  /** Only an explicit user action should call this after close code 4001. */
  takeControl(): void {
    this.assertAlive(); this.detach();
    this.running = false;
    this.publish({ ...this.state, connection: { phase: "stopped" } });
    this.start();
  }
  stop(): void { this.shutdown("stopped"); }
  dispose(): void { this.shutdown("disposed"); }

  /** Success means sent locally, never server admission/completion on v1. */
  send(command: ClientMessage): void {
    this.assertAlive();
    const parsed = clientMessageSchema.safeParse(command);
    if (!parsed.success) throw new SDKError("invalidRequest", "Invalid v1 command.");
    if (!this.transport || !["synchronizing", "ready"].includes(this.state.connection.phase)) throw new SDKError("notConnected", "Not connected to the Pi server.");
    try { this.transport.send(JSON.stringify(parsed.data)); }
    catch (error) {
      if (error instanceof SDKError) throw error;
      throw new SDKError("transportError", "Unable to send; the server outcome is unknown. No retry was sent.", "unknown");
    }
  }

  prompt(sessionId: string, message: string): void { this.send({ version: 1, type: "prompt", sessionId, message }); }
  abort(sessionId: string): void { this.send({ version: 1, type: "abort", sessionId }); }
  respondToPrompt(sessionId: string, promptId: string, result: UiPromptResult): void { this.send({ version: 1, type: "uiPromptResponse", sessionId, promptId, result }); }
  selectModel(sessionId: string, model: string): void { this.send({ version: 1, type: "runFeature", sessionId, featureId: "model.select", input: { model } }); }
  setThinkingLevel(sessionId: string, level: ThinkingLevel): void { this.send({ version: 1, type: "runFeature", sessionId, featureId: "thinking.level", input: { level } }); }
  compactSession(sessionId: string): void { this.send({ version: 1, type: "runFeature", sessionId, featureId: "session.compact", input: {} }); }
  runExtensionAction(sessionId: string, actionId: string): void { this.send({ version: 1, type: "runExtensionAction", sessionId, actionId }); }
  focusSession(sessionId: string): void { this.send({ version: 1, type: "focusTab", sessionId }); }
  openSession(path: string): void { this.send({ version: 1, type: "openSession", path }); }
  openProject(path: string): void { this.send({ version: 1, type: "openProject", path }); }
  restartServer(): void { this.send({ version: 1, type: "runFeature", sessionId: "app", featureId: "app.restart", input: {} }); }
  closeSession(sessionId: string): void {
    this.send({ version: 1, type: "closeTab", sessionId });
    this.files.closeSession(sessionId); this.completions.closeSession(sessionId);
  }
  async browseDirectories(request: DirectoryBrowse, options: RequestOptions = {}): Promise<DirectoryListing> {
    const command = { ...request, version: 1 as const, type: "browseDirectories" as const, requestId: this.nextId() };
    const reply = await this.request(command, () => this.folders.request(command, (message) => this.send(message), options.signal));
    if (reply.type !== "directoryListing") throw new SDKError("invalidMessage", "Unexpected directory response.");
    return reply.listing;
  }
  async createSession(projectPath?: string, options: RequestOptions = {}): Promise<string> {
    const command = { version: 1 as const, type: "newSession" as const, requestId: this.nextId(), ...(projectPath === undefined ? {} : { path: projectPath }) };
    const reply = await this.request(command, () => this.folders.request(command, (message) => this.send(message), options.signal));
    if (reply.type !== "sessionOpened") throw new SDKError("invalidMessage", "Unexpected session response.");
    return reply.sessionId;
  }
  completeCommandArguments(sessionId: string, commandName: string, argumentPrefix: string, options: RequestOptions = {}): Promise<CommandCompletionItem[]> {
    const command = { version: 1 as const, type: "completeCommandArguments" as const, sessionId, commandName, argumentPrefix, requestId: this.nextId() };
    return this.request(command, () => this.completions.request(command, (message) => this.send(message), options.signal));
  }
  openFile(sessionId: string, path: string, options: RequestOptions = {}): Promise<void> {
    const command = { version: 1 as const, type: "openFile" as const, sessionId, path, requestId: this.nextId() };
    return this.request(command, () => this.files.request(command, (message) => this.send(message), options.signal));
  }
  archiveSession(path: string, archived: boolean, options: RequestOptions = {}): Promise<void> { return this.projectMutation({ version: 1, type: "setSessionArchived", path, archived, requestId: this.nextId() }, options); }
  pinProject(path: string, pinned: boolean, options: RequestOptions = {}): Promise<void> { return this.projectMutation({ version: 1, type: "pinProject", path, pinned, requestId: this.nextId() }, options); }
  removeProject(path: string, options: RequestOptions = {}): Promise<void> { return this.projectMutation({ version: 1, type: "removeProject", path, requestId: this.nextId() }, options); }

  private projectMutation(command: Extract<ClientMessage, { type: "setSessionArchived" | "pinProject" | "removeProject" }>, options: RequestOptions): Promise<void> {
    return this.request(command, () => this.projects.request(command, (message) => this.send(message), options.signal));
  }
  private nextId(): string {
    if (this.requestSequence >= Number.MAX_SAFE_INTEGER) throw new SDKError("limitExceeded", "Request identifier space exhausted; create a fresh client.");
    return `sdk-${++this.requestSequence}`;
  }
  private request<T>(command: ClientMessage, invoke: () => Promise<T>): Promise<T> {
    try {
      this.assertAlive();
      if (!clientMessageSchema.safeParse(command).success) throw new SDKError("invalidRequest", "Invalid v1 command.", "notSent", "requestId" in command ? command.requestId : undefined);
      if (!this.transport || !["synchronizing", "ready"].includes(this.state.connection.phase)) throw new SDKError("notConnected", "Not connected to the Pi server.");
      return invoke();
    } catch (error) { return Promise.reject(error); }
  }

  private assertAlive(): void {
    if (this.state.connection.phase === "disposed") throw new SDKError("disposed", "PiClient is disposed.");
    if (this.shuttingDown) throw new SDKError("stopped", "PiClient is stopping.");
  }
  private active(generation: number): boolean { return this.running && generation === this.generation; }
  private connect(): void {
    this.timer = undefined;
    if (!this.running) return;
    const generation = ++this.generation;
    this.inventoryReceived = false; this.catalogueReceived = false; this.snapshots.clear();
    this.publish({ ...this.state, connection: { phase: "connecting" } });
    if (!this.active(generation)) return;
    this.watchdog = this.scheduler.setTimeout(() => {
      if (this.active(generation)) this.lost(new SDKError("timeout", "Timed out connecting or synchronizing with the Pi server."));
    }, this.connectTimeoutMs);
    try {
      const transport = this.options.transport(this.options.endpoint, {
        open: () => {
          if (!this.active(generation)) return;
          this.retryMs = 250;
          this.publish({ ...this.state, connection: { phase: "synchronizing" } });
        },
        message: (text) => { if (this.active(generation)) this.enqueue(text, generation); },
        close: (event) => {
          if (!this.active(generation)) return;
          this.lost(new SDKError(event.code === CONTROLLER_REPLACED_CODE ? "superseded" : "disconnected", event.reason || "Connection lost."), event.code === CONTROLLER_REPLACED_CODE);
        },
        error: () => { if (this.active(generation)) this.report(new SDKError("transportError", "WebSocket transport reported an error.")); },
      });
      if (this.active(generation)) this.transport = transport;
      else this.release(transport);
    } catch {
      if (this.active(generation)) this.lost(new SDKError("transportError", "Unable to create the WebSocket transport."));
    }
  }

  private enqueue(text: string, generation: number): void {
    if (this.inbox.length >= this.maxBufferedMessages || this.bufferedCharacters + text.length > this.maxMessageCharacters) {
      this.fail(new SDKError("limitExceeded", "Inbound queue exceeded the client limit; explicit resynchronization is required."));
      return;
    }
    this.inbox.push({ text, generation }); this.bufferedCharacters += text.length;
    if (this.processing) return;
    this.processing = true;
    try {
      while (this.inbox.length) {
        const item = this.inbox.shift()!; this.bufferedCharacters -= item.text.length;
        if (this.active(item.generation)) this.receive(item.text, item.generation);
      }
    } finally { this.processing = false; }
  }

  private receive(text: string, generation: number): void {
    if (text.length > this.maxMessageCharacters) { this.fail(new SDKError("limitExceeded", "Inbound message exceeds the client limit; resynchronization is required.")); return; }
    let input: unknown;
    try { input = JSON.parse(text); }
    catch { this.fail(new SDKError("invalidMessage", "Server sent invalid JSON.")); return; }
    const parsed = serverMessageSchema.safeParse(input);
    if (!parsed.success) { this.fail(new SDKError("invalidMessage", "Unsupported or malformed v1 server message.")); return; }
    const message = parsed.data;
    // Correlated replies never become transcript entries or implicit navigation.
    this.folders.receive(message); this.completions.receive(message); this.projects.receive(message); this.files.receive(message);
    let next = this.state;
    if (message.type === "tabs") {
      if (message.tabs.length > this.maxSessions) { this.fail(new SDKError("limitExceeded", "Runtime inventory exceeds the client limit.")); return; }
      this.inventoryReceived = true;
      const sessionIds = message.tabs.map((tab) => tab.sessionId);
      this.files.retainSessions(sessionIds); this.completions.retainSessions(sessionIds);
      for (const id of this.snapshots) if (!message.tabs.some((tab) => tab.sessionId === id)) this.snapshots.delete(id);
      next = { ...next, inventory: message.tabs, serverActiveSessionId: message.activeSessionId,
        sessions: Object.fromEntries(Object.entries(next.sessions).filter(([id]) => message.tabs.some((tab) => tab.sessionId === id))) };
    } else if (message.type === "catalogue") {
      this.catalogueReceived = true;
      next = { ...next, catalogue: message.catalogue, features: message.features ?? next.features };
    } else if (message.type === "protocolError") {
      next = { ...next, connection: { ...next.connection, error: { code: "serverError", message: message.error } } };
    } else if ("sequence" in message) {
      const current = Object.hasOwn(next.sessions, message.sessionId) ? next.sessions[message.sessionId]! : undefined;
      if (!current && Object.keys(next.sessions).length >= this.maxSessions) { this.fail(new SDKError("limitExceeded", "Session projection count exceeds the client limit.")); return; }
      const session = reduceSessionMessage(current ?? { ...initialSessionState, sessionId: message.sessionId }, message);
      if (message.type === "snapshot") this.snapshots.add(message.sessionId);
      next = { ...next, sessions: { ...next.sessions, [message.sessionId]: session },
        catalogue: message.type === "snapshot" && message.catalogue ? message.catalogue : next.catalogue };
    }
    // V1 has no initialization barrier. This is a best-effort initial-sync
    // observation, not v2 atomic readiness or a claim of missed-event replay.
    if (this.inventoryReceived && this.catalogueReceived && next.inventory.every((tab) => this.snapshots.has(tab.sessionId))) {
      if (this.watchdog !== undefined) this.scheduler.clearTimeout(this.watchdog);
      this.watchdog = undefined;
      next = { ...next, connection: { ...next.connection, phase: "ready" } };
    }
    if (next !== this.state) this.publish(next);
    if (this.active(generation)) this.notify(this.messageListeners, freeze(message));
  }

  private publish(next: ClientState): void { this.state = freeze(next); this.notify(this.stateListeners, this.state); }
  private notify<T>(listeners: Set<(value: T) => void>, value: T): void {
    for (const listener of [...listeners]) {
      if (!listeners.has(listener)) continue;
      try { listener(value); }
      catch { this.report(new SDKError("listenerError", "A client subscriber threw an exception.")); }
    }
  }
  private report(error: SDKError): void {
    for (const listener of [...this.errorListeners]) { try { listener(error); } catch { /* Diagnostics must not break transport cleanup. */ } }
  }
  private release(transport: Transport): void {
    try { transport.dispose(); } catch { /* Keep cleanup best-effort. */ }
    try { transport.close(); } catch { /* No runtime close is sent. */ }
  }
  private detach(reason = new SDKError("disconnected", "Connection lost.")): void {
    ++this.generation;
    this.folders.disconnect(reason); this.completions.disconnect(reason); this.projects.disconnect(reason); this.files.disconnect(reason);
    this.inbox.length = 0; this.bufferedCharacters = 0;
    if (this.timer !== undefined) this.scheduler.clearTimeout(this.timer);
    if (this.watchdog !== undefined) this.scheduler.clearTimeout(this.watchdog);
    this.timer = undefined; this.watchdog = undefined;
    const transport = this.transport; this.transport = undefined;
    if (transport) this.release(transport);
  }
  private disconnectedSessions(superseded = false): Record<string, SessionState> {
    return Object.fromEntries(Object.entries(this.state.sessions).map(([id, state]) => [id, reduceSessionMessage(state, { type: superseded ? "superseded" : "connectionLost" })]));
  }
  private lost(error: SDKError, superseded = false): void {
    this.detach(error);
    const generation = this.generation;
    if (superseded) this.running = false;
    this.publish({ ...this.state, sessions: this.disconnectedSessions(superseded), connection: { phase: superseded ? "superseded" : "reconnecting", error: { code: error.code, message: error.message } } });
    this.report(error);
    if (!this.active(generation)) return;
    this.timer = this.scheduler.setTimeout(() => this.connect(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, 5000);
  }
  private fail(error: SDKError): void {
    this.running = false; this.detach(error);
    this.publish({ ...this.state, sessions: this.disconnectedSessions(), connection: { phase: "failed", error: { code: error.code, message: error.message } } });
    this.report(error);
  }
  private shutdown(phase: "stopped" | "disposed"): void {
    if (this.state.connection.phase === "disposed" || this.shuttingDown) return;
    this.shuttingDown = true;
    try {
      this.running = false; this.detach(new SDKError(phase, `PiClient ${phase}.`));
      this.publish({ ...this.state, sessions: this.disconnectedSessions(), connection: { phase } });
    } finally {
      this.stateListeners.clear(); this.messageListeners.clear(); this.errorListeners.clear();
      this.shuttingDown = false;
    }
  }
}
