import type { ClientState, ReadonlyDeep, ServerMessage, Tab, ProjectCatalogue, WebFeature } from "@manuelselch/pi-sdk";
import { initialChatState, projectChatState, type ChatState } from "./chat-state.js";

export type AppAction =
  | { type: "sdkState"; state: ReadonlyDeep<ClientState>; message?: ReadonlyDeep<ServerMessage> }
  | { type: "clearError"; sessionId?: string }
  | { type: "openPending" }
  | { type: "closePending"; sessionId: string }
  | { type: "commandFailed"; error: string; opening?: boolean; closingSessionId?: string };

export interface AppState {
  tabs: ReadonlyDeep<Tab[]>;
  activeSessionId: string;
  /** Views share SDK projections, adding only browser notices/error dismissal. */
  sessions: Record<string, ChatState>;
  sdkSessions: ReadonlyDeep<ClientState["sessions"]>;
  hiddenErrors: Record<string, string | undefined>;
  catalogue: ReadonlyDeep<ProjectCatalogue>;
  appFeatures: ReadonlyDeep<WebFeature[]>;
  openingTabs: number;
  closingSessionIds: string[];
  tabsKnown: boolean;
  connection: "connecting" | "open" | "superseded";
  error?: string;
}

export const initialAppState: AppState = {
  tabs: [], activeSessionId: "", sessions: {}, sdkSessions: {}, hiddenErrors: {},
  catalogue: { projects: [] }, appFeatures: [], openingTabs: 0, closingSessionIds: [],
  tabsKnown: false, connection: "connecting",
};

export function atHome(state: AppState): boolean {
  return state.tabsKnown && state.openingTabs === 0 && visibleTabs(state).length === 0;
}
export function visibleError(state: AppState, session: ChatState): string | undefined {
  return state.error ?? session.error;
}
export function visibleTabs(state: AppState): ReadonlyDeep<Tab>[] {
  return state.tabs.filter((tab) => !state.closingSessionIds.includes(tab.sessionId));
}
export function activeSession(state: AppState): ChatState {
  return (Object.hasOwn(state.sessions, state.activeSessionId) ? state.sessions[state.activeSessionId] : undefined)
    ?? Object.values(state.sessions)[0] ?? initialChatState;
}

/** Application presentation only; PiClient is the sole wire/projection owner. */
export function reduceAppMessage(state: AppState, action: AppAction): AppState {
  if (action.type === "openPending") return { ...state, openingTabs: state.openingTabs + 1 };
  if (action.type === "closePending") {
    return state.closingSessionIds.includes(action.sessionId) ? state : { ...state, closingSessionIds: [...state.closingSessionIds, action.sessionId] };
  }
  if (action.type === "commandFailed") return {
    ...state, error: action.error,
    openingTabs: action.opening ? Math.max(0, state.openingTabs - 1) : state.openingTabs,
    closingSessionIds: state.closingSessionIds.filter((id) => id !== action.closingSessionId),
  };
  if (action.type === "clearError") {
    const id = action.sessionId ?? state.activeSessionId;
    const session = Object.hasOwn(state.sessions, id) ? state.sessions[id] : undefined;
    if (state.error === undefined && session?.error === undefined) return state;
    return { ...state, error: undefined,
      hiddenErrors: { ...state.hiddenErrors, [id]: session?.error },
      sessions: session ? { ...state.sessions, [id]: { ...session, error: undefined } } : state.sessions };
  }

  const { state: sdk, message } = action;
  // Correlated replies belong exclusively to SDK trackers, never navigation/history.
  if (message && !("sequence" in message) && message.type !== "tabs" && message.type !== "catalogue" && message.type !== "protocolError") return state;
  const hiddenErrors = Object.fromEntries(Object.entries(state.hiddenErrors).filter(([id]) => Object.hasOwn(sdk.sessions, id)));
  const sessions = Object.fromEntries(Object.entries(sdk.sessions).map(([id, next]) => {
    const source = Object.hasOwn(state.sdkSessions, id) ? state.sdkSessions[id] : undefined;
    const previous = Object.hasOwn(state.sessions, id) ? state.sessions[id] : undefined;
    const event = message && "sessionId" in message && message.sessionId === id ? message : undefined;
    if (source === next && previous) return [id, previous];
    if (event?.type === "snapshot" || (event?.type === "runtimeStatus" && event.sequence > (source?.sequence ?? -1) && event.error !== undefined)) delete hiddenErrors[id];
    return [id, projectChatState(next, previous, event, hiddenErrors[id], source)];
  }));
  let next: AppState = { ...state, sessions, sdkSessions: sdk.sessions, hiddenErrors,
    tabs: sdk.inventory, activeSessionId: sdk.serverActiveSessionId, catalogue: sdk.catalogue, appFeatures: sdk.features };
  if (message?.type === "tabs") next = { ...next, tabsKnown: true, openingTabs: 0, closingSessionIds: [], connection: "open", error: undefined };
  else if (message?.type === "catalogue") next = { ...next, connection: "open", error: undefined };
  else if (message?.type === "protocolError") next = { ...next, error: message.error };
  else if (message && "sequence" in message) next = { ...next, connection: "open" };
  else if (!message) {
    const { phase, error } = sdk.connection;
    if (phase === "superseded") next = { ...next, connection: "superseded", error: undefined };
    else if (phase === "reconnecting") next = { ...next, connection: "connecting", error: "Waiting for the Pi Chat server…" };
    else if (phase === "failed") next = { ...next, connection: "connecting", error: `${error?.message ?? "Connection failed."} Reload to reconnect.` };
    else next = { ...next, connection: "connecting" };
  }
  return next;
}
