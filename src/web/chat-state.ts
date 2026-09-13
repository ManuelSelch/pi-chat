import type { ChatMessage, ServerMessage } from "../shared/protocol.js";

/**
 * Losing the socket is a state change the transcript must reflect, so it is an
 * action rather than something the hook patches in afterwards.
 */
export type ChatAction = ServerMessage | { type: "connectionLost"; error?: string };

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

export function reduceServerMessage(state: ChatState, message: ChatAction): ChatState {
  if (message.type === "connectionLost") {
    // Keep the transcript on screen, but drop the partial stream: only the next
    // snapshot can say what the server actually recorded.
    return { ...state, status: "connecting", draft: undefined, error: message.error };
  }
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
