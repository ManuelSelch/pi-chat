import type { AgentSessionRuntime, ExtensionCommandContextActions, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { createWebUiContext, type WebUiContextHandlers } from "./web-ui-context.js";

/** Binds the browser UI surface to one hosted SDK session. */
export function bindWebUiContext(
  runtime: AgentSessionRuntime,
  handlers: WebUiContextHandlers,
): ExtensionUIContext {
  const context = createWebUiContext(handlers);
  runtime.session.extensionRunner.setUIContext(context, "rpc");
  return context;
}

/**
 * Gives extension commands the hosted session operations instead of the SDK's
 * terminal no-op defaults.
 */
export function bindExtensionCommandContext(runtime: AgentSessionRuntime, reload: () => Promise<void>): void {
  const runner = runtime.session.extensionRunner as typeof runtime.session.extensionRunner & {
    bindCommandContext?: (context: {
      waitForIdle: () => Promise<void>;
      newSession: AgentSessionRuntime["newSession"];
      fork: AgentSessionRuntime["fork"];
      navigateTree: AgentSessionRuntime["session"]["navigateTree"];
      switchSession: AgentSessionRuntime["switchSession"];
      reload: () => Promise<void>;
    }) => void;
  };
  runner.bindCommandContext?.(extensionCommandContextActions(runtime, reload));
}

export function extensionCommandContextActions(runtime: AgentSessionRuntime, reload: () => Promise<void>): ExtensionCommandContextActions {
  return {
    waitForIdle: () => runtime.session.agent.waitForIdle(),
    newSession: (options) => runtime.newSession(options),
    fork: (entryId, options) => runtime.fork(entryId, options),
    navigateTree: (targetId, options) => runtime.session.navigateTree(targetId, options),
    switchSession: (sessionPath, options) => runtime.switchSession(sessionPath, options),
    reload,
  };
}
