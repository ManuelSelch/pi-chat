import { randomUUID } from "node:crypto";
import type { UiPrompt, UiPromptResult } from "../shared/protocol.js";

/** A forgotten dialog must not block an extension (or a tool call) forever. */
export const PROMPT_TIMEOUT_MS = 5 * 60_000;
/**
 * A reload should not cancel a permission gate, so a prompt survives a short
 * time without a controlling browser before it gives up.
 */
export const DISCONNECT_GRACE_MS = 60_000;

export type UiPromptRequest = Omit<UiPrompt, "id">;

interface PendingPrompt {
  prompt: UiPrompt;
  settle: (result: UiPromptResult) => void;
  timeout: ReturnType<typeof setTimeout>;
}

function schedule(callback: () => void, delay: number): ReturnType<typeof setTimeout> {
  const timer = setTimeout(callback, delay);
  // Never keep the server alive just because a dialog is open.
  timer.unref?.();
  return timer;
}

/**
 * Owns every blocking `ctx.ui` question. Extensions can nest prompts, so this
 * is a stack rather than a single slot, and each entry settles exactly once no
 * matter whether the answer, a timeout, or a teardown arrives first.
 */
export class UiPromptRegistry {
  private readonly pending = new Map<string, PendingPrompt>();
  private graceTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly onChange: (prompts: UiPrompt[]) => void,
    private readonly timeoutMs = PROMPT_TIMEOUT_MS,
    private readonly graceMs = DISCONNECT_GRACE_MS,
  ) {}

  ask(request: UiPromptRequest): Promise<UiPromptResult> {
    const prompt: UiPrompt = { id: randomUUID(), ...request };
    return new Promise<UiPromptResult>((resolve) => {
      this.pending.set(prompt.id, {
        prompt,
        settle: resolve,
        timeout: schedule(() => this.settle(prompt.id, { cancelled: true }), this.timeoutMs),
      });
      this.publish();
    });
  }

  /** Unknown or already-settled ids are ignored, so a late click is harmless. */
  respond(promptId: string, result: UiPromptResult): void {
    this.settle(promptId, result);
  }

  cancelAll(): void {
    for (const id of [...this.pending.keys()]) this.settle(id, { cancelled: true });
  }

  list(): UiPrompt[] {
    return [...this.pending.values()].map((entry) => entry.prompt);
  }

  /** Called when no browser is in control: start the grace period. */
  suspend(): void {
    if (this.graceTimer || this.pending.size === 0) return;
    this.graceTimer = schedule(() => {
      this.graceTimer = undefined;
      this.cancelAll();
    }, this.graceMs);
  }

  /** Called when a browser takes control again. */
  resume(): void {
    if (!this.graceTimer) return;
    clearTimeout(this.graceTimer);
    this.graceTimer = undefined;
  }

  dispose(): void {
    this.resume();
    this.cancelAll();
  }

  private settle(promptId: string, result: UiPromptResult): void {
    const entry = this.pending.get(promptId);
    if (!entry) return;
    clearTimeout(entry.timeout);
    this.pending.delete(promptId);
    entry.settle(result);
    this.publish();
  }

  private publish(): void {
    this.onChange(this.list());
  }
}
