import type { ThinkingLevel } from "../../shared/protocol.js";

/** Internal application action, not a wire envelope or compatibility parser. */
export type FeatureCommand = { sessionId: string; version?: number } & (
  | { type: "runExtensionAction"; actionId: string }
  | { type: "runFeature"; featureId: "model.select"; input: { model: string } }
  | { type: "runFeature"; featureId: "thinking.level"; input: { level: ThinkingLevel } }
  | { type: "runFeature"; featureId: "session.compact" | "app.restart"; input: Record<string, never> }
);
import type { PiChatExtensionRegistry } from "../extensions/extension-registry.js";
import type { RestartService } from "../bootstrap/restart-service.js";
import type { RuntimeAdapter } from "../runtime/contracts.js";

export interface FeatureSessionLookup {
  has(sessionId: string): boolean;
  get(sessionId: string): RuntimeAdapter;
}

export interface FeatureActionDependencies {
  sessions: FeatureSessionLookup;
  restartService?: RestartService;
  extensions: PiChatExtensionRegistry;
  notify(sessionId: string, text: string, level: "info" | "warning" | "error"): void;
}

export async function runFeatureAction(
  message: FeatureCommand,
  dependencies: FeatureActionDependencies,
): Promise<void> {
  if (message.type === "runExtensionAction") {
    const ui = dependencies.sessions.has(message.sessionId)
      ? dependencies.sessions.get(message.sessionId).uiContext()
      : undefined;
    await dependencies.extensions.runAction(message.actionId, {
      sessionId: message.sessionId,
      notify: (text, level = "info") => dependencies.notify(message.sessionId, text, level),
      ...(ui ? { ui } : {}),
    });
    return;
  }
  if (message.featureId === "app.restart") {
    if (!dependencies.restartService) throw new Error("This server cannot restart itself.");
    const failure = await dependencies.restartService.restart();
    if (failure) throw new Error(`Restart cancelled, the server is still running: ${failure}`);
    return;
  }

  const runtime = dependencies.sessions.get(message.sessionId);
  if (message.featureId === "model.select") {
    await runtime.setModel(message.input.model);
    return;
  }
  if (message.featureId === "session.compact") {
    await runtime.compact();
    return;
  }
  if (runtime.snapshot().isStreaming) throw new Error("Wait for the current run to finish before changing controls.");
  if (message.featureId === "thinking.level") await runtime.setThinkingLevel(message.input.level);
}
