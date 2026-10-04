import type { ThinkingLevel, UiPromptResult, SlashCommand } from "../../../shared/protocol.js";
import type { RuntimeEvent } from "../contracts.js";
import type { UiPromptRequest } from "../../extensions/ui/ui-prompt-registry.js";
import type { SessionStatsView } from "./session-stats.js";
import { sessionStatsMarkdown } from "./session-stats.js";

/** Built-ins this host implements, surfaced in the web command menu. */
export const NATIVE_COMMANDS: SlashCommand[] = [
  { name: "model", description: "Switch the model for this session", source: "native" },
  { name: "session", description: "Show session stats, token use, and context window", source: "native" },
  { name: "thinking", description: "Set the reasoning effort for this session", source: "native" },
  { name: "compact", description: "Summarise the conversation to free up context", source: "native" },
];

/** Pi terminal commands that this host recognizes but cannot provide in-browser. */
export const PI_BUILTIN_COMMANDS = new Set([
  "settings", "model", "tree", "thinking", "scoped-models", "export", "import", "share", "copy",
  "name", "session", "changelog", "hotkeys", "fork", "clone", "trust", "login", "logout", "new",
  "compact", "resume", "quit",
]);

export interface NativeCommandDependencies {
  hasExtensionCommand(name: string): boolean;
  compact(): Promise<void>;
  refreshModels(): Promise<void>;
  models: () => string[];
  ask(request: UiPromptRequest): Promise<UiPromptResult>;
  setModel(model: string): Promise<void>;
  setThinkingLevel(level: ThinkingLevel): void;
  sessionName?: string;
  currentModel: string;
  sessionStats(): SessionStatsView;
  thinkingLevels: ThinkingLevel[];
  emit(event: RuntimeEvent): void;
}

/** Dispatches host-native slash commands without owning adapter lifecycle state. */
export async function handleNativeCommand(message: string, dependencies: NativeCommandDependencies): Promise<boolean> {
  if (!message.startsWith("/")) return false;
  const name = message.slice(1).split(/\s+/)[0] ?? "";
  if (dependencies.hasExtensionCommand(name)) return false;

  if (name === "compact") {
    await dependencies.compact();
    return true;
  }
  if (name === "model") {
    await dependencies.refreshModels();
    const result = await dependencies.ask({ kind: "select", title: "Select a model", options: dependencies.models() });
    if (!result.cancelled) await dependencies.setModel(String(result.value));
    return true;
  }
  if (name === "session") {
    dependencies.emit({
      type: "notification",
      level: "info",
      message: sessionStatsMarkdown(dependencies.sessionStats(), dependencies.sessionName, dependencies.currentModel),
    });
    return true;
  }
  if (name === "thinking") {
    const result = await dependencies.ask({ kind: "select", title: "Select a thinking level", options: dependencies.thinkingLevels });
    if (!result.cancelled) dependencies.setThinkingLevel(String(result.value) as ThinkingLevel);
    return true;
  }
  if (PI_BUILTIN_COMMANDS.has(name)) {
    dependencies.emit({
      type: "notification",
      level: "warning",
      message: `/${name} is a Pi terminal command and is not available in Pi Chat.`,
    });
    return true;
  }
  return false;
}
