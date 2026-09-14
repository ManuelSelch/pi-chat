import type { ProjectCatalogue, ServerMessage, Tab, WebFeature } from "../../shared/protocol.js";
import { initialChatState, reduceServerMessage, type ChatState } from "./chat-state.js";

export type AppAction =
  | ServerMessage
  | { type: "connectionLost"; error?: string }
  | { type: "superseded" }
  | { type: "clearError" }
  | { type: "openPending" }
  | { type: "closePending"; sessionId: string };

export interface AppState {
  tabs: Tab[];
  activeSessionId: string;
  /** One projection per open session; background tabs keep streaming. */
  sessions: Record<string, ChatState>;
  /** The project list is global, so it is kept outside the per-session state. */
  catalogue: ProjectCatalogue;
  /** Server capabilities that outlive any session, such as restarting. */
  appFeatures: WebFeature[];
  /**
   * Opening a session takes a server round trip. The tab bar shows a placeholder
   * straight away so the click feels instant, and a closing tab disappears
   * immediately instead of waiting for confirmation.
   */
  openingTabs: number;
  closingSessionIds: string[];
  /** Until the first tab list arrives, "no tabs" means "not loaded yet". */
  tabsKnown: boolean;
  connection: "connecting" | "open" | "superseded";
  error?: string;
}

export const initialAppState: AppState = {
  tabs: [],
  activeSessionId: "",
  sessions: {},
  catalogue: { projects: [] },
  appFeatures: [],
  openingTabs: 0,
  closingSessionIds: [],
  tabsKnown: false,
  connection: "connecting",
};

/** With every tab closed the app shows the home screen instead of a transcript. */
export function atHome(state: AppState): boolean {
  return state.tabsKnown && state.openingTabs === 0 && visibleTabs(state).length === 0;
}

/**
 * A protocol-level rejection belongs to no session, so it has to win over the
 * session error; otherwise a refused command looks like nothing happened.
 */
export function visibleError(state: AppState, session: ChatState): string | undefined {
  return state.error ?? session.error;
}

/** Tabs as the user should see them right now, including optimistic changes. */
export function visibleTabs(state: AppState): Tab[] {
  return state.tabs.filter((tab) => !state.closingSessionIds.includes(tab.sessionId));
}

export function activeSession(state: AppState): ChatState {
  // Snapshots arrive before the tab list, so fall back to the only known
  // session rather than briefly rendering an empty app.
  return state.sessions[state.activeSessionId] ?? Object.values(state.sessions)[0] ?? initialChatState;
}

export function reduceAppMessage(state: AppState, message: AppAction): AppState {
  if (message.type === "openPending") {
    return { ...state, openingTabs: state.openingTabs + 1 };
  }
  if (message.type === "closePending") {
    return state.closingSessionIds.includes(message.sessionId)
      ? state
      : { ...state, closingSessionIds: [...state.closingSessionIds, message.sessionId] };
  }
  if (message.type === "clearError") {
    return state.error === undefined ? state : { ...state, error: undefined };
  }

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
    return {
      ...state,
      tabs: message.tabs,
      activeSessionId: message.activeSessionId,
      sessions,
      openingTabs: 0,
      closingSessionIds: [],
      tabsKnown: true,
      connection: "open",
      // A reconnect answers the outage the error described. Leaving it set keeps
      // "Waiting for the Pi Chat server…" on screen over a working connection,
      // which is exactly what a restart looks like from the browser.
      error: undefined,
    };
  }

  if (message.type === "catalogue") {
    return {
      ...state,
      catalogue: message.catalogue,
      appFeatures: message.features ?? state.appFeatures,
      connection: "open",
      error: undefined,
    };
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
