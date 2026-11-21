import { randomUUID } from "node:crypto";
import { uiPromptSchema, type UiPrompt, type UiPromptResult } from "@manuelselch/pi-sdk/protocol";

/** A forgotten dialog must not block an extension (or a tool call) forever. */
export const PROMPT_TIMEOUT_MS = 5 * 60_000;

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

  constructor(
    private readonly onChange: (prompts: UiPrompt[]) => void,
    private readonly timeoutMs = PROMPT_TIMEOUT_MS,
  ) {}

  ask(request: UiPromptRequest): Promise<UiPromptResult> {
    const prompt = uiPromptSchema.parse({ id: randomUUID(), ...request });
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

  dispose(): void {
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
