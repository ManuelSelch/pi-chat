import type { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import type { ChatMessage, FooterItem, SlashCommand, ThinkingLevel, UiPrompt, Widget } from "../../../shared/protocol.js";
import type { RuntimeSnapshot } from "../contracts.js";
import type { ExtensionStatus } from "../../extensions/ui/status-registry.js";

export interface SnapshotProjectionInput {
  session: AgentSessionRuntime["session"];
  cwd: string;
  messages: ChatMessage[];
  inFlightTools: ReadonlySet<string>;
  lastError?: string;
  models: string[];
  commands: SlashCommand[];
  prompts: UiPrompt[];
  widgets: Widget[];
  statuses: ExtensionStatus[];
}

function currentModel(session: AgentSessionRuntime["session"]): string {
  const model = session.model;
  return model ? `${model.provider}/${model.id}` : "";
}

export function projectFooter(session: AgentSessionRuntime["session"], statuses: ExtensionStatus[]): FooterItem[] {
  const model = currentModel(session);
  return [
    ...statuses.map((status) => ({
      key: `status.${status.key}`,
      text: status.text,
      align: "left" as const,
      variant: "badge" as const,
    })),
    ...(model ? [{ key: "model", text: model, align: "right" as const, variant: "plain" as const }] : []),
    ...(session.supportsThinking()
      ? [{
          key: "thinking",
          text: `thinking: ${session.thinkingLevel}`,
          align: "right" as const,
          variant: "plain" as const,
        }]
      : []),
  ];
}

export function projectSnapshot(input: SnapshotProjectionInput): RuntimeSnapshot {
  const messages = input.messages.map((entry) => {
    if (entry.role !== "tool" || entry.tool.status !== "running" || input.inFlightTools.has(entry.tool.toolCallId)) {
      return entry;
    }
    return {
      ...entry,
      tool: {
        ...entry.tool,
        status: "error" as const,
        ...(entry.tool.outputText === undefined ? { outputText: "Tool run was interrupted before its result was recorded." } : {}),
      },
    };
  });

  return {
    sessionId: input.session.sessionId,
    ...(input.session.sessionFile ? { sessionPath: input.session.sessionFile } : {}),
    ...(input.session.sessionName ? { sessionName: input.session.sessionName } : {}),
    projectPath: input.cwd,
    messages,
    isStreaming: !input.session.isIdle,
    steeringMessages: [...(input.session.getSteeringMessages?.() ?? [])],
    ...(input.lastError ? { lastError: input.lastError } : {}),
    actions: {
      features: [
        {
          id: "thinking.level",
          group: "model",
          kind: "select",
          title: "Thinking level",
          description: "Change the reasoning effort for the current session when the model supports it.",
          state: {
            value: input.session.thinkingLevel as ThinkingLevel,
            options: input.session.getAvailableThinkingLevels() as ThinkingLevel[],
          },
        },
        {
          id: "model.select",
          group: "model",
          kind: "select",
          title: "Model",
          description: "Switch the model for this session only.",
          state: { value: currentModel(input.session), options: input.models },
        },
        {
          id: "session.compact",
          group: "session",
          kind: "action",
          title: "Compact session",
          description: "Summarise the conversation so far to free up context.",
          state: { label: "Compact now" },
        },
      ],
      commands: input.commands,
    },
    prompts: input.prompts,
    widgets: input.widgets,
    footer: projectFooter(input.session, input.statuses),
  };
}
