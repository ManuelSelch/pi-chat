import type { ClientState, ReadonlyDeep, ServerMessage, ProjectCatalogue, WebFeature } from "@manuelselch/pi-sdk";
import type { AppTab } from "./view-types.js";
import { initialChatState, projectChatState, type ChatState } from "./chat-state.js";

export type AppAction =
  | { type: "sdkState"; state: ReadonlyDeep<ClientState>; message?: ReadonlyDeep<ServerMessage> }
  | { type: "clearError"; sessionId?: string }
  | { type: "focusSession"; sessionId: string }
  | { type: "closeView" }
  | { type: "sessionOpened"; sessionId: string }
  | { type: "openPending" }
  | { type: "closePending"; sessionId: string }
  | { type: "commandFailed"; error: string; opening?: boolean; closingSessionId?: string };

export interface AppState {
  serverInstanceId?: string;
  tabs: ReadonlyDeep<AppTab[]>;
  activeSessionId: string;
  viewClosed?: boolean;
  /** Views share SDK projections, adding only browser notices/error dismissal. */
  sessions: Record<string, ChatState>;
  sdkSessions: ReadonlyDeep<ClientState["sessions"]>;
  sdkInventory: ReadonlyDeep<ClientState["inventory"]>;
  themes: ReadonlyDeep<ClientState["themes"]>;
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
  tabs: [], activeSessionId: "", sessions: {}, sdkSessions: {}, sdkInventory: [], themes: {}, hiddenErrors: {},
  catalogue: { projects: [] }, appFeatures: [], openingTabs: 0, closingSessionIds: [],
  tabsKnown: false, connection: "connecting",
};

export function atHome(state: AppState): boolean {
  return state.tabsKnown && state.openingTabs === 0 && (state.viewClosed === true || visibleTabs(state).length === 0);
}
export function visibleError(state: AppState, session: ChatState): string | undefined {
  return state.error ?? session.error;
}
export function visibleTabs(state: AppState): ReadonlyDeep<AppTab>[] {
  return state.tabs.filter((tab) => !state.closingSessionIds.includes(tab.sessionId));
}
export function activeSession(state: AppState): ChatState {
  if (state.viewClosed) return initialChatState;
  return (Object.hasOwn(state.sessions, state.activeSessionId) ? state.sessions[state.activeSessionId] : undefined)
    ?? Object.values(state.sessions)[0] ?? initialChatState;
}

/** Application presentation only; PiClient is the sole wire/projection owner. */
export function reduceAppMessage(state: AppState, action: AppAction): AppState {
  if (action.type === "closeView") return { ...state, activeSessionId: "", viewClosed: true };
  if (action.type === "focusSession") return state.tabs.some(tab => tab.sessionId === action.sessionId) ? { ...state, activeSessionId: action.sessionId, viewClosed: false } : state;
  if (action.type === "sessionOpened") return { ...state, activeSessionId: action.sessionId, viewClosed: false, error: undefined, openingTabs: Math.max(0, state.openingTabs - 1) };
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
  const hiddenErrors = Object.fromEntries(Object.entries(state.hiddenErrors).filter(([id]) => Object.hasOwn(sdk.sessions, id)));
  const sessions = Object.fromEntries(Object.entries(sdk.sessions).map(([id, next]) => {
    const source = Object.hasOwn(state.sdkSessions, id) ? state.sdkSessions[id] : undefined;
    const previous = Object.hasOwn(state.sessions, id) ? state.sessions[id] : undefined;
    const event = message && "sessionId" in message && message.sessionId === id ? message : undefined;
    if (source === next && previous) return [id, previous];
    if ((event?.type === "event" && (event.event === "session.snapshot" || (event.event === "runtime.status" && event.sequence > (source?.sequence ?? -1) && event.data.lastError !== undefined))) || (message?.type === "response" && source?.sequence !== undefined && source.sequence < next.sequence)) delete hiddenErrors[id];
    return [id, projectChatState(next, previous, event, hiddenErrors[id], source)];
  }));
  const tabs = sdk.inventory === state.sdkInventory ? state.tabs : sdk.inventory.map(tab => ({ ...tab, status: tab.status === "closing" ? "blocked" as const : tab.status }));
  // A runtime switch replaces the selected identity; transfer focus to the new
  // identity before the generic removal fallback can select another tab.
  const replacement = message?.type === "event" && message.event === "session.replaced" ? message.data : undefined;
  const selectedId = replacement?.previousSessionId === state.activeSessionId ? replacement.snapshot.sessionId : state.activeSessionId;
  let next: AppState = { ...state, serverInstanceId: sdk.serverInstanceId, sessions, sdkSessions: sdk.sessions, sdkInventory: sdk.inventory, themes: sdk.themes, hiddenErrors,
    tabs, activeSessionId: state.viewClosed ? "" : tabs.some(tab => tab.sessionId === selectedId) ? selectedId : tabs[0]?.sessionId ?? "",
    closingSessionIds: state.closingSessionIds.filter(id => tabs.some(tab => tab.sessionId === id)),
    catalogue: sdk.catalogue, appFeatures: sdk.features };
  if (sdk.connection.phase === "ready") next = { ...next, tabsKnown: true, connection: "open", error: state.connection === "open" ? state.error : undefined };
  else {
    const { phase, error } = sdk.connection;
    if (phase === "superseded") next = { ...next, connection: "superseded", error: undefined };
    else if (phase === "reconnecting") next = { ...next, connection: "connecting", error: "Waiting for the Pi Chat server…" };
    else if (phase === "failed") next = { ...next, connection: "connecting", error: `${error?.message ?? "Connection failed."} Reload to reconnect.` };
    else next = { ...next, connection: "connecting" };
  }
  return next;
}
