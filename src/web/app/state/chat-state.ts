import { initialSessionState, widgetSchema, footerItemSchema, piChatButtonSchema, piChatBadgeSchema, uiPromptSchema, type Widget, type FooterItem, type PiChatExtensions, type UiPrompt, type ReadonlyDeep, type SessionState, type ServerMessage, type ChatMessage } from "@manuelselch/pi-sdk";

export type ChatState = ReadonlyDeep<Omit<SessionState, "messages" | "widgets" | "footer" | "extensions" | "prompts"> & { messages: (ChatMessage | NoticeMessage)[]; widgets: Widget[]; footer: FooterItem[]; extensions: PiChatExtensions; prompts: UiPrompt[] }>;
export const initialChatState: ChatState = { ...initialSessionState, widgets: [], footer: [], extensions: { buttons: [], badges: [], state: {} }, prompts: [] };
type NoticeMessage = { id: string; role: "notice"; level: "info" | "warning" | "error"; text: string; anchor?: number; timestamp?: number };
export type ChatViewMessage = ReadonlyDeep<ChatMessage | NoticeMessage>;
type Message = ChatViewMessage;
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
export function projectChatState(next: ReadonlyDeep<SessionState>, previous = initialChatState, message?: ReadonlyDeep<ServerMessage>, hiddenError?: string, source?: ReadonlyDeep<SessionState>): ChatState {
  const event = message?.type === "event" ? message : undefined;
  const authoritativeSnapshot = event?.event === "session.snapshot" || (message?.type === "response" && source?.sequence !== undefined && source.sequence !== next.sequence);
  let messages = source?.messages === next.messages ? previous.messages : mergeNotices(next.messages, previous.messages, authoritativeSnapshot);
  if (event?.event === "notification.created" && event.sequence > previous.sequence && next.sequence === event.sequence) {
    messages = [...messages, {
      id: `notice:${event.sequence}`, role: "notice", level: event.data.level, text: event.data.message,
      ...(previous.sequence < 0 ? {} : { anchor: messages.filter((item) => item.role !== "notice").length }),
    }];
  }
  const error = hiddenError !== undefined && next.error === hiddenError ? undefined : next.error;
  const widgets = source?.widgets === next.widgets ? previous.widgets : next.widgets.flatMap(value => { const parsed = widgetSchema.safeParse(value); return parsed.success ? [parsed.data] : []; });
  const footer = source?.footer === next.footer ? previous.footer : next.footer.flatMap(value => { const parsed = footerItemSchema.safeParse(value); return parsed.success ? [parsed.data] : []; });
  // Unknown optional slots/styles are ignored by web views, not by core decoding.
  const extensions = source?.extensions === next.extensions ? previous.extensions : {
    buttons: next.extensions.buttons.flatMap(value => { const parsed = piChatButtonSchema.safeParse(value); return parsed.success ? [parsed.data] : []; }),
    badges: next.extensions.badges.flatMap(value => { const parsed = piChatBadgeSchema.safeParse(value); return parsed.success ? [parsed.data] : []; }), state: next.extensions.state,
  };
  const prompts = source?.prompts === next.prompts ? previous.prompts : next.prompts.map(value => uiPromptSchema.parse(value));
  return { ...next, messages, error, widgets, footer, extensions, prompts };
}
