import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  resolveCliModel,
  SessionManager,
  type AgentSessionRuntime,
  type AgentSessionServices,
  type CreateAgentSessionRuntimeFactory,
} from "@earendil-works/pi-coding-agent";
import type { ChatMessage } from "../shared/protocol.js";

/** Derived from the SDK so no direct `@earendil-works/pi-ai` dependency is needed. */
type ModelOverride = Partial<
  Pick<Parameters<typeof createAgentSessionFromServices>[0], "model" | "thinkingLevel">
>;
import type { RuntimeAdapter, RuntimeEvent, RuntimeSnapshot } from "./runtime-adapter.js";

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const value = part as Record<string, unknown>;
      if (value.type === "text" && typeof value.text === "string") return value.text;
      return "";
    })
    .join("");
}

/**
 * Stable per-message identity.
 *
 * Ids must match whether a message is first seen as a live `message_end` event
 * or later read back from `session.messages` for a snapshot, otherwise a reload
 * would duplicate messages the client already holds. Pi hands out the same
 * object in both paths, so identity is keyed on the object itself rather than
 * on its position, timestamp, or text.
 */
export class MessageIdentity {
  private readonly ids = new WeakMap<object, string>();
  private next = 0;

  idFor(message: object): string {
    const existing = this.ids.get(message);
    if (existing) return existing;
    const id = `msg-${++this.next}`;
    this.ids.set(message, id);
    return id;
  }
}

export function toChatMessage(message: unknown, identity: MessageIdentity): ChatMessage | undefined {
  if (!message || typeof message !== "object") return undefined;
  const value = message as Record<string, unknown>;
  if (value.role !== "user" && value.role !== "assistant" && value.role !== "system") return undefined;
  const timestamp = typeof value.timestamp === "number" ? value.timestamp : undefined;
  return {
    id: identity.idFor(message),
    role: value.role,
    text: textFromContent(value.content),
    ...(timestamp === undefined ? {} : { timestamp }),
  };
}

export class PiRuntimeAdapter implements RuntimeAdapter {
  private readonly listeners = new Set<(event: RuntimeEvent) => void>();
  private readonly identity = new MessageIdentity();
  private unsubscribe?: () => void;
  private currentRunId = "";
  /**
   * A failed turn ends as an ordinary `message_end` with `stopReason: "error"`,
   * so without this the UI shows an empty assistant bubble and no reason. Held
   * until the run settles, because `agent_settled` publishes the final status.
   */
  private lastError?: string;

  private constructor(private readonly runtime: AgentSessionRuntime) {
    this.bindSession();
  }

  /**
   * `PI_CHAT_MODEL` overrides the model for this server only, so testing a
   * specific provider never edits the user's global Pi settings. Accepts the
   * same spelling as the CLI, e.g. `doppelclaude/claude-opus-5`, optionally
   * suffixed with a thinking level (`:high`).
   *
   * It must resolve against the services' runtime, not a bare `ModelRuntime`:
   * providers contributed by extensions (doppelclaude among them) only exist
   * once the resource loader has run.
   */
  private static resolveOverride(services: AgentSessionServices): ModelOverride {
    const requested = process.env.PI_CHAT_MODEL?.trim();
    if (!requested) return {};

    const resolved = resolveCliModel({ cliModel: requested, modelRuntime: services.modelRuntime });
    if (resolved.error) throw new Error(`PI_CHAT_MODEL=${requested}: ${resolved.error}`);
    if (resolved.warning) console.warn(`PI_CHAT_MODEL: ${resolved.warning}`);
    if (!resolved.model) throw new Error(`PI_CHAT_MODEL=${requested}: no matching model`);

    console.log(`Model: ${resolved.model.provider}/${resolved.model.id}`);
    return {
      model: resolved.model,
      ...(resolved.thinkingLevel ? { thinkingLevel: resolved.thinkingLevel } : {}),
    };
  }

  static async create(cwd: string): Promise<PiRuntimeAdapter> {
    const agentDir = getAgentDir();
    const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd: targetCwd, sessionManager, sessionStartEvent }) => {
      const services = await createAgentSessionServices({ cwd: targetCwd, agentDir });
      const override = PiRuntimeAdapter.resolveOverride(services);
      return {
        ...(await createAgentSessionFromServices({ services, sessionManager, sessionStartEvent, ...override })),
        services,
        diagnostics: services.diagnostics,
      };
    };

    const runtime = await createAgentSessionRuntime(createRuntime, {
      cwd,
      agentDir,
      sessionManager: SessionManager.continueRecent(cwd),
    });
    return new PiRuntimeAdapter(runtime);
  }

  snapshot(): RuntimeSnapshot {
    const messages = this.runtime.session.messages
      .map((message) => toChatMessage(message, this.identity))
      .filter((message): message is ChatMessage => message !== undefined);
    return {
      sessionId: this.runtime.session.sessionId,
      projectPath: this.runtime.cwd,
      messages,
      isStreaming: this.runtime.session.isStreaming,
    };
  }

  async prompt(message: string): Promise<void> {
    this.lastError = undefined;
    await this.runtime.session.prompt(message);
  }

  async abort(): Promise<void> {
    this.emit({ type: "runtimeStatus", status: "aborting" });
    await this.runtime.session.abort();
  }

  subscribe(listener: (event: RuntimeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async dispose(): Promise<void> {
    this.unsubscribe?.();
    this.listeners.clear();
    await this.runtime.dispose();
  }

  private bindSession(): void {
    this.unsubscribe?.();
    this.unsubscribe = this.runtime.session.subscribe((event) => {
      if (event.type === "agent_start") {
        this.currentRunId = crypto.randomUUID();
        this.emit({ type: "runtimeStatus", status: "running" });
        return;
      }
      if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
        this.emit({ type: "assistantDelta", runId: this.currentRunId, delta: event.assistantMessageEvent.delta });
        return;
      }
      if (event.type === "message_end") {
        const failure = event.message as { stopReason?: string; errorMessage?: string };
        if (failure.stopReason === "error") {
          this.lastError = failure.errorMessage?.trim() || "The model ended the turn with an error.";
        }
        const final = toChatMessage(event.message, this.identity);
        if (final && (final.role === "user" || final.role === "assistant")) {
          this.emit({ type: "messageFinal", runId: this.currentRunId, message: final });
        }
        return;
      }
      if (event.type === "agent_settled") {
        const error = this.lastError;
        this.lastError = undefined;
        this.emit({ type: "runtimeStatus", status: "idle", ...(error ? { error } : {}) });
      }
    });
  }

  private emit(event: RuntimeEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
