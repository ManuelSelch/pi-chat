import {
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  getAgentDir,
  SessionManager,
  type AgentSessionRuntime,
  type CreateAgentSessionRuntimeFactory,
} from "@earendil-works/pi-coding-agent";
import { resolveModelOverride } from "./models.js";

/**
 * Creates the SDK runtime while keeping service construction and model
 * override resolution outside the lifecycle-owning adapter.
 */
export async function createPiRuntime(cwd: string, sessionManager: SessionManager): Promise<AgentSessionRuntime> {
  const agentDir = getAgentDir();
  const createRuntime: CreateAgentSessionRuntimeFactory = async ({ cwd: targetCwd, sessionManager: manager, sessionStartEvent }) => {
    const services = await createAgentSessionServices({ cwd: targetCwd, agentDir });
    const override = resolveModelOverride(services);
    return {
      ...(await createAgentSessionFromServices({ services, sessionManager: manager, sessionStartEvent, ...override })),
      services,
      diagnostics: services.diagnostics,
    };
  };

  return createAgentSessionRuntime(createRuntime, { cwd, agentDir, sessionManager });
}
