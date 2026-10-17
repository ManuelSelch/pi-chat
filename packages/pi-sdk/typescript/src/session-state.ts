import type { ActionRegistry, ChatMessage, FooterItem, PiChatExtensions, ProjectCatalogue, ServerMessage, UiPrompt, Widget } from "./contract/index.js";

export type SessionServerMessage = Extract<ServerMessage, { sessionId: string; sequence: number }>;
export type SessionAction = SessionServerMessage | { type: "connectionLost"; error?: string } | { type: "superseded" };

/** A v1 projection, not UI navigation. Notifications are delivered as events. */
export interface SessionState {
  messages: ChatMessage[];
  steeringMessages: string[];
  draft?: { runId: string; text: string; thinking: string };
  status: "connecting" | "idle" | "running" | "aborting" | "superseded";
  error?: string;
  sessionId: string;
  sessionName?: string;
  projectPath: string;
  sessionPath?: string;
  catalogue: ProjectCatalogue;
  actions: ActionRegistry;
  prompts: UiPrompt[];
  widgets: Widget[];
  footer: FooterItem[];
  extensions: PiChatExtensions;
  sequence: number;
}

export const initialSessionState: SessionState = {
  messages: [], steeringMessages: [], status: "connecting", sessionId: "", projectPath: "",
  catalogue: { projects: [] }, actions: { features: [], commands: [] }, prompts: [],
  widgets: [], footer: [], extensions: { buttons: [], badges: [], state: {} }, sequence: -1,
};

/** Pure copy-on-write reducer. Caller routes by sessionId. Preserves v1 semantics. */
export function reduceSessionMessage(state: SessionState, message: SessionAction): SessionState {
  if (message.type === "superseded") return { ...state, status: "superseded", draft: undefined, error: undefined };
  if (message.type === "connectionLost") return { ...state, status: "connecting", draft: undefined, error: message.error };
  if (message.type === "snapshot") {
    return {
      messages: message.messages,
      steeringMessages: message.steeringMessages ?? [],
      draft: message.isStreaming && message.sessionId === state.sessionId ? state.draft : undefined,
      status: message.isStreaming ? "running" : "idle",
      sessionId: message.sessionId, sessionName: message.sessionName,
      projectPath: message.projectPath, sessionPath: message.sessionPath,
      catalogue: message.catalogue ?? state.catalogue, actions: message.actions ?? state.actions,
      prompts: message.prompts ?? [], widgets: message.widgets ?? [], footer: message.footer ?? [],
      extensions: message.extensions ?? { buttons: [], badges: [], state: {} },
      sequence: message.throughSequence, error: message.lastError,
    };
  }
  if (message.sequence <= state.sequence) return state;
  if (message.type === "assistantDelta" || message.type === "thinkingDelta") {
    const previous = state.draft?.runId === message.runId ? state.draft : { runId: message.runId, text: "", thinking: "" };
    const draft = message.type === "assistantDelta"
      ? { ...previous, text: previous.text + message.delta }
      : { ...previous, thinking: previous.thinking + message.delta };
    return { ...state, sequence: message.sequence, draft };
  }
  if (message.type === "toolEvent") {
    const card = message.tool;
    const id = `tool:${card.toolCallId}`;
    const index = state.messages.findIndex((entry) => entry.id === id);
    if (index === -1) return { ...state, sequence: message.sequence, messages: [...state.messages, { id, role: "tool", tool: card }] };
    const existing = state.messages[index]!;
    if (existing.role !== "tool" || existing.tool.status !== "running") return { ...state, sequence: message.sequence };
    const updated: ChatMessage = { ...existing, tool: {
      ...existing.tool, name: card.name, status: card.status,
      ...(card.argsText !== undefined ? { argsText: card.argsText } : {}),
      ...(card.outputText !== undefined ? { outputText: card.outputText } : {}),
      ...(card.editDiff !== undefined ? { editDiff: card.editDiff } : {}),
      ...(card.writeContent !== undefined ? { writeContent: card.writeContent } : {}),
    } };
    const messages = [...state.messages];
    messages[index] = updated;
    return { ...state, sequence: message.sequence, messages };
  }
  if (message.type === "messageFinal") {
    const messages = state.messages.some((entry) => entry.id === message.message.id) ? state.messages : [...state.messages, message.message];
    return { ...state, sequence: message.sequence, messages, draft: message.message.role === "assistant" ? undefined : state.draft };
  }
  // Notification display/anchoring is application-owned, but it still consumes
  // a v1 core sequence number. Never create a client-only notice in SDK history.
  if (message.type === "notification") return { ...state, sequence: message.sequence };
  if (message.type === "runtimeStatus") {
    const error = message.error ?? (message.status === "running" ? undefined : state.error);
    return { ...state, sequence: message.sequence, status: message.status, error };
  }
  if (message.type === "prompts") return { ...state, sequence: message.sequence, prompts: message.prompts };
  if (message.type === "steeringQueue") return { ...state, sequence: message.sequence, steeringMessages: message.messages };
  if (message.type === "widgets") return { ...state, sequence: message.sequence, widgets: message.widgets };
  if (message.type === "footer") return { ...state, sequence: message.sequence, footer: message.footer };
  return state;
}
