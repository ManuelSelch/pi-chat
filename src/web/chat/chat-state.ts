import type { ActionRegistry, ChatMessage, ProjectCatalogue, ServerMessage, UiPrompt } from "../../shared/protocol.js";

/**
 * Losing the socket is a state change the transcript must reflect, so it is an
 * action rather than something the hook patches in afterwards.
 */
/** Session-scoped server messages; app-level ones are handled by the app reducer. */
export type SessionServerMessage = Extract<ServerMessage, { sessionId: string }>;

export type ChatAction =
  | SessionServerMessage
  | { type: "connectionLost"; error?: string }
  | { type: "superseded" };

export interface ChatState {
  messages: ChatMessage[];
  draft?: { runId: string; text: string };
  status: "connecting" | "idle" | "running" | "aborting" | "superseded";
  error?: string;
  sessionId: string;
  projectPath: string;
  /** The session's file on disk. Absent until Pi has written it. */
  sessionPath?: string;
  catalogue: ProjectCatalogue;
  actions: ActionRegistry;
  /** Blocking `ctx.ui` questions; the newest is the one on screen. */
  prompts: UiPrompt[];
  sequence: number;
}

export const initialChatState: ChatState = {
  messages: [],
  status: "connecting",
  sessionId: "",
  projectPath: "",
  catalogue: { projects: [] },
  actions: { features: [], commands: [] },
  prompts: [],
  sequence: -1,
};

export function reduceServerMessage(state: ChatState, message: ChatAction): ChatState {
  if (message.type === "superseded") {
    // Another tab owns the runtime now. Stay quiet until the user asks for it
    // back, otherwise both tabs reconnect in a loop and neither can prompt.
    return { ...state, status: "superseded", draft: undefined, error: undefined };
  }
  if (message.type === "connectionLost") {
    // Keep the transcript on screen, but drop the partial stream: only the next
    // snapshot can say what the server actually recorded.
    return { ...state, status: "connecting", draft: undefined, error: message.error };
  }
  if (message.type === "snapshot") {
    // Notices are client-only and never persisted, so an authoritative snapshot
    // would otherwise erase the output of the command that triggered it.
    const notices = state.messages.filter((entry) => entry.role === "notice");
    return {
      messages: [...message.messages, ...notices],
      status: message.isStreaming ? "running" : "idle",
      sessionId: message.sessionId,
      projectPath: message.projectPath,
      sessionPath: message.sessionPath,
      catalogue: message.catalogue ?? state.catalogue,
      actions: message.actions ?? state.actions,
      prompts: message.prompts ?? [],
      sequence: message.throughSequence,
    };
  }
  if (message.sequence <= state.sequence) return state;
  if (message.type === "assistantDelta") {
    const previous = state.draft?.runId === message.runId ? state.draft.text : "";
    return { ...state, sequence: message.sequence, draft: { runId: message.runId, text: previous + message.delta } };
  }
  if (message.type === "toolEvent") {
    const card = message.tool;
    const id = `tool:${card.toolCallId}`;
    const index = state.messages.findIndex((entry) => entry.id === id);
    if (index === -1) {
      const entry: ChatMessage = { id, role: "tool", tool: card };
      return { ...state, sequence: message.sequence, messages: [...state.messages, entry] };
    }
    const existing = state.messages[index]!;
    if (existing.role !== "tool" || existing.tool.status !== "running") {
      // Once a card reached its final state it stays final: duplicate or
      // out-of-order events (e.g. replayed after a reconnect) must not
      // re-run the transition or regress it to running.
      return { ...state, sequence: message.sequence };
    }
    const updated: ChatMessage = {
      ...existing,
      tool: {
        ...existing.tool,
        name: card.name,
        status: card.status,
        ...(card.argsText !== undefined ? { argsText: card.argsText } : {}),
        ...(card.outputText !== undefined ? { outputText: card.outputText } : {}),
      },
    };
    const messages = [...state.messages];
    messages[index] = updated;
    return { ...state, sequence: message.sequence, messages };
  }
  if (message.type === "messageFinal") {
    const messages = state.messages.some((item) => item.id === message.message.id)
      ? state.messages
      : [...state.messages, message.message];
    return { ...state, sequence: message.sequence, messages, draft: message.message.role === "assistant" ? undefined : state.draft };
  }
  if (message.type === "notification") {
    // Extension output is transient: it belongs in the transcript next to the
    // command that produced it, but it is never persisted in the session.
    const entry: ChatMessage = {
      id: `notice:${message.sequence}`,
      role: "notice",
      level: message.level,
      text: message.message,
    };
    return { ...state, sequence: message.sequence, messages: [...state.messages, entry] };
  }
  if (message.type === "runtimeStatus") {
    return { ...state, sequence: message.sequence, status: message.status, error: message.error };
  }
  if (message.type === "prompts") {
    return { ...state, sequence: message.sequence, prompts: message.prompts };
  }
  return state;
}
