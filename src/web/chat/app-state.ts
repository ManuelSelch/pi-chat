import type { ProjectCatalogue, ServerMessage, Tab } from "../../shared/protocol.js";
import { initialChatState, reduceServerMessage, type ChatState } from "./chat-state.js";

export type AppAction =
  | ServerMessage
  | { type: "connectionLost"; error?: string }
  | { type: "superseded" };

export interface AppState {
  tabs: Tab[];
  activeSessionId: string;
  /** One projection per open session; background tabs keep streaming. */
  sessions: Record<string, ChatState>;
  /** The project list is global, so it is kept outside the per-session state. */
  catalogue: ProjectCatalogue;
  connection: "connecting" | "open" | "superseded";
  error?: string;
}

export const initialAppState: AppState = {
  tabs: [],
  activeSessionId: "",
  sessions: {},
  catalogue: { projects: [] },
  connection: "connecting",
};

export function activeSession(state: AppState): ChatState {
  // Snapshots arrive before the tab list, so fall back to the only known
  // session rather than briefly rendering an empty app.
  return state.sessions[state.activeSessionId] ?? Object.values(state.sessions)[0] ?? initialChatState;
}

export function reduceAppMessage(state: AppState, message: AppAction): AppState {
  if (message.type === "superseded" || message.type === "connectionLost") {
    // Connection loss is app-wide, but each transcript must also drop its
    // partial stream, because only the next snapshot is authoritative.
    const sessions = Object.fromEntries(
      Object.entries(state.sessions).map(([id, session]) => [id, reduceServerMessage(session, message)]),
    );
    return {
      ...state,
      sessions,
      connection: message.type === "superseded" ? "superseded" : "connecting",
      error: message.type === "connectionLost" ? message.error : undefined,
    };
  }

  if (message.type === "tabs") {
    // Drop projections for tabs the server closed, so state cannot leak.
    const sessions = Object.fromEntries(
      Object.entries(state.sessions).filter(([id]) => message.tabs.some((tab) => tab.sessionId === id)),
    );
    return { ...state, tabs: message.tabs, activeSessionId: message.activeSessionId, sessions, connection: "open" };
  }

  if (message.type === "protocolError") {
    return { ...state, error: message.error };
  }

  const current = state.sessions[message.sessionId] ?? initialChatState;
  const next = reduceServerMessage(current, message);
  return {
    ...state,
    connection: "open",
    sessions: { ...state.sessions, [message.sessionId]: next },
    catalogue: message.type === "snapshot" && message.catalogue ? message.catalogue : state.catalogue,
  };
}
