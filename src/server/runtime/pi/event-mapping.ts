import type { AgentSessionRuntime } from "@earendil-works/pi-coding-agent";
import type { RuntimeEvent } from "../contracts.js";
import { projectEditDiff } from "../../../shared/edit-diff.js";
import { customMessageFromEntry, MessageIdentity, textFromContent, toChatMessage } from "./message-mapping.js";
import { clampToolOutput, toolCardFromCall } from "./tool-mapping.js";

export type SessionEvent = Parameters<AgentSessionRuntime["session"]["subscribe"]>[0] extends (event: infer Event) => unknown
  ? Event
  : never;

export interface EventProjectionState {
  currentRunId: string;
  lastError?: string;
}

export interface EventMappingDependencies {
  session: AgentSessionRuntime["session"];
  identity: MessageIdentity;
  state: EventProjectionState;
  inFlightTools: Set<string>;
  emit: (event: RuntimeEvent) => void;
  clearAbortWatchdog: () => void;
}

/** Translate SDK events while keeping mutable projection state explicit. */
export function createSessionEventHandler(dependencies: EventMappingDependencies): (event: SessionEvent) => void {
  return (event) => {
    if (event.type === "queue_update") {
      dependencies.emit({ type: "steeringQueue", messages: [...event.steering] });
      return;
    }
    if (event.type === "session_info_changed") {
      dependencies.emit({ type: "sessionMetadataChanged" });
      return;
    }
    if (event.type === "agent_start") {
      dependencies.state.currentRunId = crypto.randomUUID();
      dependencies.emit({ type: "runtimeStatus", status: "running" });
      return;
    }
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      dependencies.emit({ type: "assistantDelta", runId: dependencies.state.currentRunId, delta: event.assistantMessageEvent.delta });
      return;
    }
    if (event.type === "message_update" && event.assistantMessageEvent.type === "thinking_delta") {
      dependencies.emit({ type: "thinkingDelta", runId: dependencies.state.currentRunId, delta: event.assistantMessageEvent.delta });
      return;
    }
    if (event.type === "message_end") {
      const failure = event.message as { stopReason?: string; errorMessage?: string };
      if (failure.stopReason === "error") {
        dependencies.state.lastError = failure.errorMessage?.trim() || "The model ended the turn with an error.";
      }
      const final = toChatMessage(event.message, dependencies.identity);
      if (final && (final.role === "user" || final.role === "assistant" || final.role === "custom")) {
        dependencies.emit({ type: "messageFinal", runId: dependencies.state.currentRunId, message: final });
      }
      return;
    }
    if (event.type === "entry_appended") {
      const message = customMessageFromEntry(event.entry);
      if (message) dependencies.emit({ type: "messageFinal", runId: dependencies.state.currentRunId, message });
      return;
    }
    if (event.type === "tool_execution_start") {
      dependencies.inFlightTools.add(event.toolCallId);
      dependencies.emit({
        type: "toolEvent",
        runId: dependencies.state.currentRunId,
        tool: toolCardFromCall({ id: event.toolCallId, name: event.toolName, arguments: event.args }),
      });
      return;
    }
    if (event.type === "tool_execution_update") {
      const output = textFromContent((event.partialResult as { content?: unknown })?.content).trim();
      dependencies.emit({
        type: "toolEvent",
        runId: dependencies.state.currentRunId,
        tool: {
          toolCallId: event.toolCallId,
          name: event.toolName,
          status: "running",
          ...(output ? { outputText: clampToolOutput(output) } : {}),
        },
      });
      return;
    }
    if (event.type === "tool_execution_end") {
      dependencies.inFlightTools.delete(event.toolCallId);
      const output = textFromContent((event.result as { content?: unknown })?.content).trim();
      dependencies.emit({
        type: "toolEvent",
        runId: dependencies.state.currentRunId,
        tool: {
          toolCallId: event.toolCallId,
          name: event.toolName,
          status: event.isError ? "error" : "success",
          editDiff: projectEditDiff(event.toolName, event.isError, (event.result as { details?: unknown })?.details),
          ...(output ? { outputText: clampToolOutput(output) } : {}),
        },
      });
      return;
    }
    if (event.type === "compaction_start") {
      dependencies.emit({ type: "runtimeStatus", status: "running" });
      if (event.reason !== "manual") {
        dependencies.emit({
          type: "notification",
          level: "info",
          message: event.reason === "overflow" ? "Context limit reached, compacting the session…" : "Context is nearly full, compacting the session…",
        });
      }
      return;
    }
    if (event.type === "compaction_end") {
      if (event.errorMessage) {
        dependencies.emit({ type: "notification", level: "error", message: `Compaction failed: ${event.errorMessage}` });
      } else if (event.aborted) {
        dependencies.emit({ type: "notification", level: "warning", message: "Compaction was cancelled." });
      }
      if (!event.willRetry && !dependencies.session.isStreaming) {
        dependencies.emit({ type: "runtimeStatus", status: "idle" });
      }
      return;
    }
    if (event.type === "agent_settled") {
      dependencies.clearAbortWatchdog();
      dependencies.emit({ type: "runtimeStatus", status: "idle", ...(dependencies.state.lastError ? { error: dependencies.state.lastError } : {}) });
    }
  };
}
