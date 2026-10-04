import type { AgentSessionRuntime, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
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
