import type { ClientMessage, Tab, UiPromptResult } from "../shared/protocol.js";
import type { RuntimeAdapter, RuntimeEvent, RuntimeSnapshot } from "./runtime-adapter.js";
import { ProjectSessionService, type ProjectCatalogue } from "./project-session-service.js";
import { SessionRegistry } from "./session-registry.js";

function firstUserMessage(snapshot: RuntimeSnapshot): string | undefined {
  for (const message of snapshot.messages) {
    if (message.role === "user") return message.text;
  }
  return undefined;
}

export interface RuntimeAdapterFactory {
  continueProject(path: string): Promise<RuntimeAdapter>;
  openSession(path: string): Promise<RuntimeAdapter>;
  newSession(path: string): Promise<RuntimeAdapter>;
}

export class ChatApplicationService {
  private readonly listeners = new Set<(sessionId: string, event: RuntimeEvent) => void>();
  private readonly sessions: SessionRegistry;
  private catalogueCache?: ProjectCatalogue;

  constructor(
    initialRuntime: RuntimeAdapter,
    private readonly factory: RuntimeAdapterFactory,
    private readonly projectSessions = new ProjectSessionService(),
  ) {
    this.sessions = new SessionRegistry((sessionId, event) => this.emit(sessionId, event));
    this.sessions.add(initialRuntime);
  }

  tabs(): Tab[] {
    return this.sessions.tabs();
  }

  activeSessionId(): string {
    return this.sessions.activeSessionId();
  }

  openSessionIds(): string[] {
    return this.sessions.list().map((session) => session.sessionId);
  }

  async snapshot(sessionId = this.activeSessionId()): Promise<RuntimeSnapshot & { catalogue: ProjectCatalogue }> {
    const snapshot = this.sessions.get(sessionId).snapshot();
    return { ...snapshot, catalogue: await this.catalogue(snapshot) };
  }

  prompt(sessionId: string, message: string): Promise<void> {
    return this.sessions.get(sessionId).prompt(message);
  }

  abort(sessionId: string): Promise<void> {
    return this.sessions.get(sessionId).abort();
  }

  respondToPrompt(sessionId: string, promptId: string, result: UiPromptResult): void {
    this.sessions.get(sessionId).respondToPrompt(promptId, result);
  }

  /** No browser is in control: every session's dialogs start their grace period. */
  suspendPrompts(): void {
    for (const session of this.sessions.list()) session.adapter.suspendPrompts();
  }

  resumePrompts(): void {
    for (const session of this.sessions.list()) session.adapter.resumePrompts();
  }

  async openProject(path: string): Promise<string> {
    return this.openTab(() => this.factory.continueProject(path));
  }

  /** Opening an already-open session focuses its tab instead of duplicating it. */
  async openSession(path: string): Promise<string> {
    const open = this.sessions.findByPath(path);
    if (open) {
      this.sessions.focus(open.sessionId);
      return open.sessionId;
    }
    return this.openTab(() => this.factory.openSession(path));
  }

  async newSession(path = this.sessions.get(this.activeSessionId()).snapshot().projectPath): Promise<string> {
    return this.openTab(() => this.factory.newSession(path));
  }

  focusTab(sessionId: string): void {
    this.sessions.focus(sessionId);
  }

  async closeTab(sessionId: string): Promise<void> {
    // The last tab stays open: the app has no meaningful empty state.
    if (this.sessions.list().length <= 1) throw new Error("The last session cannot be closed.");
    await this.sessions.close(sessionId);
    this.catalogueCache = undefined;
  }

  async runFeature(message: Extract<ClientMessage, { type: "runFeature" }>): Promise<void> {
    const runtime = this.sessions.get(message.sessionId);
    if (message.featureId === "session.rename") {
      await runtime.renameSession(message.input.name);
      return;
    }
    if (message.featureId === "model.select") {
      await runtime.setModel(message.input.model);
      return;
    }
    if (message.featureId === "session.compact") {
      await runtime.compact();
      return;
    }
    if (runtime.snapshot().isStreaming) throw new Error("Wait for the current run to finish before changing controls.");
    await runtime.setThinkingLevel(message.input.level);
  }

  subscribe(listener: (sessionId: string, event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    this.listeners.clear();
    await this.sessions.dispose();
  }

  private async openTab(create: () => Promise<RuntimeAdapter>): Promise<string> {
    const adapter = await create();
    const { sessionId } = this.sessions.add(adapter);
    this.catalogueCache = undefined;
    return sessionId;
  }

  private async catalogue(snapshot: RuntimeSnapshot): Promise<ProjectCatalogue> {
    this.catalogueCache = await this.projectSessions.catalogue({
      id: snapshot.sessionId,
      path: snapshot.sessionPath,
      name: snapshot.sessionName,
      cwd: snapshot.projectPath,
      messageCount: snapshot.messages.filter((message) => message.role !== "tool").length,
      firstMessage: firstUserMessage(snapshot),
    });
    return this.catalogueCache;
  }

  private emit(sessionId: string, event: RuntimeEvent): void {
    for (const listener of this.listeners) listener(sessionId, event);
  }
}
