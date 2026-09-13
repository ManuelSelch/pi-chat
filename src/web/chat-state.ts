import type { ChatMessage, ServerMessage } from "../shared/protocol.js";

export interface ChatState {
  messages: ChatMessage[];
  draft?: { runId: string; text: string };
  status: "connecting" | "idle" | "running" | "aborting";
  error?: string;
  sessionId: string;
  projectPath: string;
  sequence: number;
}

export const initialChatState: ChatState = {
  messages: [],
  status: "connecting",
  sessionId: "",
  projectPath: "",
  sequence: -1,
};

export function reduceServerMessage(state: ChatState, message: ServerMessage): ChatState {
  if (message.type === "snapshot") {
    return {
      messages: message.messages,
      status: message.isStreaming ? "running" : "idle",
      sessionId: message.sessionId,
      projectPath: message.projectPath,
      sequence: message.throughSequence,
    };
  }
  if (message.sequence <= state.sequence) return state;
  if (message.type === "assistantDelta") {
    const previous = state.draft?.runId === message.runId ? state.draft.text : "";
    return { ...state, sequence: message.sequence, draft: { runId: message.runId, text: previous + message.delta } };
  }
  if (message.type === "messageFinal") {
    const messages = state.messages.some((item) => item.id === message.message.id)
      ? state.messages
      : [...state.messages, message.message];
    return { ...state, sequence: message.sequence, messages, draft: message.message.role === "assistant" ? undefined : state.draft };
  }
  if (message.type === "runtimeStatus") {
    return { ...state, sequence: message.sequence, status: message.status, error: message.error };
  }
  return { ...state, sequence: message.sequence, error: message.error };
}
