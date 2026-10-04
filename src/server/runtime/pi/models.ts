import {
  resolveCliModel,
  resolveModelScopeWithDiagnostics,
  type AgentSessionRuntime,
  type AgentSessionServices,
  createAgentSessionFromServices,
} from "@earendil-works/pi-coding-agent";

/** Derived from the SDK so no direct `@earendil-works/pi-ai` dependency is needed. */
export type ModelOverride = Partial<
  Pick<Parameters<typeof createAgentSessionFromServices>[0], "model" | "thinkingLevel">
>;

const modelReference = (model: { provider: string; id: string }): string => `${model.provider}/${model.id}`;

/**
 * The models this host offers, narrowed by Pi's own `enabledModels` setting.
 * Patterns are globs (`anthropic/*`, `*sonnet*`) as well as exact references.
 */
export async function offeredModels(session: AgentSessionRuntime["session"]): Promise<string[]> {
  const available = (await session.modelRuntime.getAvailable()).map(modelReference).sort();
  const patterns = session.settingsManager.getEnabledModels();
  if (!patterns?.length) return available;

  const { scopedModels, diagnostics } = await resolveModelScopeWithDiagnostics(patterns, session.modelRuntime);
  for (const diagnostic of diagnostics) console.warn(`enabledModels: ${diagnostic.message}`);
  if (scopedModels.length === 0) {
    console.warn("enabledModels matched no available model, so every model is offered instead.");
    return available;
  }
  return scopedModels.map((scoped) => modelReference(scoped.model)).sort();
}

/** Resolve the server-only model override after extension-provided providers load. */
export function resolveModelOverride(services: AgentSessionServices): ModelOverride {
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
