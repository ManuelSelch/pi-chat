/** Structural subset accepted by browser/Node AbortSignal; no DOM types needed. */
export interface CancellationSignal {
  readonly aborted: boolean;
  addEventListener(type: "abort", listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

/** Inject timers in tests/embedders. Handles are deliberately environment-neutral. */
export interface Scheduler {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

// ES-only builds do not import DOM or Node timer declarations. Both runtimes
// supply these standard functions; alternative hosts can inject a scheduler.
export const defaultScheduler: Scheduler = {
  setTimeout: (callback, delayMs) => (globalThis as unknown as Scheduler).setTimeout(callback, delayMs),
  clearTimeout: (handle) => (globalThis as unknown as Scheduler).clearTimeout(handle),
};
