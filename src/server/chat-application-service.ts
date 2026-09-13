import type { RuntimeAdapter, RuntimeEvent, RuntimeSnapshot } from "./runtime-adapter.js";
import { ProjectSessionService, type ProjectCatalogue } from "./project-session-service.js";

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
  private readonly listeners = new Set<(event: RuntimeEvent) => void>();
  private unsubscribeRuntime?: () => void;
  private catalogueCache?: ProjectCatalogue;

  constructor(
    private runtime: RuntimeAdapter,
    private readonly factory: RuntimeAdapterFactory,
    private readonly projectSessions = new ProjectSessionService(),
  ) {
    this.bindRuntime();
  }

  async snapshot(): Promise<RuntimeSnapshot & { catalogue: ProjectCatalogue }> {
    const snapshot = this.runtime.snapshot();
    const catalogue = await this.catalogue(snapshot);
    return { ...snapshot, catalogue };
  }

  prompt(message: string): Promise<void> {
    return this.runtime.prompt(message);
  }

  abort(): Promise<void> {
    return this.runtime.abort();
  }

  async openProject(path: string): Promise<void> {
    await this.replaceRuntime(() => this.factory.continueProject(path));
  }

  async openSession(path: string): Promise<void> {
    await this.replaceRuntime(() => this.factory.openSession(path));
  }

  async newSession(path = this.runtime.snapshot().projectPath): Promise<void> {
    await this.replaceRuntime(() => this.factory.newSession(path));
  }

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    this.unsubscribeRuntime?.();
    this.listeners.clear();
    await this.runtime.dispose();
  }

  private async catalogue(snapshot: RuntimeSnapshot): Promise<ProjectCatalogue> {
    this.catalogueCache = await this.projectSessions.catalogue({
      id: snapshot.sessionId,
      path: snapshot.sessionPath,
      cwd: snapshot.projectPath,
      messageCount: snapshot.messages.filter((message) => message.role !== "tool").length,
      firstMessage: firstUserMessage(snapshot),
    });
    return this.catalogueCache;
  }

  private async replaceRuntime(create: () => Promise<RuntimeAdapter>): Promise<void> {
    if (this.runtime.snapshot().isStreaming) throw new Error("Wait for the current run to finish before switching sessions.");
    const next = await create();
    const previous = this.runtime;
    this.unsubscribeRuntime?.();
    this.runtime = next;
    this.bindRuntime();
    await previous.dispose();
    this.catalogueCache = undefined;
    this.emit({ type: "runtimeStatus", status: "idle" });
  }

  private bindRuntime(): void {
    this.unsubscribeRuntime = this.runtime.subscribe((event) => this.emit(event));
  }

  private emit(event: RuntimeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
