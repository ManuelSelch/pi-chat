import { basename } from "node:path";
import type { Tab, TabStatus } from "../shared/protocol.js";
import { firstUserMessage, sessionTitle } from "../shared/session-title.js";
import type { RuntimeAdapter, RuntimeEvent } from "./runtime-adapter.js";

export interface OpenSession {
  sessionId: string;
  adapter: RuntimeAdapter;
}

interface Entry extends OpenSession {
  unsubscribe: () => void;
}

/**
 * Holds every live session. Tabs are concurrent rather than a swapped-in single
 * runtime: a background session must keep streaming while another is on screen.
 */
export class SessionRegistry {
  private readonly entries: Entry[] = [];
  private active?: string;

  constructor(private readonly onEvent: (sessionId: string, event: RuntimeEvent) => void) {}

  /** Returns the existing tab when the same session is opened twice. */
  add(adapter: RuntimeAdapter): OpenSession {
    const sessionId = adapter.snapshot().sessionId;
    const existing = this.entries.find((entry) => entry.sessionId === sessionId);
    if (existing) {
      this.active = sessionId;
      return existing;
    }

    const entry: Entry = {
      sessionId,
      adapter,
      unsubscribe: () => {},
    };
    entry.unsubscribe = adapter.subscribe((event) => this.onEvent(entry.sessionId, event));
    this.entries.push(entry);
    this.active = sessionId;
    return entry;
  }

  /**
   * Swaps in a freshly built runtime for a session that stays open.
   *
   * The tab keeps its place and its id, so the browser sees a new snapshot
   * rather than a closed and reopened tab. The replacement must therefore carry
   * the same session id; anything else would leave the client holding a tab
   * nothing answers for.
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
    if (this.active === previousSessionId) this.active = nextSessionId;
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
    return this.entries.find((entry) => entry.adapter.snapshot().sessionPath === sessionPath);
  }

  list(): OpenSession[] {
    return this.entries.map(({ sessionId, adapter }) => ({ sessionId, adapter }));
  }

  activeSessionId(): string {
    return this.active ?? this.entries[0]?.sessionId ?? "";
  }

  focus(sessionId: string): void {
    if (this.has(sessionId)) this.active = sessionId;
  }

  async close(sessionId: string): Promise<void> {
    const index = this.entries.findIndex((entry) => entry.sessionId === sessionId);
    if (index === -1) return;
    const [entry] = this.entries.splice(index, 1);
    entry!.unsubscribe();
    // Disposing cancels that session's pending prompts and its runtime.
    await entry!.adapter.dispose();
    if (this.active === sessionId) this.active = this.entries.at(index)?.sessionId ?? this.entries.at(-1)?.sessionId;
  }

  async dispose(): Promise<void> {
    for (const entry of [...this.entries]) await this.close(entry.sessionId);
  }

  tabs(): Tab[] {
    return this.entries.map(({ sessionId, adapter }) => {
      const snapshot = adapter.snapshot();
      const status: TabStatus = snapshot.prompts.length > 0
        ? "blocked"
        : snapshot.isStreaming
          ? "running"
          : "idle";
      return {
        sessionId,
        title: sessionTitle(snapshot.sessionName, firstUserMessage(snapshot.messages)),
        projectPath: snapshot.projectPath,
        projectName: basename(snapshot.projectPath) || snapshot.projectPath,
        status,
      };
    });
  }
}
