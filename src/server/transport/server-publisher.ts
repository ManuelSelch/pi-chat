import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { firstUserMessage, sessionTitle } from "../../shared/session-title.js";
import { VERSION, snapshotSchema, promptSchema, type Event, type SessionSnapshot, type OpenSessionSummary, type ProtocolError, type Result } from "@manuelselch/pi-sdk/protocol";
import type { RuntimeEvent, RuntimeSnapshot } from "../runtime/contracts.js";
import type { ChatApplicationService } from "../application/chat-application-service.js";
import type { FileLogger } from "../logging/file-logger.js";
import { V2OperationError } from "./v2-connection.js";
import { redactRuntimeError } from "./runtime-error-redaction.js";

interface Incarnation { id: string; sequence: number; presentationRevision: number; presentationSignature?: string; runtime?: SessionSnapshot["runtime"]; closing?: boolean }
export class ServerPublisher {
  readonly serverInstanceId = randomUUID();
  private readonly sessions = new Map<string, Incarnation>();
  private inventoryRevision = 0;
  private projectRevision = 0;
  private projectScan = 0;
  private catalogue: Result<"project.list">["catalogue"] = { projects: [] };
  constructor(private readonly chat: ChatApplicationService, private readonly send: (event: Event) => void, private readonly logger?: FileLogger) {
    for (const id of chat.openSessionIds()) this.wireId(id);
  }
  wireId(raw: string): string {
    let entry = this.sessions.get(raw);
    if (!entry) { entry = { id: randomUUID(), sequence: 0, presentationRevision: 0 }; this.sessions.set(raw, entry); }
    return entry.id;
  }
  rawId(id: string, allowClosing = false): string {
    const found = [...this.sessions].find(([, entry]) => entry.id === id);
    if (!found || !this.chat.openSessionIds().includes(found[0])) throw new V2OperationError("sessionNotFound", "This runtime is no longer open.");
    if (found[1].closing && !allowClosing) throw new V2OperationError("sessionBusy", "This runtime is closing; only close may be retried.");
    return found[0];
  }
  settings(snapshot: RuntimeSnapshot): SessionSnapshot["settings"] {
    const model = snapshot.actions.features.find(feature => feature.id === "model.select");
    const thinking = snapshot.actions.features.find(feature => feature.id === "thinking.level");
    return { model: model?.state.value ?? "", availableModels: model?.state.options ?? [], thinkingLevel: thinking?.state.value ?? "off", availableThinkingLevels: thinking?.state.options ?? ["off"] };
  }
  private snapshot(raw: string, snapshot: RuntimeSnapshot): SessionSnapshot {
    const id = this.wireId(raw); const entry = this.sessions.get(raw)!;
    const presentation = { widgets: snapshot.widgets, footer: snapshot.footer, extensions: snapshot.extensions ?? { buttons: [], badges: [], state: {} } };
    const signature = JSON.stringify(presentation);
    if (entry.presentationSignature !== undefined && entry.presentationSignature !== signature) ++entry.presentationRevision;
    entry.presentationSignature = signature;
    const runtime = { status: entry.closing ? "closing" as const : snapshot.isStreaming ? "running" as const : "idle" as const,
      ...(entry.runtime?.runId ? { runId: entry.runtime.runId } : {}), ...(snapshot.lastError || entry.runtime?.lastError ? { lastError: snapshot.lastError ?? entry.runtime?.lastError } : {}) };
    return snapshotSchema.parse({ sessionId: id, throughSequence: entry.sequence, projectPath: snapshot.projectPath,
      sessionPath: snapshot.sessionPath, sessionName: snapshot.sessionName, messages: snapshot.messages,
      runtime, steeringMessages: snapshot.steeringMessages ?? [], settings: this.settings(snapshot), commands: snapshot.actions.commands, prompts: snapshot.prompts,
      presentation: { revision: entry.presentationRevision, ...presentation },
    });
  }
  inventory(): Result<"session.list"> {
    const sessions: OpenSessionSummary[] = this.chat.openSessionSnapshots().map(state => {
      const raw = state.sessionId; const runtime = this.sessions.get(raw); const projectName = basename(state.projectPath) || state.projectPath;
      const status = runtime?.closing ? "closing" : state.prompts.length ? "blocked" : state.isStreaming ? "running" : "idle";
      return { sessionId: this.wireId(raw), ...(state.sessionPath ? { sessionPath: state.sessionPath } : {}), title: sessionTitle(state.sessionName, firstUserMessage(state.messages)), projectPath: state.projectPath, projectName, status };
    });
    return { revision: this.inventoryRevision, sessions };
  }
  projects(): Result<"project.list"> { return { revision: this.projectRevision, catalogue: this.catalogue }; }
  async refreshProjects(metadataOnly = false): Promise<void> {
    const scan = ++this.projectScan;
    try {
      const catalogue = await this.chat.currentCatalogue({ metadataOnly });
      if (scan !== this.projectScan) return;
      this.catalogue = catalogue; ++this.projectRevision;
      this.global("project.list.changed", this.projects());
    } catch (error) { this.logger?.error("projects.refresh_failed", { message: redactRuntimeError(error instanceof Error ? error.message : "Refresh failed") }); }
  }
  async prepareSnapshot(id: string): Promise<() => SessionSnapshot> {
    const raw = this.rawId(id, true); const incarnation = this.sessions.get(raw)!;
    const capture = await this.chat.prepareSnapshot(raw);
    return () => {
      const snapshot = capture();
      if (!snapshot || this.sessions.get(raw) !== incarnation) throw new V2OperationError("sessionReplaced", "The runtime changed during snapshot preparation.");
      return this.snapshot(raw, snapshot);
    };
  }
  async opened(raw: string): Promise<Result<"session.open">> {
    const id = this.wireId(raw);
    let snapshot: SessionSnapshot;
    try { const capture = await this.prepareSnapshot(id); snapshot = capture(); }
    catch (error) {
      // Creation/open already succeeded. An extension refresh is not allowed to
      // reject that mutation; use a fresh synchronous core capture instead.
      if (this.rawId(id) !== raw) throw error;
      snapshot = this.snapshot(raw, this.chat.captureSnapshot(raw));
      this.logger?.warn("snapshot.open_refresh_failed", { message: "Using current runtime state after extension snapshot refresh failed." });
    }
    return { snapshot, summary: this.inventory().sessions.find(session => session.sessionId === snapshot.sessionId)! };
  }
  async prepareInitial(connectionId: string, capabilities: Result<"server.initialize">["capabilities"]): Promise<() => Result<"server.initialize">> {
    // Catalogue discovery is independent of the atomic runtime snapshot barrier.
    // Use the last published catalogue (empty on cold start) and notify clients
    // through project.list.changed when discovery finishes. A refresh finishing
    // before capture is included in the initial response instead.
    void this.refreshProjects();
    const rawIds = this.chat.openSessionIds();
    const captures = await Promise.all(rawIds.map(raw => this.prepareSnapshot(this.wireId(raw))));
    return () => {
      if (JSON.stringify(rawIds) !== JSON.stringify(this.chat.openSessionIds())) throw new V2OperationError("sessionBusy", "Runtime inventory changed during initialization; reconnect.");
      const snapshots = captures.map(capture => capture()).map(snapshot => {
        if (capabilities.includes("presentation")) return snapshot;
        const { presentation: _presentation, ...core } = snapshot; return core;
      });
      return { protocolVersion: VERSION, serverVersion: "0.1.0", serverInstanceId: this.serverInstanceId, connectionId, capabilities, inventory: this.inventory(), projects: this.projects(), snapshots };
    };
  }
  inventoryChanged(): void {
    const open = this.chat.openSessionIds();
    for (const raw of [...this.sessions.keys()]) if (!open.includes(raw)) this.closed(raw, "archived");
    ++this.inventoryRevision; this.global("session.list.changed", this.inventory());
  }
  closing(raw: string): void { this.sessions.get(raw)!.closing = true; this.core(raw, "runtime.status", { status: "closing" }); this.inventoryChanged(); }
  closed(raw: string, reason: "requested" | "archived" | "replaced" | "shutdown"): void {
    if (!this.sessions.has(raw)) return;
    this.core(raw, "session.closed", { reason }); this.sessions.delete(raw);
  }
  operation(id: string, operationId: string, requestId: string, outcome: "completed" | "failed" | "aborted", error?: ProtocolError): void {
    const raw = [...this.sessions].find(([, entry]) => entry.id === id)?.[0]; if (!raw) return;
    if (error) this.logger?.error("runtime.operation_error", { message: redactRuntimeError(error.message) });
    this.core(raw, "operation.finished", outcome === "failed" ? { operationId, requestId, outcome, error: error! } : { operationId, requestId, outcome });
  }
  publish(raw: string, event: RuntimeEvent): void {
    if (event.type === "sessionSwitch") {
      const previousSessionId = this.sessions.get(event.previousSessionId)?.id;
      // Atomic handoff: retire the previous incarnation here, but publish only
      // session.replaced. Emitting session.closed first would make clients drop
      // the old tab before the replacement is known and lose their selection.
      this.sessions.delete(event.previousSessionId);
      const id = this.wireId(event.sessionId);
      void this.prepareSnapshot(id).then(capture => {
        if (previousSessionId) this.global("session.replaced", { previousSessionId, snapshot: capture() });
      }).catch(error => {
        // The switch already succeeded. A failed extension refresh must not strand
        // clients on the retired incarnation; publish a synchronous core capture.
        this.logger?.warn("session.replace_failed", { message: redactRuntimeError(error instanceof Error ? error.message : "Replacement snapshot failed") });
        if (previousSessionId) this.global("session.replaced", { previousSessionId, snapshot: this.snapshot(event.sessionId, this.chat.captureSnapshot(event.sessionId)) });
      }).finally(() => this.inventoryChanged());
      return;
    }
    if (!this.chat.openSessionIds().includes(raw)) return;
    this.wireId(raw);
    if (event.type === "sessionMetadataChanged") { void this.sendSnapshot(raw); this.inventoryChanged(); void this.refreshProjects(); return; }
    if (event.type === "widgets" || event.type === "footer") {
      this.presentation(raw); return;
    }
    if (event.type === "notification" && event.level === "error") this.logger?.error("runtime.notification_error", { message: redactRuntimeError(event.message) });
    if (event.type === "runtimeStatus") {
      if (event.error) this.logger?.error("runtime.turn_error", { message: redactRuntimeError(event.error), status: event.status });
      const previous = this.sessions.get(raw)!.runtime;
      const runtime = { status: this.sessions.get(raw)!.closing ? "closing" as const : event.status, ...(event.status !== "idle" && previous?.runId ? { runId: previous.runId } : {}),
        ...(event.error ? { lastError: event.error } : event.status !== "running" && previous?.lastError ? { lastError: previous.lastError } : {}) };
      this.sessions.get(raw)!.runtime = runtime; this.core(raw, "runtime.status", runtime); this.inventoryChanged(); return;
    }
    if (event.type === "assistantDelta" || event.type === "thinkingDelta") {
      const entry = this.sessions.get(raw)!; entry.runtime = { status: "running", runId: event.runId };
      this.core(raw, event.type === "assistantDelta" ? "message.delta" : "message.thinking.delta", { runId: event.runId, delta: event.delta }); return;
    }
    if (event.type === "messageFinal") { this.core(raw, "message.finalized", { runId: event.runId, message: event.message }); return; }
    if (event.type === "toolEvent") { this.core(raw, "tool.updated", { runId: event.runId, tool: event.tool }); return; }
    if (event.type === "prompts") { this.core(raw, "prompt.list.changed", { prompts: event.prompts.map(prompt => promptSchema.parse(prompt)) }); this.inventoryChanged(); return; }
    if (event.type === "steeringQueue") { this.core(raw, "steering.queue.changed", { messages: event.messages }); return; }
    if (event.type === "notification") this.core(raw, "notification.created", { level: event.level, message: event.message });
  }
  async sendSnapshot(raw: string): Promise<void> {
    try { const capture = await this.prepareSnapshot(this.wireId(raw)); const snapshot = capture(); this.send({ version: VERSION, type: "event", event: "session.snapshot", serverInstanceId: this.serverInstanceId, sessionId: snapshot.sessionId, data: snapshot }); }
    catch (error) { this.logger?.warn("snapshot.failed", { message: error instanceof Error ? error.message : "Failed" }); }
  }
  presentation(raw: string): void {
    const snapshot = this.snapshot(raw, this.chat.captureSnapshot(raw));
    this.send({ version: VERSION, type: "event", event: "presentation.changed", serverInstanceId: this.serverInstanceId, sessionId: snapshot.sessionId, data: snapshot.presentation! });
  }
  settingsChanged(raw: string): void { this.core(raw, "settings.changed", this.settings(this.chat.captureSnapshot(raw))); }
  stopping(): void { this.global("server.stopping", { reason: "restart" }); }
  private core<N extends Extract<Event, { sequence: number }>["event"]>(raw: string, event: N, data: Extract<Event, { event: N }>["data"]): void {
    const entry = this.sessions.get(raw); if (!entry) return;
    this.send({ version: VERSION, type: "event", serverInstanceId: this.serverInstanceId, sessionId: entry.id, sequence: ++entry.sequence, event, data } as Event);
  }
  private global<N extends Extract<Event, { sessionId?: never }>["event"]>(event: N, data: Extract<Event, { event: N }>["data"]): void {
    this.send({ version: VERSION, type: "event", serverInstanceId: this.serverInstanceId, event, data } as Event);
  }
}
