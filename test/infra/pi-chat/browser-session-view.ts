import { reduceSessionMessage, type SessionState, type SessionAction } from "@manuelselch/pi-sdk";
import { initialChatState, projectChatState, type ChatState } from "../../../src/web/app/state/chat-state.js";
export { initialChatState };
export type { ChatState };
/** Pure view fixtures run the SDK reducer before composing application-owned notices. */
export function reduceServerMessage(state: ChatState, message: SessionAction): ChatState {
  const source = structuredClone({ ...state, messages: state.messages.filter(entry => entry.role !== "notice") }) as SessionState;
  const next = reduceSessionMessage(source, message);
  if (next === source) return state;
  return projectChatState(next, state, "version" in message ? message : undefined);
}
