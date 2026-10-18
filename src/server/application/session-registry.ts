import { resolve } from "node:path";
import { realpathSync } from "node:fs";

function sessionPathKey(path: string): string {
  try { return realpathSync(path); } catch { return resolve(path); }
}
import type { RuntimeAdapter, RuntimeEvent } from "../runtime/contracts.js";

export interface OpenSession {
  sessionId: string;
  adapter: RuntimeAdapter;
}

interface Entry extends OpenSession {
  unsubscribe: () => void;
}

/**
 * Holds every live runtime. UI tab order and focus are client-owned.
 */
export class SessionRegistry {
  private readonly entries: Entry[] = [];
  private readonly closing = new Map<string, Promise<void>>();

  constructor(private readonly onEvent: (sessionId: string, event: RuntimeEvent) => void) {}

  /** Returns an existing runtime instead of registering it twice. */
  add(adapter: RuntimeAdapter): OpenSession {
    const sessionId = adapter.snapshot().sessionId;
    const existing = this.entries.find((entry) => entry.sessionId === sessionId);
    if (existing) {
      return existing;
    }

    const entry: Entry = {
      sessionId,
      adapter,
      unsubscribe: () => {},
    };
    entry.unsubscribe = adapter.subscribe((event) => this.onEvent(entry.sessionId, event));
    this.entries.push(entry);
    return entry;
  }

  /**
   * Swaps in a freshly built runtime for a session that stays open.
   *
   * In-place reload preserves runtime identity; only the adapter instance changes.
   */
  async replace(sessionId: string, adapter: RuntimeAdapter): Promise<OpenSession> {
    const index = this.entries.findIndex((entry) => entry.sessionId === sessionId);
    if (index === -1) throw new Error(`Unknown session: ${sessionId}`);
    const replacementId = adapter.snapshot().sessionId;
    if (replacementId !== sessionId) {
      await adapter.dispose();
      throw new Error(`Reloaded session has id ${replacementId}, expected ${sessionId}.`);
    }

    const previous = this.entries[index]!;
    const entry: Entry = {
      sessionId,
      adapter,
      unsubscribe: () => {},
    };
    entry.unsubscribe = adapter.subscribe((event) => this.onEvent(entry.sessionId, event));
    this.entries[index] = entry;
    previous.unsubscribe();
    await previous.adapter.dispose();
    return entry;
  }

  rekey(previousSessionId: string, nextSessionId: string): void {
    const entry = this.entries.find((item) => item.sessionId === previousSessionId);
    if (!entry || previousSessionId === nextSessionId) return;
    const duplicate = this.entries.find((item) => item !== entry && item.sessionId === nextSessionId);
    if (duplicate) throw new Error(`Session is already open: ${nextSessionId}`);
    entry.sessionId = nextSessionId;
  }

  get(sessionId: string): RuntimeAdapter {
    const entry = this.entries.find((item) => item.sessionId === sessionId);
    if (!entry) throw new Error(`Unknown session: ${sessionId}`);
    return entry.adapter;
  }

  has(sessionId: string): boolean {
    return this.entries.some((entry) => entry.sessionId === sessionId);
  }

  findByPath(sessionPath: string): OpenSession | undefined {
    const key = sessionPathKey(sessionPath);
    return this.entries.find((entry) => {
      const path = entry.adapter.snapshot().sessionPath;
      return path !== undefined && sessionPathKey(path) === key;
    });
  }

  list(): OpenSession[] {
    return this.entries.map(({ sessionId, adapter }) => ({ sessionId, adapter }));
  }


  async close(sessionId: string): Promise<void> {
    const pending = this.closing.get(sessionId);
    if (pending) return pending;
    const disposal = this.disposeEntry(sessionId);
    this.closing.set(sessionId, disposal);
    try { await disposal; } finally { this.closing.delete(sessionId); }
  }

  private async disposeEntry(sessionId: string): Promise<void> {
    const index = this.entries.findIndex((entry) => entry.sessionId === sessionId);
    if (index === -1) return;
    const entry = this.entries[index]!;
    // Keep identity/subscriptions until disposal is confirmed. A partial failure
    // must remain discoverable so the controller can explicitly retry close.
    await entry.adapter.dispose();
    entry.unsubscribe();
    const currentIndex = this.entries.indexOf(entry);
    if (currentIndex !== -1) this.entries.splice(currentIndex, 1);
  }

  async dispose(): Promise<void> {
    for (const entry of [...this.entries]) await this.close(entry.sessionId);
  }

}
