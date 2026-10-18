import type { ActionRegistry, ProjectCatalogue } from "./contract/models.js";
import type { Event, SessionSnapshot, SessionSettings } from "./contract/v2.js";

export type SessionServerMessage = Extract<Event, { sessionId: string }>;
export type SessionAction = SessionServerMessage | { type: "connectionLost"; error?: string } | { type: "superseded" };
type Presentation = NonNullable<SessionSnapshot["presentation"]>;
export interface SessionState {
  messages: SessionSnapshot["messages"];
  steeringMessages: string[];
  draft?: { runId: string; text: string; thinking: string };
  status: "connecting" | "idle" | "running" | "aborting" | "closing" | "superseded";
  error?: string;
  sessionId: string;
  sessionName?: string;
  projectPath: string;
  sessionPath?: string;
  settings: SessionSettings;
  /** Convenience action data, derived from structured settings, never wire feature commands. */
  actions: ActionRegistry;
  catalogue: ProjectCatalogue;
  prompts: SessionSnapshot["prompts"];
  widgets: Presentation["widgets"];
  footer: Presentation["footer"];
  extensions: Presentation["extensions"];
  presentationRevision: number;
  sequence: number;
  lastOperation?: Extract<Event, { event: "operation.finished" }>["data"];
}
export const initialSessionState: SessionState = {
  messages: [], steeringMessages: [], status: "connecting", sessionId: "", projectPath: "", catalogue: { projects: [] },
  settings: { model: "", availableModels: [], thinkingLevel: "off", availableThinkingLevels: [] },
  actions: { features: [], commands: [] }, prompts: [], widgets: [], footer: [], extensions: { buttons: [], badges: [], state: {} }, presentationRevision: -1, sequence: -1,
};
function actions(settings: SessionSettings, commands: ActionRegistry["commands"]): ActionRegistry {
  return { commands, features: [
    { id: "model.select", group: "model", kind: "select", title: "Model", state: { value: settings.model, options: settings.availableModels } },
    { id: "thinking.level", group: "model", kind: "select", title: "Thinking", state: { value: settings.thinkingLevel, options: settings.availableThinkingLevels } },
    { id: "session.compact", group: "session", kind: "action", title: "Compact", state: { label: "Compact session" } },
  ] };
}
export function applySnapshot(state: SessionState, snapshot: SessionSnapshot): SessionState {
  if (snapshot.sessionId === state.sessionId && snapshot.throughSequence < state.sequence) return state;
  const presentation = snapshot.presentation;
  return { ...state, sessionId: snapshot.sessionId, sequence: snapshot.throughSequence, messages: snapshot.messages,
    sessionName: snapshot.sessionName, sessionPath: snapshot.sessionPath, projectPath: snapshot.projectPath,
    status: snapshot.runtime.status, error: snapshot.runtime.lastError,
    // Same-process snapshots may refresh text while an observed run continues;
    // reconnect initialization starts from initialSessionState and has no draft.
    draft: snapshot.runtime.status === "running" && snapshot.runtime.runId && state.draft?.runId === snapshot.runtime.runId ? state.draft : undefined,
    steeringMessages: snapshot.steeringMessages, settings: snapshot.settings, actions: actions(snapshot.settings, snapshot.commands), prompts: snapshot.prompts,
    ...(presentation && presentation.revision >= state.presentationRevision ? { widgets: presentation.widgets, footer: presentation.footer, extensions: presentation.extensions, presentationRevision: presentation.revision } : {}),
  };
}
/** Pure v2 projection; sequence gaps/recovery and process identity are owned by PiClient. */
export function reduceSessionMessage(state: SessionState, message: SessionAction): SessionState {
  if (message.type === "superseded") return { ...state, status: "superseded", draft: undefined, error: undefined };
  if (message.type === "connectionLost") return { ...state, status: "connecting", draft: undefined, error: message.error };
  if (message.event === "session.snapshot") return applySnapshot(state, message.data);
  if (message.event === "presentation.changed") {
    if (message.data.revision <= state.presentationRevision) return state;
    return { ...state, widgets: message.data.widgets, footer: message.data.footer, extensions: message.data.extensions, presentationRevision: message.data.revision };
  }
  if (message.sequence <= state.sequence) return state;
  const next = { ...state, sequence: message.sequence };
  switch (message.event) {
    case "message.delta": case "message.thinking.delta": {
      const previous = state.draft?.runId === message.data.runId ? state.draft : { runId: message.data.runId, text: "", thinking: "" };
      return { ...next, draft: message.event === "message.delta" ? { ...previous, text: previous.text + message.data.delta } : { ...previous, thinking: previous.thinking + message.data.delta } };
    }
    case "tool.updated": {
      const card = message.data.tool; const id = `tool:${card.toolCallId}`; const index = state.messages.findIndex(entry => entry.id === id);
      if (index < 0) return { ...next, messages: [...state.messages, { id, role: "tool", tool: card }] };
      const existing = state.messages[index]!;
      if (existing.role !== "tool" || existing.tool.status !== "running") return next;
      const messages = [...state.messages]; messages[index] = { ...existing, tool: { ...existing.tool, ...card } }; return { ...next, messages };
    }
    case "message.finalized": return { ...next, messages: state.messages.some(entry => entry.id === message.data.message.id) ? state.messages : [...state.messages, message.data.message], draft: message.data.message.role === "assistant" && state.draft?.runId === message.data.runId ? undefined : state.draft };
    case "runtime.status": return { ...next, status: message.data.status, error: message.data.lastError ?? (message.data.status === "running" ? undefined : state.error) };
    case "prompt.list.changed": return { ...next, prompts: message.data.prompts };
    case "steering.queue.changed": return { ...next, steeringMessages: message.data.messages };
    case "settings.changed": return { ...next, settings: message.data, actions: actions(message.data, state.actions.commands) };
    case "operation.finished": return { ...next, lastOperation: message.data };
    default: return next;
  }
}
