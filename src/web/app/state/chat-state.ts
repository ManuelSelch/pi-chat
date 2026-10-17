import type { ChatMessage } from "../../../shared/protocol.js";
import { initialSessionState, reduceSessionMessage, type SessionState, type SessionAction } from "@manuelselch/pi-sdk";

export type { SessionServerMessage } from "@manuelselch/pi-sdk";
export type ChatState = SessionState;
export type ChatAction = SessionAction;
export const initialChatState = initialSessionState;

type NoticeMessage = Extract<ChatMessage, { role: "notice" }>;
interface AnchoredNotice { notice: NoticeMessage; anchor: number }

/** Browser-only notices keep their anchors across authoritative snapshots. */
export function mergeNotices(next: ChatMessage[], previous: ChatMessage[]): ChatMessage[] {
  const pending = anchoredNotices(previous, next.length);
  if (pending.length === 0) return next;
  const merged: ChatMessage[] = [];
  let pointer = 0;
  const place = (entry: AnchoredNotice): ChatMessage =>
    entry.notice.anchor === entry.anchor ? entry.notice : { ...entry.notice, anchor: entry.anchor };
  next.forEach((entry, index) => {
    for (; pointer < pending.length && pending[pointer]!.anchor <= index; pointer++) merged.push(place(pending[pointer]!));
    merged.push(entry);
  });
  for (; pointer < pending.length; pointer++) merged.push(place(pending[pointer]!));
  return merged;
}

function anchoredNotices(previous: ChatMessage[], length: number): AnchoredNotice[] {
  const blind = !previous.some((entry) => entry.role !== "notice");
  const anchored: AnchoredNotice[] = [];
  let seen = 0;
  for (const entry of previous) {
    if (entry.role !== "notice") { seen++; continue; }
    const fallback = blind ? length : seen;
    anchored.push({ notice: entry, anchor: Math.min(entry.anchor ?? fallback, length) });
  }
  return anchored;
}

/** Only the browser's transient notice rendering differs from the SDK reducer. */
export function reduceServerMessage(state: ChatState, message: ChatAction): ChatState {
  if (message.type === "snapshot") {
    return { ...reduceSessionMessage(state, message), messages: mergeNotices(message.messages, state.messages) };
  }
  if (message.type === "notification" && message.sequence > state.sequence) {
    const entry: ChatMessage = {
      id: `notice:${message.sequence}`, role: "notice", level: message.level, text: message.message,
      ...(state.sequence < 0 ? {} : { anchor: state.messages.filter((item) => item.role !== "notice").length }),
    };
    return { ...reduceSessionMessage(state, message), messages: [...state.messages, entry] };
  }
  return reduceSessionMessage(state, message);
}
