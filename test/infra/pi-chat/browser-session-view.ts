import { initialSessionState, reduceSessionMessage, type SessionState, type SessionAction } from "@manuelselch/pi-sdk";
import { projectChatState } from "../../../src/web/app/state/chat-state.js";

export { initialSessionState as initialChatState };
export type ChatState = SessionState;

/** Historical browser-view fixtures exercise the SDK first, not a web-owned projection. */
export function reduceServerMessage(state: SessionState, message: SessionAction): SessionState {
  const source = { ...state, messages: state.messages.filter((entry) => entry.role !== "notice") };
  const next = reduceSessionMessage(source, message);
  if (next === source) return state;
  const view = projectChatState(next, state, "version" in message ? message : undefined);
  // Test builders deliberately return independent mutable fixture data.
  return structuredClone(view) as SessionState;
}
