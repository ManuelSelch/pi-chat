import { z } from "zod";
import {
  VERSION, idSchema, initializeResultSchema, operationSchemas, requestSchema,
  type Request, type Result, type Capability, type ProtocolError, type ServerMessage, type JsonValue,
} from "@manuelselch/pi-sdk/contract/v2";

export class V2OperationError extends Error {
  constructor(readonly code: string, message: string, readonly details?: JsonValue) { super(message); }
  toWire(): ProtocolError { return { code: this.code, message: this.message, ...(this.details === undefined ? {} : { details: this.details }) }; }
}
export type V2Execution =
  | { kind: "completed"; result: unknown; afterResponse?(): Promise<void> | void }
  | { kind: "accepted"; operationId: string; run(): Promise<void | "aborted"> | void };
export interface V2ConnectionHost {
  serverInstanceId: string;
  connectionId: string;
  capabilities: readonly Capability[];
  isWritable(): boolean;
  isController(): boolean;
  /** Must not await: claim, snapshot capture and initial send form one publication turn. */
  claim(): void;
  send(message: ServerMessage): void;
  close(code: number, reason: string): void;
  /** Asynchronous preparation returns a synchronous fresh capture, not a stale snapshot. */
  prepareInitialize(params: Request<"server.initialize">["params"], capabilities: Capability[]): Promise<() => Result<"server.initialize">>;
  /** Validate/admit first. Accepted.run is deliberately invoked only after response send. */
  execute(request: Exclude<Request, Request<"server.initialize">>): Promise<V2Execution>;
  /** Server publisher owns per-runtime sequencing, independent of this connection's lifetime. */
  outcome(request: Request, operationId: string, outcome: "completed" | "failed" | "aborted", error?: ProtocolError): void;
}
export interface V2ConnectionLimits { maxPending?: number; maxRequestIds?: number; maxMessageCharacters?: number; initializeTimeoutMs?: number }
const envelopeSchema = z.object({ version: z.literal(VERSION), type: z.literal("request"), requestId: idSchema, method: z.string().min(1), params: z.unknown() });
function failure(error: unknown): ProtocolError {
  return error instanceof V2OperationError ? error.toWire() : { code: "operationFailed", message: "The server operation failed." };
}

/** Socket-independent v2 dispatcher used by the server transport. No v1 adapter. */
export class V2Connection {
  private readonly seen = new Set<string>();
  private pending = 0;
  private phase: "new" | "initializing" | "ready" | "closed" = "new";
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly limits: Required<V2ConnectionLimits>;
  private capabilities: Capability[] = [];

  constructor(private readonly host: V2ConnectionHost, limits: V2ConnectionLimits = {}) {
    this.limits = { maxPending: 64, maxRequestIds: 4096, maxMessageCharacters: 16_777_216, initializeTimeoutMs: 10_000, ...limits };
    for (const value of Object.values(this.limits)) if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Connection limits must be positive safe integers.");
    this.timer = setTimeout(() => this.fatal("initializationTimeout", "Initialization did not complete before the deadline."), this.limits.initializeTimeoutMs);
  }

  private get closed(): boolean { return this.phase === "closed"; }
  get ready(): boolean { return this.phase === "ready" && this.host.isController() && this.host.isWritable(); }
  dispose(): void { this.phase = "closed"; clearTimeout(this.timer); }

  receive(text: string): void {
    if (this.phase === "closed") return;
    if (text.length > this.limits.maxMessageCharacters) { this.fatal("limitExceeded", "Request frame exceeded the connection limit."); return; }
    let input: unknown;
    try { input = JSON.parse(text); } catch { this.protocolError("invalidRequest", "Message must be a JSON object."); return; }
    if (input !== null && typeof input === "object" && "version" in input && input.version !== VERSION) {
      this.protocolError("unsupportedVersion", "Only protocol version 2 is supported."); return;
    }
    const envelope = envelopeSchema.safeParse(input);
    if (!envelope.success) { this.protocolError("invalidRequest", "Invalid v2 request envelope."); return; }
    const { requestId, method } = envelope.data;
    if (this.seen.has(requestId)) { this.fatal("duplicateRequestId", "Request IDs must be unique within a connection."); return; }
    if (this.seen.size >= this.limits.maxRequestIds) { this.fatal("limitExceeded", "Request ID budget exhausted; initialize a fresh connection."); return; }
    this.seen.add(requestId);
    if (!(Object.hasOwn(operationSchemas, method))) { this.reject(requestId, { code: "unsupportedOperation", message: `Unsupported operation: ${method}` }); return; }
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success) { this.reject(requestId, { code: "invalidRequest", message: "Invalid parameters or session scope for this operation." }); return; }
    const request = parsed.data;
    if (request.method === "server.initialize") {
      if (this.phase !== "new") { this.reject(requestId, { code: "alreadyInitialized", message: "Initialize exactly once per connection." }); return; }
      this.phase = "initializing";
      void this.initialize(request);
      return;
    }
    if (!this.ready) {
      this.reject(requestId, { code: this.phase === "ready" ? "controllerReplaced" : "notInitialized", message: "Initialize and hold control before sending work." }); return;
    }
    const capability = operationSchemas[request.method].capability;
    if (capability && !this.capabilities.includes(capability)) { this.reject(requestId, { code: "unsupportedOperation", message: `Capability was not selected: ${capability}` }); return; }
    if (this.pending >= this.limits.maxPending) { this.reject(requestId, { code: "limitExceeded", message: "Too many concurrent requests." }); return; }
    ++this.pending;
    void this.execute(request);
  }

  private async initialize(request: Request<"server.initialize">): Promise<void> {
    try {
      const selected = [...new Set(request.params.capabilities.filter((capability): capability is Capability => this.host.capabilities.includes(capability as Capability)))];
      const capture = await this.host.prepareInitialize(request.params, selected);
      if (this.phase === "closed" || !this.host.isWritable()) return;
      const result = initializeResultSchema.parse(capture());
      this.checkInitialization(result, selected);
      // No await from fresh capture through claim/send. Later events follow the
      // full barrier, and unfinished initialization never displaces a controller.
      this.host.claim();
      if (this.closed || !this.host.isController()) return;
      this.capabilities = selected;
      this.reply(request.requestId, result, false);
      if (this.closed) return;
      this.phase = "ready";
      clearTimeout(this.timer);
    } catch (error) {
      this.reject(request.requestId, failure(error), false);
      this.dispose(); this.close(1011, "Initialization failed");
    }
  }

  private checkInitialization(result: Result<"server.initialize">, selected: Capability[]): void {
    const ids = result.inventory.sessions.map((session) => session.sessionId);
    const snapshots = result.snapshots.map((snapshot) => snapshot.sessionId);
    if (result.serverInstanceId !== this.host.serverInstanceId || result.connectionId !== this.host.connectionId
      || ids.length !== new Set(ids).size || snapshots.length !== new Set(snapshots).size
      || ids.length !== snapshots.length || ids.some((id) => !snapshots.includes(id))
      || selected.length !== result.capabilities.length || selected.some((capability) => !result.capabilities.includes(capability))
      || (!selected.includes("presentation") && result.snapshots.some((snapshot) => snapshot.presentation !== undefined))) {
      throw new V2OperationError("operationFailed", "Initial inventory, identities or selected capabilities were inconsistent.");
    }
  }

  private async execute(request: Exclude<Request, Request<"server.initialize">>): Promise<void> {
    let execution: V2Execution;
    try {
      execution = await this.host.execute(request);
      const result = operationSchemas[request.method].result.parse(execution.kind === "accepted" ? { state: "accepted", operationId: execution.operationId } : execution.result);
      this.reply(request.requestId, result);
    } catch (error) {
      this.reject(request.requestId, failure(error));
      --this.pending;
      return;
    }
    --this.pending;
    if (execution.kind === "completed") {
      try { await execution.afterResponse?.(); } catch { /* Mutation succeeded; a refresh failure is not its rejection. */ }
      return;
    }
    // Admission already happened even when the origin disconnected while a host
    // validator awaited. Do not cancel or reroute work; its response is uncertain.
    try {
      const outcome = await execution.run();
      this.finish(request, execution.operationId, outcome === "aborted" ? "aborted" : "completed");
    } catch (error) { this.finish(request, execution.operationId, "failed", failure(error)); }
  }

  private finish(request: Request, operationId: string, outcome: "completed" | "failed" | "aborted", error?: ProtocolError): void {
    // Restart's old process cannot promise an outcome in a successor process.
    if (request.method === "server.restart") return;
    try { this.host.outcome(request, operationId, outcome, error); } catch { /* State recovery, never a second request response. */ }
  }
  private reply(requestId: string, result: unknown, requireControl = true): void {
    this.send({ version: VERSION, type: "response", requestId, ok: true, result: result as JsonValue }, requireControl);
  }
  private reject(requestId: string, error: ProtocolError, requireControl = true): void {
    this.send({ version: VERSION, type: "response", requestId, ok: false, error }, this.phase === "ready" && requireControl);
  }
  private protocolError(code: string, message: string): void {
    this.send({ version: VERSION, type: "protocolError", serverInstanceId: this.host.serverInstanceId, error: { code, message } }, false);
  }
  private fatal(code: string, message: string): void {
    if (this.phase === "closed") return;
    this.protocolError(code, message); this.dispose(); this.close(1008, code);
  }
  private send(message: ServerMessage, requireControl: boolean): void {
    if (this.phase === "closed" || !this.host.isWritable() || (requireControl && !this.host.isController())) return;
    try { this.host.send(message); }
    catch { this.dispose(); this.close(1011, "Unable to publish response"); }
  }
  private close(code: number, reason: string): void { try { this.host.close(code, reason); } catch { /* Already closed. */ } }
}
