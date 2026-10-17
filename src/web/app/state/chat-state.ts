import { initialSessionState, type ReadonlyDeep, type SessionState, type ServerMessage, type ChatMessage } from "@manuelselch/pi-sdk";

export type ChatState = ReadonlyDeep<SessionState>;
export const initialChatState: ChatState = initialSessionState;
type Message = ReadonlyDeep<ChatMessage>;
type NoticeMessage = Extract<Message, { role: "notice" }>;
interface AnchoredNotice { notice: NoticeMessage; anchor: number }

/** Only snapshots resolve/clamp persisted anchors; live appends keep blind notices in place. */
export function mergeNotices(next: readonly Message[], previous: readonly Message[], snapshot = true): readonly Message[] {
  const blind = !previous.some((entry) => entry.role !== "notice");
  const pending: AnchoredNotice[] = [];
  let seen = 0;
  for (const entry of previous) {
    if (entry.role !== "notice") { seen++; continue; }
    pending.push({ notice: entry, anchor: Math.min(entry.anchor ?? (blind && snapshot ? next.length : seen), next.length) });
  }
  if (pending.length === 0) return next;
  const merged: Message[] = [];
  let pointer = 0;
  const place = ({ notice, anchor }: AnchoredNotice): Message =>
    !snapshot || notice.anchor === anchor ? notice : { ...notice, anchor };
  next.forEach((entry, index) => {
    for (; pointer < pending.length && pending[pointer]!.anchor <= index; pointer++) merged.push(place(pending[pointer]!));
    merged.push(entry);
  });
  for (; pointer < pending.length; pointer++) merged.push(place(pending[pointer]!));
  return merged;
}

/** Compose browser-only notices/error dismissal over an already-reduced SDK projection. */
export function projectChatState(next: ChatState, previous = initialChatState, message?: ReadonlyDeep<ServerMessage>, hiddenError?: string, source?: ChatState): ChatState {
  let messages = source?.messages === next.messages ? previous.messages : mergeNotices(next.messages, previous.messages, message?.type === "snapshot");
  if (message?.type === "notification" && message.sequence > previous.sequence) {
    messages = [...messages, {
      id: `notice:${message.sequence}`, role: "notice", level: message.level, text: message.message,
      ...(previous.sequence < 0 ? {} : { anchor: messages.filter((item) => item.role !== "notice").length }),
    }];
  }
  const error = hiddenError !== undefined && next.error === hiddenError ? undefined : next.error;
  return messages === next.messages && error === next.error ? next : { ...next, messages, error };
}
