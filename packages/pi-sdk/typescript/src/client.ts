import { CONTROLLER_REPLACED_CODE, type ProjectCatalogue, type WebFeature, type ThinkingLevel, type UiPromptResult, type DirectoryBrowse, type DirectoryListing, type CommandCompletionItem } from "./contract/index.js";
import { capabilitySchema, requestSchema, serverMessageSchema, parseResponse, type ServerMessage, type Event, type Method, type Params, type Result, type Capability, type OpenSessionSummary, type SessionSnapshot } from "./contract/v2.js";
import { SDKError } from "./errors.js";
import { defaultScheduler, type Scheduler, type CancellationSignal } from "./platform.js";
import { applySnapshot, initialSessionState, reduceSessionMessage, type SessionState } from "./session-state.js";
import type { Transport, TransportFactory } from "./transport.js";
import { PendingRequests } from "./requests/pending-requests.js";

export type ReadonlyDeep<T> = T extends readonly (infer U)[] ? readonly ReadonlyDeep<U>[] : T extends object ? { readonly [K in keyof T]: ReadonlyDeep<T[K]> } : T;
export type ConnectionPhase = "stopped" | "connecting" | "synchronizing" | "ready" | "reconnecting" | "superseded" | "failed" | "disposed";
export interface ClientState {
  connection: { phase: ConnectionPhase; error?: { code: string; message: string } };
  serverInstanceId?: string;
  connectionId?: string;
  capabilities: Capability[];
  sessions: Record<string, SessionState>;
  inventory: OpenSessionSummary[];
  inventoryRevision: number;
  catalogue: ProjectCatalogue;
  projectsRevision: number;
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
  capabilities?: Capability[];
}
export interface RequestOptions { signal?: CancellationSignal }
/** Provisional inventory entry for an atomic runtime replacement; the authoritative list follows. */
function replacementSummary(snapshot: SessionSnapshot): OpenSessionSummary {
  const status = snapshot.prompts.length ? "blocked" as const : snapshot.runtime.status === "aborting" ? "running" as const : snapshot.runtime.status;
  const firstUser = snapshot.messages.find(message => message.role === "user");
  return { sessionId: snapshot.sessionId, ...(snapshot.sessionPath ? { sessionPath: snapshot.sessionPath } : {}),
    title: snapshot.sessionName ?? (firstUser?.role === "user" ? firstUser.text : undefined) ?? snapshot.sessionId,
    projectPath: snapshot.projectPath, projectName: snapshot.projectPath.split(/[\\/]/).filter(Boolean).at(-1) ?? snapshot.projectPath, status };
}
function freeze<T>(value: T): T {
  const pending: unknown[] = [value];
  while (pending.length) { const current = pending.pop(); if (current === null || typeof current !== "object" || Object.isFrozen(current)) continue; for (const child of Object.values(current)) pending.push(child); Object.freeze(current); }
  return value;
}
/** UI-independent v2 client. No navigation, mutation replay, journal or Pi scheduler. */
export class PiClient {
  private state: ClientState = freeze({ connection: { phase: "stopped" }, sessions: {}, inventory: [], inventoryRevision: -1, catalogue: { projects: [] }, projectsRevision: -1, features: [], capabilities: [] });
  private readonly stateListeners = new Set<(state: ReadonlyDeep<ClientState>) => void>();
  private readonly messageListeners = new Set<(message: ReadonlyDeep<ServerMessage>) => void>();
  private readonly errorListeners = new Set<(error: SDKError) => void>();
  private readonly scheduler: Scheduler;
  private readonly connectTimeoutMs: number;
  private readonly maxMessageCharacters: number;
  private readonly maxSessions: number;
  private readonly maxBufferedMessages: number;
  private readonly pending: PendingRequests<unknown>;
  private readonly capabilities: Capability[];
  private readonly inbox: { text: string; generation: number }[] = [];
  private readonly gaps = new Map<string, Extract<Event, { sequence: number }>[]>();
  private readonly recovering = new Set<string>();
  private readonly fileWaits = new Map<string, Promise<void>>();
  private bufferedCharacters = 0;
  private processing = false;
  private requestSequence = 0;
  private connectionRequests = 0;
  private transport?: Transport;
  private timer?: unknown;
  private watchdog?: unknown;
  private generation = 0;
  private running = false;
  private shuttingDown = false;
  private retryMs = 250;
  private initializeId?: string;

  constructor(private readonly options: PiClientOptions) {
    if (!/^wss?:\/\/[^\s]+$/.test(options.endpoint)) throw new SDKError("invalidRequest", "An explicit ws:// or wss:// endpoint is required.");
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
    this.maxMessageCharacters = options.maxMessageCharacters ?? 16_777_216;
    this.maxSessions = options.maxSessions ?? 256;
    this.maxBufferedMessages = options.maxBufferedMessages ?? 64;
    const requestTimeoutMs = options.requestTimeoutMs ?? 10_000; const maxPendingRequests = options.maxPendingRequests ?? 64;
    for (const value of [this.connectTimeoutMs, this.maxMessageCharacters, this.maxSessions, this.maxBufferedMessages, requestTimeoutMs, maxPendingRequests]) if (!Number.isSafeInteger(value) || value <= 0) throw new SDKError("invalidRequest", "Client limits must be positive safe integers.");
    this.capabilities = [...new Set(options.capabilities ?? capabilitySchema.options)];
    this.pending = new PendingRequests({ scheduler: this.scheduler, timeoutMs: requestTimeoutMs, maxPending: maxPendingRequests }, { cancelled: "Stopped waiting; the server outcome may be unknown. No retry was sent.", disconnected: "Connection lost; the server outcome is unknown. No retry was sent." });
  }
  getState(): ReadonlyDeep<ClientState> { return this.state; }
  getSession(id: string): ReadonlyDeep<SessionState> | undefined { return Object.hasOwn(this.state.sessions, id) ? this.state.sessions[id] : undefined; }
  subscribe(listener: (state: ReadonlyDeep<ClientState>) => void): () => void { this.assertAlive(); this.stateListeners.add(listener); return () => { this.stateListeners.delete(listener); }; }
  onMessage(listener: (message: ReadonlyDeep<ServerMessage>) => void): () => void { this.assertAlive(); this.messageListeners.add(listener); return () => { this.messageListeners.delete(listener); }; }
  onError(listener: (error: SDKError) => void): () => void { this.assertAlive(); this.errorListeners.add(listener); return () => { this.errorListeners.delete(listener); }; }
  start(): void {
    this.assertAlive(); if (this.running || this.state.connection.phase === "superseded") return;
    this.running = true; this.retryMs = 250; const generation = this.generation;
    this.publish({ ...this.state, connection: { phase: "connecting" } });
    if (this.active(generation)) this.timer = this.scheduler.setTimeout(() => this.connect(), 0);
  }
  takeControl(): void { this.assertAlive(); this.detach(); this.running = false; this.publish({ ...this.state, connection: { phase: "stopped" } }); this.start(); }
  stop(): void { this.shutdown("stopped"); }
  dispose(): void { this.shutdown("disposed"); }

  /** One typed correlation path. A resolved acceptance is not eventual settlement. */
  request<M extends Method>(method: M, params: Params<M>, sessionId?: string, options: RequestOptions = {}): Promise<Result<M>> {
    try {
      this.assertAlive();
      if (!this.transport || this.state.connection.phase !== "ready") throw new SDKError("notConnected", "Not connected to the Pi server.");
      if (method === "server.initialize") throw new SDKError("invalidRequest", "Initialization is owned by the connection lifecycle.");
      const spec = method && operationCapability(method);
      if (spec && !this.state.capabilities.includes(spec)) throw new SDKError("unsupportedOperation", "The operation capability was not selected.");
      if (this.connectionRequests >= 4095) { this.lost(new SDKError("limitExceeded", "Request identifier budget exhausted; reconnecting before further requests.")); throw new SDKError("notConnected", "Reconnect before sending more requests."); }
      const requestId = this.nextId(); const parsed = requestSchema.safeParse({ version: 2, type: "request", requestId, method, params, ...(sessionId === undefined ? {} : { sessionId }) });
      if (!parsed.success) throw new SDKError("invalidRequest", "Invalid v2 request.", "notSent", requestId);
      return this.pending.request(requestId, { kind: method, sessionId }, () => { ++this.connectionRequests; this.sendFrame(parsed.data); }, options.signal) as Promise<Result<M>>;
    } catch (error) { return Promise.reject(error); }
  }
  prompt(id: string, message: string) { return this.request("message.send", { message }, id); }
  abort(id: string) { return this.request("run.abort", {}, id); }
  respondToPrompt(id: string, promptId: string, result: UiPromptResult) { return this.request("prompt.answer", { promptId, result }, id); }
  selectModel(id: string, model: string) { return this.request("model.select", { model }, id); }
  setThinkingLevel(id: string, level: ThinkingLevel) { return this.request("thinking.level", { level }, id); }
  compactSession(id: string) { return this.request("session.compact", {}, id); }
  reloadSession(id: string) { return this.request("session.reload", {}, id); }
  runExtensionAction(id: string, actionId: string) { return this.request("extension.run", { actionId }, id); }
  restartServer() { return this.request("server.restart", {}); }
  async closeSession(id: string): Promise<void> { await this.request("session.close", {}, id); }
  async openSession(sessionPath: string, options: RequestOptions = {}): Promise<string> { return (await this.request("session.open", { sessionPath }, undefined, options)).snapshot.sessionId; }
  async createSession(projectPath?: string, options: RequestOptions = {}): Promise<string> { return (await this.request("session.create", { projectPath }, undefined, options)).snapshot.sessionId; }
  browseDirectories(query: DirectoryBrowse, options: RequestOptions = {}): Promise<DirectoryListing> { return this.request("directory.browse", query, undefined, options); }
  async completeCommandArguments(id: string, commandName: string, argumentPrefix: string, options: RequestOptions = {}): Promise<CommandCompletionItem[]> { return (await this.request("command.complete", { commandName, argumentPrefix }, id, options)).items; }
  openFile(id: string, path: string, options: RequestOptions = {}): Promise<void> {
    const key = JSON.stringify([id, path]); const existing = options.signal ? undefined : this.fileWaits.get(key);
    if (existing) return existing;
    const pending = this.request("file.open", { path }, id, options).then(() => {});
    if (options.signal) return pending;
    this.fileWaits.set(key, pending);
    void pending.then(() => { if (this.fileWaits.get(key) === pending) this.fileWaits.delete(key); }, () => { if (this.fileWaits.get(key) === pending) this.fileWaits.delete(key); });
    return pending;
  }
  async archiveSession(path: string, archived: boolean, options: RequestOptions = {}): Promise<void> { await this.request("session.archive", { path, archived }, undefined, options); }
  async pinProject(path: string, pinned: boolean, options: RequestOptions = {}): Promise<void> { await this.request("project.pin", { path, pinned }, undefined, options); }
  async removeProject(path: string, options: RequestOptions = {}): Promise<void> { await this.request("project.remove", { path }, undefined, options); }
  private nextId(): string { if (this.requestSequence >= Number.MAX_SAFE_INTEGER) throw new SDKError("limitExceeded", "Request identifiers exhausted; create a fresh client."); return `sdk-${++this.requestSequence}`; }
  private sendFrame(value: unknown): void {
    if (!this.transport) throw new SDKError("notConnected", "Not connected to the Pi server.");
    try { this.transport.send(JSON.stringify(value)); } catch (error) { if (error instanceof SDKError) throw error; throw new SDKError("transportError", "Unable to send; the server outcome is unknown. No retry was sent.", "unknown"); }
  }
  private assertAlive(): void { if (this.state.connection.phase === "disposed") throw new SDKError("disposed", "PiClient is disposed."); if (this.shuttingDown) throw new SDKError("stopped", "PiClient is stopping."); }
  private active(generation: number): boolean { return this.running && generation === this.generation; }
  private connect(): void {
    this.timer = undefined; if (!this.running) return; const generation = ++this.generation; this.connectionRequests = 0;
    this.publish({ ...this.state, connection: { phase: "connecting" } }); if (!this.active(generation)) return;
    this.watchdog = this.scheduler.setTimeout(() => { if (this.active(generation)) this.lost(new SDKError("timeout", "Timed out connecting or synchronizing with the Pi server.")); }, this.connectTimeoutMs);
    let opened = false;
    const initialize = () => {
      if (!this.active(generation) || !this.transport) return;
      this.publish({ ...this.state, connection: { phase: "synchronizing" } });
      if (!this.active(generation)) return;
      this.initializeId = this.nextId();
      try { this.sendFrame({ version: 2, type: "request", requestId: this.initializeId, method: "server.initialize", params: { client: { name: "pi-sdk-typescript", version: "0.0.0" }, capabilities: this.capabilities } }); }
      catch (error) { this.lost(error instanceof SDKError ? error : new SDKError("transportError", "Initialization could not be sent.")); }
    };
    try {
      const transport = this.options.transport(this.options.endpoint, {
        open: () => { if (!this.active(generation)) return; opened = true; initialize(); },
        message: text => { if (this.active(generation)) this.enqueue(text, generation); },
        close: event => { if (this.active(generation)) this.lost(new SDKError(event.code === CONTROLLER_REPLACED_CODE ? "superseded" : "disconnected", event.reason || "Connection lost."), event.code === CONTROLLER_REPLACED_CODE); },
        error: () => { if (this.active(generation)) this.report(new SDKError("transportError", "WebSocket transport reported an error.")); },
      });
      if (this.active(generation)) { this.transport = transport; if (opened && !this.initializeId) initialize(); } else this.release(transport);
    } catch { if (this.active(generation)) this.lost(new SDKError("transportError", "Unable to create the WebSocket transport.")); }
  }
  private enqueue(text: string, generation: number): void {
    if (this.inbox.length >= this.maxBufferedMessages || this.bufferedCharacters + text.length > this.maxMessageCharacters) { this.fail(new SDKError("limitExceeded", "Inbound queue exceeded the client limit; resynchronization is required.")); return; }
    this.inbox.push({ text, generation }); this.bufferedCharacters += text.length;
    if (this.processing) return; this.processing = true;
    try { while (this.inbox.length) { const item = this.inbox.shift()!; this.bufferedCharacters -= item.text.length; if (this.active(item.generation)) this.receive(item.text, item.generation); } } finally { this.processing = false; }
  }
  private receive(text: string, generation: number): void {
    let message: ServerMessage;
    try { message = serverMessageSchema.parse(JSON.parse(text)); } catch { this.fail(new SDKError("invalidMessage", "Unsupported or malformed v2 server message.")); return; }
    try {
      if (message.type === "protocolError") { if (this.state.connection.phase === "ready" && message.serverInstanceId !== this.state.serverInstanceId) return; this.fail(new SDKError(message.error.code, message.error.message, "rejected", undefined, message.error.details)); return; }
      if (message.type === "response") {
        if (message.requestId === this.initializeId) {
          const result = parseResponse("server.initialize", message);
          if (!result.ok) { this.fail(new SDKError(result.error.code, result.error.message, "rejected", message.requestId, result.error.details)); return; }
          this.initialize(result.result); this.initializeId = undefined;
        } else {
          const pending = this.pending.get(message.requestId); if (!pending) return;
          const method = pending.kind as Method; const parsed = parseResponse(method, message);
          if (parsed.ok) { this.result(method, parsed.result, pending.sessionId); this.pending.resolve(message.requestId, parsed.result); }
          else this.pending.rejectError(message.requestId, new SDKError(parsed.error.code, parsed.error.message, "rejected", message.requestId, parsed.error.details));
        }
      } else {
        if (this.state.connection.phase !== "ready") throw new Error("Event before initialization");
        if (message.serverInstanceId !== this.state.serverInstanceId) return;
        this.event(message);
      }
    } catch (error) { this.fail(error instanceof SDKError ? error : new SDKError("invalidMessage", "Invalid response or inconsistent required server state.")); return; }
    if (this.active(generation)) this.notify(this.messageListeners, freeze(message));
  }
  private initialize(result: Result<"server.initialize">): void {
    const ids = result.inventory.sessions.map(s => s.sessionId); const snapshots = result.snapshots.map(s => s.sessionId);
    if (ids.length > this.maxSessions) throw new SDKError("limitExceeded", "Initial inventory exceeds the client limit.");
    if (new Set(ids).size !== ids.length || new Set(snapshots).size !== snapshots.length || ids.length !== snapshots.length || ids.some(id => !snapshots.includes(id)) || result.capabilities.some(c => !this.capabilities.includes(c))) throw new Error("Invalid initial inventory");
    const sessions = Object.fromEntries(result.snapshots.map(snapshot => [snapshot.sessionId, applySnapshot(initialSessionState, snapshot)]));
    this.retryMs = 250; if (this.watchdog !== undefined) this.scheduler.clearTimeout(this.watchdog); this.watchdog = undefined;
    this.publish({ connection: { phase: "ready" }, serverInstanceId: result.serverInstanceId, connectionId: result.connectionId, capabilities: result.capabilities, sessions, inventory: result.inventory.sessions, inventoryRevision: result.inventory.revision, catalogue: result.projects.catalogue, projectsRevision: result.projects.revision,
      features: result.capabilities.includes("server.restart") ? [{ id: "app.restart", kind: "action", group: "app", title: "Restart server", state: { label: "Restart" } }] : [] });
  }
  private result(method: Method, value: unknown, sessionId?: string): void {
    if (method === "session.create" || method === "session.open") { const result = value as Result<"session.open">; if (result.summary.sessionId !== result.snapshot.sessionId) throw new Error("Open identity mismatch"); this.snapshot(result.snapshot);
      if (!this.state.inventory.some(s => s.sessionId === result.summary.sessionId)) this.publish({ ...this.state, inventory: [...this.state.inventory, result.summary] });
    }
    else if (method === "session.snapshot") { const snapshot = value as SessionSnapshot; if (snapshot.sessionId !== sessionId) throw new Error("Snapshot identity mismatch"); this.snapshot(snapshot); }
    else if (method === "session.list") this.inventory(value as Result<"session.list">);
    else if (method === "project.list") this.projects(value as Result<"project.list">);
    else if ((method === "model.select" || method === "thinking.level") && sessionId && Object.hasOwn(this.state.sessions, sessionId)) {
      const current = this.state.sessions[sessionId]!; this.publish({ ...this.state, sessions: { ...this.state.sessions, [sessionId]: { ...current, settings: value as Result<"model.select"> } } });
    }
  }
  private inventory(value: Result<"session.list">): void {
    if (value.revision <= this.state.inventoryRevision) return;
    if (value.sessions.length > this.maxSessions || new Set(value.sessions.map(s => s.sessionId)).size !== value.sessions.length) throw new Error("Inventory limit or duplicate");
    const ids = value.sessions.map(s => s.sessionId);
    for (const id of Object.keys(this.state.sessions)) if (!ids.includes(id)) this.forget(id);
    this.publish({ ...this.state, inventoryRevision: value.revision, inventory: value.sessions });
  }
  private projects(value: Result<"project.list">): void { if (value.revision > this.state.projectsRevision) this.publish({ ...this.state, catalogue: value.catalogue, projectsRevision: value.revision }); }
  private forget(id: string): void {
    this.pending.closeSession(id, "session.close"); this.gaps.delete(id); this.recovering.delete(id);
    const sessions = { ...this.state.sessions }; delete sessions[id];
    this.publish({ ...this.state, sessions, inventory: this.state.inventory.filter(s => s.sessionId !== id) });
  }
  private snapshot(snapshot: SessionSnapshot): void {
    if (!Object.hasOwn(this.state.sessions, snapshot.sessionId) && Object.keys(this.state.sessions).length >= this.maxSessions) throw new Error("Session limit");
    const state = Object.hasOwn(this.state.sessions, snapshot.sessionId) ? this.state.sessions[snapshot.sessionId]! : initialSessionState;
    const session = applySnapshot(state, snapshot); this.publish({ ...this.state, sessions: { ...this.state.sessions, [snapshot.sessionId]: session } });
    this.replay(snapshot.sessionId);
  }
  /**
   * One atomic handoff for a switched runtime: the previous incarnation and its
   * inventory entry are swapped for the replacement in a single published state,
   * so a selected tab never observes an inventory containing neither identity.
   * Navigation remains application-owned and is not decided here.
   */
  private replace(previous: string, snapshot: SessionSnapshot): void {
    this.pending.closeSession(previous, "session.close");
    this.gaps.delete(previous); this.recovering.delete(previous);
    const sessions = { ...this.state.sessions }; delete sessions[previous];
    const base = Object.hasOwn(sessions, snapshot.sessionId) ? sessions[snapshot.sessionId]! : initialSessionState;
    sessions[snapshot.sessionId] = applySnapshot(base, snapshot);
    const index = this.state.inventory.findIndex(entry => entry.sessionId === previous);
    const summary = replacementSummary(snapshot);
    const inventory = index === -1
      ? (this.state.inventory.some(entry => entry.sessionId === summary.sessionId) ? this.state.inventory : [...this.state.inventory, summary])
      : this.state.inventory.map((entry, position) => position === index ? summary : entry);
    this.publish({ ...this.state, sessions, inventory });
    this.replay(snapshot.sessionId);
  }
  private replay(id: string): void {
    const buffered = this.gaps.get(id); this.gaps.delete(id); this.recovering.delete(id);
    for (const message of buffered?.sort((a, b) => a.sequence - b.sequence) ?? []) {
      const current = this.state.sessions[id];
      if (current && message.sequence > current.sequence + 1) throw new SDKError("invalidMessage", "Recovery snapshot did not heal the sequence gap.");
      this.event(message);
    }
  }
  private event(message: Event): void {
    if (message.event === "session.list.changed") { this.inventory(message.data); return; }
    if (message.event === "project.list.changed") { this.projects(message.data); return; }
    if (message.event === "session.replaced") {
      const previous = message.data.previousSessionId;
      if (!Object.hasOwn(this.state.sessions, previous)) return;
      this.replace(previous, message.data.snapshot); return;
    }
    if (message.event === "server.stopping") return;
    if (message.event === "session.snapshot") {
      if (message.sessionId !== message.data.sessionId) throw new Error("Snapshot identity mismatch");
      if (Object.hasOwn(this.state.sessions, message.sessionId) || this.state.inventory.some(s => s.sessionId === message.sessionId)) this.snapshot(message.data); return;
    }
    const id = message.sessionId; const state = Object.hasOwn(this.state.sessions, id) ? this.state.sessions[id] : undefined;
    if (message.event === "presentation.changed") { if (state) this.publish({ ...this.state, sessions: { ...this.state.sessions, [id]: reduceSessionMessage(state, message) } }); return; }
    if (!state && !this.state.inventory.some(s => s.sessionId === id)) return;
    if (state && message.sequence <= state.sequence) return;
    if (!state || message.sequence !== state.sequence + 1 || this.recovering.has(id)) {
      const buffered = this.gaps.get(id) ?? [];
      if ([...this.gaps.values()].reduce((count, list) => count + list.length, 0) >= this.maxBufferedMessages) throw new SDKError("limitExceeded", "Snapshot recovery buffer exceeds the client limit.");
      buffered.push(message); this.gaps.set(id, buffered);
      if (!this.recovering.has(id)) {
        this.recovering.add(id); const generation = this.generation;
        void this.request("session.snapshot", {}, id).catch(error => { if (this.active(generation)) this.lost(error instanceof SDKError ? error : new SDKError("invalidMessage", "Snapshot recovery failed.")); });
      }
      return;
    }
    if (message.event === "session.closed") { this.forget(id); return; }
    this.publish({ ...this.state, sessions: { ...this.state.sessions, [id]: reduceSessionMessage(state, message) } });
  }
  private publish(next: ClientState): void { this.state = freeze(next); this.notify(this.stateListeners, this.state); }
  private notify<T>(listeners: Set<(value: T) => void>, value: T): void { for (const listener of [...listeners]) { if (!listeners.has(listener)) continue; try { listener(value); } catch { this.report(new SDKError("listenerError", "A client subscriber threw an exception.")); } } }
  private report(error: SDKError): void { for (const listener of [...this.errorListeners]) { try { listener(error); } catch { /* Diagnostics cannot break cleanup. */ } } }
  private release(transport: Transport): void { try { transport.dispose(); } catch {} try { transport.close(); } catch {} }
  private detach(reason = new SDKError("disconnected", "Connection lost.")): void {
    ++this.generation; this.initializeId = undefined; this.pending.disconnect(reason); this.gaps.clear(); this.recovering.clear(); this.fileWaits.clear(); this.inbox.length = 0; this.bufferedCharacters = 0;
    if (this.timer !== undefined) this.scheduler.clearTimeout(this.timer); if (this.watchdog !== undefined) this.scheduler.clearTimeout(this.watchdog); this.timer = undefined; this.watchdog = undefined;
    const transport = this.transport; this.transport = undefined; if (transport) this.release(transport);
  }
  private disconnectedSessions(superseded = false): Record<string, SessionState> { return Object.fromEntries(Object.entries(this.state.sessions).map(([id, state]) => [id, reduceSessionMessage(state, { type: superseded ? "superseded" : "connectionLost" })])); }
  private lost(error: SDKError, superseded = false): void {
    this.detach(error); const generation = this.generation; if (superseded) this.running = false;
    this.publish({ ...this.state, sessions: this.disconnectedSessions(superseded), connection: { phase: superseded ? "superseded" : "reconnecting", error: { code: error.code, message: error.message } } }); this.report(error);
    if (!this.active(generation)) return; this.timer = this.scheduler.setTimeout(() => this.connect(), this.retryMs); this.retryMs = Math.min(this.retryMs * 2, 5000);
  }
  private fail(error: SDKError): void { this.running = false; this.detach(error); this.publish({ ...this.state, sessions: this.disconnectedSessions(), connection: { phase: "failed", error: { code: error.code, message: error.message } } }); this.report(error); }
  private shutdown(phase: "stopped" | "disposed"): void {
    if (this.state.connection.phase === "disposed" || this.shuttingDown) return; this.shuttingDown = true;
    try { this.running = false; this.detach(new SDKError(phase, `PiClient ${phase}.`)); this.publish({ ...this.state, sessions: this.disconnectedSessions(), connection: { phase } }); }
    finally { this.stateListeners.clear(); this.messageListeners.clear(); this.errorListeners.clear(); this.shuttingDown = false; }
  }
}
import { operationSchemas } from "./contract/v2.js";
function operationCapability(method: Method): Capability | undefined { return operationSchemas[method].capability; }
