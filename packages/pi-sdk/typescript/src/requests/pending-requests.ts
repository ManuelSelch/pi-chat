import { SDKError, type SDKErrorCode, type RequestOutcome } from "../errors.js";
import { defaultScheduler, type CancellationSignal, type Scheduler } from "../platform.js";

export interface RequestBudget { used: number; limit: number }
export interface TrackerOptions {
  scheduler?: Scheduler;
  timeoutMs?: number;
  maxPending?: number;
  budget?: RequestBudget;
}
interface Metadata { sessionId?: string; key?: string; kind?: string }
interface Entry<T> extends Metadata {
  promise: Promise<T>;
  sent: boolean;
  finish(value?: T, error?: Error): void;
}
interface Messages { cancelled: string; disconnected: string; timeout?: string; abortName?: boolean }

/** Common bounded lifetime management; never queues or retries an outgoing command. */
export class PendingRequests<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly scheduler: Scheduler;
  constructor(private readonly options: TrackerOptions, private readonly messages: Messages) { this.scheduler = options.scheduler ?? defaultScheduler; }
  get(id: string): Entry<T> | undefined { return this.entries.get(id); }
  findKey(key: string): Promise<T> | undefined { return [...this.entries.values()].find((entry) => entry.key === key)?.promise; }

  request(id: string, metadata: Metadata, send: () => void, signal?: CancellationSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(this.error("cancelled", this.messages.cancelled, "notSent", id));
    if (this.entries.has(id)) return Promise.reject(this.error("invalidRequest", "Duplicate request identifier.", "notSent", id));
    if (this.entries.size >= (this.options.maxPending ?? Infinity) || (this.options.budget && this.options.budget.used >= this.options.budget.limit)) {
      return Promise.reject(this.error("limitExceeded", "Too many pending requests on the server.", "notSent", id));
    }
    let resolve!: (value: T) => void; let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    let timer: unknown;
    const cancel = () => entry.finish(undefined, this.error("cancelled", this.messages.cancelled, entry.sent ? "unknown" : "notSent", id));
    const entry: Entry<T> = { ...metadata, promise, sent: false, finish: (value, error) => {
      if (!this.entries.delete(id)) return;
      if (this.options.budget) this.options.budget.used--;
      if (timer !== undefined) this.scheduler.clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if (error) reject(error); else resolve(value!);
    } };
    this.entries.set(id, entry);
    if (this.options.budget) this.options.budget.used++;
    if (this.options.timeoutMs) timer = this.scheduler.setTimeout(() => entry.finish(undefined,
      this.error("timeout", this.messages.timeout ?? "Stopped waiting for the server; the outcome is unknown. No retry was sent.", entry.sent ? "unknown" : "notSent", id)), this.options.timeoutMs);
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    if (!this.entries.has(id)) return promise;
    entry.sent = true;
    try { send(); }
    catch (error) {
      entry.finish(undefined, error instanceof SDKError
        ? this.error(error.code, error.message, error.outcome, id)
        : this.error("transportError", error instanceof Error ? error.message : "Unable to send request.", "unknown", id));
    }
    return promise;
  }
  resolve(id: string, value: T): void { this.entries.get(id)?.finish(value); }
  rejectError(id: string, error: SDKError): void { this.entries.get(id)?.finish(undefined, error); }
  reject(id: string, message: string): void { this.entries.get(id)?.finish(undefined, this.error("serverError", message, "rejected", id)); }
  closeSession(sessionId: string, exceptKind?: string): void {
    for (const [id, entry] of this.entries) if (entry.sessionId === sessionId && entry.kind !== exceptKind) entry.finish(undefined, this.error("cancelled", this.messages.cancelled, entry.sent ? "unknown" : "notSent", id));
  }
  retainSessions(ids: readonly string[]): void {
    for (const entry of this.entries.values()) if (entry.sessionId !== undefined && !ids.includes(entry.sessionId)) this.closeSession(entry.sessionId);
  }
  disconnect(reason?: SDKError): void {
    for (const [id, entry] of this.entries) entry.finish(undefined, this.error(reason?.code ?? "disconnected", reason?.message ?? this.messages.disconnected, entry.sent ? "unknown" : "notSent", id));
  }
  private error(code: SDKErrorCode, message: string, outcome: RequestOutcome, requestId: string): SDKError {
    const error = new SDKError(code, message, outcome, requestId);
    if (this.messages.abortName && ["cancelled", "disconnected"].includes(code)) error.name = "AbortError";
    return error;
  }
}
