import { homedir } from "node:os";
import type { ClientMessage, Tab, UiPromptResult, WebFeature } from "../shared/protocol.js";
import type { RuntimeAdapter, RuntimeEvent, RuntimeSnapshot } from "./runtime-adapter.js";
import { ProjectSessionService, type ProjectCatalogue } from "./project-session-service.js";
import type { RestartService } from "./restart-service.js";
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

/** The one command this service implements itself, added to every session's catalogue. */
const RELOAD_COMMAND = {
  name: "reload",
  description: "Reload this session's Pi runtime to pick up changed extensions",
};

export class ChatApplicationService {
  private readonly listeners = new Set<(sessionId: string, event: RuntimeEvent) => void>();
  private readonly sessions: SessionRegistry;
  private catalogueCache?: ProjectCatalogue;

  constructor(
    initialRuntime: RuntimeAdapter,
    private readonly factory: RuntimeAdapterFactory,
    private readonly projectSessions = new ProjectSessionService(),
    private readonly restartService?: RestartService,
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
    return { ...snapshot, actions: this.withAppActions(snapshot.actions), catalogue: await this.catalogue(snapshot) };
  }

  /**
   * App-level capabilities ride along with the session features the UI already
   * renders. Restart only appears when a server can genuinely replace itself,
   * so the button is never offered by a server that would stay down.
   *
   * /reload is added the same way: the session cannot list a command that
   * replaces the very runtime it belongs to. An extension of the same name wins,
   * because that one is what the session would actually dispatch.
   */
  private withAppActions(actions: RuntimeSnapshot["actions"]): RuntimeSnapshot["actions"] {
    const commands = actions.commands.some((command) => command.name === RELOAD_COMMAND.name)
      ? actions.commands
      : [...actions.commands, RELOAD_COMMAND].sort((left, right) => left.name.localeCompare(right.name));
    return { ...actions, features: [...actions.features, ...this.appFeatures()], commands };
  }

  /** Capabilities of the server itself, valid with or without an open session. */
  appFeatures(): WebFeature[] {
    if (!this.restartService) return [];
    return [
      {
        id: "app.restart",
        group: "app",
        kind: "action",
        title: "Restart server",
        description: "Rebuild the client and restart the Pi Chat server. Open sessions are closed.",
        state: { label: "Restart" },
      },
    ];
  }

  prompt(sessionId: string, message: string): Promise<void> {
    // /reload rebuilds the runtime itself, which only the registry can do, so it
    // is caught here instead of inside the adapter it replaces.
    if (this.isReloadCommand(sessionId, message)) return this.reloadSession(sessionId);
    return this.sessions.get(sessionId).prompt(message);
  }

  /** An extension that registers its own /reload keeps it; ours is the fallback. */
  private isReloadCommand(sessionId: string, message: string): boolean {
    const trimmed = message.trim();
    if (trimmed !== "/reload") return false;
    const registered = this.sessions.get(sessionId).snapshot().actions.commands;
    return !registered.some((command) => command.name === RELOAD_COMMAND.name);
  }

  /**
   * Rebuilds one session's Pi runtime from its session file, leaving the server
   * and every other tab alone.
   *
   * This is what picks up a changed extension: extensions are loaded when the
   * runtime is created, so a new one is the only way to see them short of
   * restarting the whole server. The transcript survives because it lives in the
   * session file, which the replacement reopens.
   */
  async reloadSession(sessionId: string): Promise<void> {
    const snapshot = this.sessions.get(sessionId).snapshot();
    if (snapshot.isStreaming) throw new Error("Wait for the current run to finish before reloading.");
    // Without a file on disk there is nothing to reopen: the replacement would
    // start empty and the transcript would be lost.
    if (!snapshot.sessionPath) throw new Error("This session has no file on disk yet, so it cannot be reloaded.");

    const replacement = await this.factory.openSession(snapshot.sessionPath);
    await this.sessions.replace(sessionId, replacement);
    this.catalogueCache = undefined;
    this.emit(sessionId, {
      type: "notification",
      level: "info",
      message: "Session reloaded: extensions, commands, and settings were read again.",
    });
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

  async newSession(path?: string): Promise<string> {
    const active = this.activeSessionId();
    const target = path ?? (active ? this.sessions.get(active).snapshot().projectPath : homedir());
    return this.openTab(() => this.factory.newSession(target));
  }

  /**
   * The catalogue the home screen searches. With every tab closed there is no
   * snapshot to fold in, so the on-disk sessions stand on their own.
   */
  async currentCatalogue(): Promise<ProjectCatalogue> {
    const active = this.activeSessionId();
    if (!active) return this.projectSessions.catalogue();
    return this.catalogue(this.sessions.get(active).snapshot());
  }

  focusTab(sessionId: string): void {
    this.sessions.focus(sessionId);
  }

  /**
   * Deleting a session whose runtime is still live would leave a tab pointing at
   * a file that no longer exists, so the tab is closed first. A streaming run is
   * still writing to that file, so it has to finish or be stopped.
   */
  async deleteSession(path: string): Promise<void> {
    const open = this.sessions.findByPath(path);
    if (open) {
      if (this.sessions.get(open.sessionId).snapshot().isStreaming) {
        throw new Error("That session is still running. Stop it before deleting it.");
      }
      await this.closeTab(open.sessionId);
    }
    await this.projectSessions.delete(path);
    this.catalogueCache = undefined;
  }

  /** Closing the last tab is allowed: the browser falls back to the home screen. */
  async closeTab(sessionId: string): Promise<void> {
    await this.sessions.close(sessionId);
    this.catalogueCache = undefined;
  }

  async runFeature(message: Extract<ClientMessage, { type: "runFeature" }>): Promise<void> {
    // Restart is app-level: it must work from the home screen too, where there
    // is no session to look up.
    if (message.featureId === "app.restart") {
      if (!this.restartService) throw new Error("This server cannot restart itself.");
      const failure = await this.restartService.restart();
      if (failure) throw new Error(`Restart cancelled, the server is still running: ${failure}`);
      return;
    }
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
