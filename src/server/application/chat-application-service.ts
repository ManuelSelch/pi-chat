import { homedir } from "node:os";
import type { DirectoryBrowse, DirectoryListing } from "../../shared/directories.js";
import { DirectoryBrowserService } from "../projects/directory-browser-service.js";
import type { FileOpenResult } from "../../shared/files.js";
import { FileService } from "../files/file-service.js";
import { fileOpenFailure } from "../files/file-open-error.js";
import type { ChatMessage, ClientMessage, Tab, UiPromptResult, WebFeature } from "../../shared/protocol.js";
import { getPiChatExtensionRegistry, type PiChatExtensionRegistry } from "../extensions/extension-registry.js";
import type { RuntimeAdapter, RuntimeAdapterFactory, RuntimeEvent, RuntimeSnapshot } from "../runtime/contracts.js";
import { ProjectSessionService } from "../projects/project-session-service.js";
import type { ProjectCatalogue } from "../projects/catalogue-types.js";
import type { RestartService } from "../bootstrap/restart-service.js";
import { SessionRegistry } from "./session-registry.js";
import { runFeatureAction } from "./feature-actions.js";

function firstUserMessage(snapshot: RuntimeSnapshot): string | undefined {
  for (const message of snapshot.messages) {
    if (message.role === "user") return message.text;
  }
  return undefined;
}

/** The one command this service implements itself, added to every session's catalogue. */
const RELOAD_COMMAND = {
  name: "reload",
  description: "Reload this session's Pi runtime to pick up changed extensions",
  source: "native" as const,
};

export class ChatApplicationService {
  private readonly listeners = new Set<(sessionId: string, event: RuntimeEvent) => void>();
  private readonly sessions: SessionRegistry;
  private catalogueCache?: ProjectCatalogue;
  private readonly sessionMutations = new Set<string>();
  private readonly pendingWork = new Map<string, number>();

  constructor(
    initialRuntime: RuntimeAdapter | undefined,
    private readonly factory: RuntimeAdapterFactory,
    private readonly projectSessions = new ProjectSessionService(),
    private readonly restartService?: RestartService,
    private readonly extensions: PiChatExtensionRegistry = getPiChatExtensionRegistry(),
    private readonly directories = new DirectoryBrowserService(),
    private readonly files = new FileService(),
  ) {
    this.sessions = new SessionRegistry((sessionId, event) => this.emit(sessionId, event));
    if (initialRuntime) this.sessions.add(initialRuntime);
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
    await this.extensions.emit("session.snapshot", { sessionId });
    return {
      ...snapshot,
      actions: this.withAppActions(snapshot.actions),
      catalogue: await this.catalogue(snapshot),
      extensions: this.extensions.snapshot({ sessionId }),
    };
  }

  /**
   * App-level capabilities ride along with the session features the UI already
   * renders. Restart only appears when a server can genuinely replace itself,
   * so the button is never offered by a server that would stay down.
   *
   * /reload is added the same way as an application-dispatched command.
   * An extension of the same name wins,
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

  async prompt(sessionId: string, message: string): Promise<string> {
    if (this.sessionMutations.has(sessionId)) throw new Error("That session is being archived. Try again when it finishes.");
    // Catch the fallback command here to serialize reload with session changes.
    if (this.isReloadCommand(sessionId, message)) {
      await this.reloadSession(sessionId);
      return sessionId;
    }
    if (this.sessionMutations.has(sessionId)) throw new Error("That session is being archived. Try again when it finishes.");
    const adapter = this.sessions.get(sessionId);
    const path = adapter.snapshot().sessionPath;
    this.pendingWork.set(sessionId, (this.pendingWork.get(sessionId) ?? 0) + 1);
    try {
      await adapter.prompt(message);
      const nextSessionId = adapter.snapshot().sessionId;
      if (nextSessionId !== sessionId) this.sessions.rekey(sessionId, nextSessionId);
      // Informational slash commands and /new do not resume the old task.
      if (path && !message.trim().startsWith("/")) await this.projectSessions.restoreIfArchived?.(path);
      this.catalogueCache = undefined;
      return nextSessionId;
    } finally {
      const count = (this.pendingWork.get(sessionId) ?? 1) - 1;
      if (count) this.pendingWork.set(sessionId, count);
      else this.pendingWork.delete(sessionId);
    }
  }

  /** An extension that registers its own /reload keeps it; ours is the fallback. */
  private isReloadCommand(sessionId: string, message: string): boolean {
    const trimmed = message.trim();
    if (trimmed !== "/reload") return false;
    const registered = this.sessions.get(sessionId).snapshot().actions.commands;
    return !registered.some((command) => command.name === RELOAD_COMMAND.name);
  }

  /** Reload resources in place, preserving the session and every other tab. */
  async reloadSession(sessionId: string): Promise<void> {
    const snapshot = this.sessions.get(sessionId).snapshot();
    if (snapshot.isStreaming || this.pendingWork.has(sessionId) || this.sessionMutations.has(sessionId)) throw new Error("Wait for the current run or session change to finish before reloading.");
    this.sessionMutations.add(sessionId);
    try {
      await this.sessions.get(sessionId).reload();
      this.catalogueCache = undefined;
      this.emit(sessionId, {
        type: "notification",
        level: "info",
        message: "Session reloaded: extensions, commands, and settings were read again.",
      });
    } finally { this.sessionMutations.delete(sessionId); }
  }

  completeCommandArguments(sessionId: string, commandName: string, argumentPrefix: string) {
    return this.sessions.get(sessionId).completeCommandArguments(commandName, argumentPrefix);
  }

  async openFile(sessionId: string, path: string): Promise<FileOpenResult> {
    let projectPath: string;
    try {
      // Read the named session only; do not invoke the app snapshot/catalogue path.
      projectPath = this.sessions.get(sessionId).snapshot().projectPath;
    } catch {
      return fileOpenFailure("sessionUnavailable", "This session is no longer available on the server.");
    }
    return this.files.open(projectPath, path);
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

  browseDirectories(request: DirectoryBrowse): Promise<DirectoryListing> {
    return this.directories.browse(request);
  }

  async openProject(path: string): Promise<string> {
    const target = await this.directories.validate(path);
    return this.openTab(() => this.factory.continueProject(target));
  }

  /** Opening an already-open session focuses its tab instead of duplicating it. */
  async openSession(path: string): Promise<string> {
    const open = this.sessions.findByPath(path);
    if (open) {
      if (this.sessionMutations.has(open.sessionId)) throw new Error("That session is being archived.");
      this.sessions.focus(open.sessionId);
      return open.sessionId;
    }
    return this.openTab(() => this.factory.openSession(path));
  }

  async newSession(path?: string): Promise<string> {
    const active = this.activeSessionId();
    const target = await this.directories.validate(path ?? (active ? this.sessions.get(active).snapshot().projectPath : homedir()));
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

  async pinProject(path: string, pinned: boolean): Promise<void> {
    const target = pinned ? await this.directories.validate(path) : path;
    await this.projectSessions.pin(target, pinned);
    this.catalogueCache = undefined;
  }

  async archiveSession(path: string, archived: boolean): Promise<void> {
    const open = this.sessions.findByPath(path);
    const sessionId = open?.sessionId;
    if (sessionId && (this.sessionMutations.has(sessionId) || this.pendingWork.has(sessionId) || this.sessions.get(sessionId).snapshot().isStreaming)) {
      throw new Error("That session is still running or changing. Stop it before archiving it.");
    }
    if (sessionId) this.sessionMutations.add(sessionId);
    try {
      // Persist first: a failed write must not close the user's tab.
      await this.projectSessions.archive(path, archived);
      if (archived && sessionId) await this.sessions.close(sessionId);
      this.catalogueCache = undefined;
    } finally { if (sessionId) this.sessionMutations.delete(sessionId); }
  }

  /** Closing the last tab is allowed: the browser falls back to the home screen. */
  async closeTab(sessionId: string): Promise<void> {
    if (this.sessionMutations.has(sessionId)) throw new Error("That session is being archived.");
    await this.sessions.close(sessionId);
    this.catalogueCache = undefined;
  }

  async runFeature(message: Extract<ClientMessage, { type: "runFeature" | "runExtensionAction" }>): Promise<void> {
    const sessionId = message.sessionId;
    if (this.sessionMutations.has(sessionId)) throw new Error("That session is being archived.");
    const path = this.sessions.has(sessionId) ? this.sessions.get(sessionId).snapshot().sessionPath : undefined;
    this.pendingWork.set(sessionId, (this.pendingWork.get(sessionId) ?? 0) + 1);
    try {
      await runFeatureAction(message, {
        sessions: this.sessions,
        restartService: this.restartService,
        extensions: this.extensions,
        notify: (id, text, level) => this.emit(id, { type: "notification", level, message: text }),
      });
      if (path && (message.type === "runExtensionAction" || message.featureId === "session.compact")) {
        await this.projectSessions.restoreIfArchived?.(path);
        this.catalogueCache = undefined;
      }
    } finally {
      const count = (this.pendingWork.get(sessionId) ?? 1) - 1;
      if (count) this.pendingWork.set(sessionId, count);
      else this.pendingWork.delete(sessionId);
    }
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
    if (event.type === "sessionSwitch") {
      this.sessions.rekey(event.previousSessionId || sessionId, event.sessionId);
      sessionId = event.sessionId;
      this.catalogueCache = undefined;
    }
    if (event.type === "messageFinal") {
      void this.extensions.emit("message.final", { sessionId, message: event.message as ChatMessage });
    }
    for (const listener of this.listeners) listener(sessionId, event);
  }
}
