import type { ActionRegistry, ChatMessage, ExtensionStatus, PiChatExtensions, ProjectCatalogue, ServerMessage, UiPrompt, Widget } from "../../shared/protocol.js";

/**
 * Losing the socket is a state change the transcript must reflect, so it is an
 * action rather than something the hook patches in afterwards.
 */
/** Session-scoped server messages; app-level ones are handled by the app reducer. */
export type SessionServerMessage = Extract<ServerMessage, { sessionId: string }>;

export type ChatAction =
  | SessionServerMessage
  | { type: "connectionLost"; error?: string }
  | { type: "superseded" };

export interface ChatState {
  messages: ChatMessage[];
  /** The run in flight: `thinking` is the reasoning streamed ahead of `text`. */
  draft?: { runId: string; text: string; thinking: string };
  status: "connecting" | "idle" | "running" | "aborting" | "superseded";
  error?: string;
  sessionId: string;
  projectPath: string;
  /** The session's file on disk. Absent until Pi has written it. */
  sessionPath?: string;
  catalogue: ProjectCatalogue;
  actions: ActionRegistry;
  /** Blocking `ctx.ui` questions; the newest is the one on screen. */
  prompts: UiPrompt[];
  /** Extension panels from `ctx.ui.setWidget`, shown around the composer. */
  widgets: Widget[];
  /** Extension labels from `ctx.ui.setStatus`, shown in the composer footer. */
  statuses: ExtensionStatus[];
  /** Declarative Pi Chat web extension contributions such as slot buttons. */
  extensions: PiChatExtensions;
  sequence: number;
}

export const initialChatState: ChatState = {
  messages: [],
  status: "connecting",
  sessionId: "",
  projectPath: "",
  catalogue: { projects: [] },
  actions: { features: [], commands: [] },
  prompts: [],
  widgets: [],
  statuses: [],
  extensions: { buttons: [], badges: [], state: {} },
  sequence: -1,
};

/**
 * Notices live only in the browser, so every snapshot has to weave them back
 * into the authoritative transcript. Re-appending them at the end was what made
 * the result of an earlier `/session` reappear underneath a later answer, as if
 * it had just been emitted again.
 */
export function mergeNotices(next: ChatMessage[], previous: ChatMessage[]): ChatMessage[] {
  const pending = anchoredNotices(previous, next.length);
  if (pending.length === 0) return next;
  const merged: ChatMessage[] = [];
  let pointer = 0;
  // The resolved anchor is written back, so a notice is placed once and then
  // stays put no matter how many snapshots follow.
  const place = (entry: AnchoredNotice): ChatMessage =>
    entry.notice.anchor === entry.anchor ? entry.notice : { ...entry.notice, anchor: entry.anchor };
  next.forEach((entry, index) => {
    for (; pointer < pending.length && pending[pointer]!.anchor <= index; pointer++) merged.push(place(pending[pointer]!));
    merged.push(entry);
  });
  // Anything anchored past the end of a shorter transcript, e.g. after a
  // compaction, still belongs at the bottom rather than being dropped.
  for (; pointer < pending.length; pointer++) merged.push(place(pending[pointer]!));
  return merged;
}

/**
 * A notice records where it was emitted, but that anchor can be missing: it was
 * added later, and a notice that arrives before the session's first snapshot
 * has no transcript to count against. Rather than fall back to the end of the
 * list, which is what made an old notice resurface under a new answer, its
 * position is then read from where it currently sits.
 */
type NoticeMessage = Extract<ChatMessage, { role: "notice" }>;
interface AnchoredNotice {
  notice: NoticeMessage;
  anchor: number;
}

function anchoredNotices(previous: ChatMessage[], length: number): AnchoredNotice[] {
  // With no real message on either side there is nothing to anchor against, so
  // such a notice belongs at the end of whatever the snapshot turns out to be.
  const blind = !previous.some((entry) => entry.role !== "notice");
  const anchored: AnchoredNotice[] = [];
  let seen = 0;
  for (const entry of previous) {
    if (entry.role !== "notice") {
      seen++;
      continue;
    }
    const fallback = blind ? length : seen;
    anchored.push({ notice: entry, anchor: Math.min(entry.anchor ?? fallback, length) });
  }
  return anchored;
}

export function reduceServerMessage(state: ChatState, message: ChatAction): ChatState {
  if (message.type === "superseded") {
    // Another tab owns the runtime now. Stay quiet until the user asks for it
    // back, otherwise both tabs reconnect in a loop and neither can prompt.
    return { ...state, status: "superseded", draft: undefined, error: undefined };
  }
  if (message.type === "connectionLost") {
    // Keep the transcript on screen, but drop the partial stream: only the next
    // snapshot can say what the server actually recorded.
    return { ...state, status: "connecting", draft: undefined, error: message.error };
  }
  if (message.type === "snapshot") {
    // Notices are client-only and never persisted, so an authoritative snapshot
    // would otherwise erase the output of the command that triggered it.
    return {
      messages: mergeNotices(message.messages, state.messages),
      status: message.isStreaming ? "running" : "idle",
      sessionId: message.sessionId,
      projectPath: message.projectPath,
      sessionPath: message.sessionPath,
      catalogue: message.catalogue ?? state.catalogue,
      actions: message.actions ?? state.actions,
      prompts: message.prompts ?? [],
      widgets: message.widgets ?? [],
      statuses: message.statuses ?? [],
      extensions: message.extensions ?? { buttons: [], badges: [], state: {} },
      sequence: message.throughSequence,
      // The server owns the failure now, so a refresh after a failed turn
      // reports it again instead of quietly dropping it.
      error: message.lastError,
    };
  }
  if (message.sequence <= state.sequence) return state;
  if (message.type === "assistantDelta" || message.type === "thinkingDelta") {
    // A delta for another run starts a fresh draft, so a reconnect mid-turn
    // cannot splice two runs into one bubble.
    const previous = state.draft?.runId === message.runId ? state.draft : { runId: message.runId, text: "", thinking: "" };
    const draft = message.type === "assistantDelta"
      ? { ...previous, text: previous.text + message.delta }
      : { ...previous, thinking: previous.thinking + message.delta };
    return { ...state, sequence: message.sequence, draft };
  }
  if (message.type === "toolEvent") {
    const card = message.tool;
    const id = `tool:${card.toolCallId}`;
    const index = state.messages.findIndex((entry) => entry.id === id);
    if (index === -1) {
      const entry: ChatMessage = { id, role: "tool", tool: card };
      return { ...state, sequence: message.sequence, messages: [...state.messages, entry] };
    }
    const existing = state.messages[index]!;
    if (existing.role !== "tool" || existing.tool.status !== "running") {
      // Once a card reached its final state it stays final: duplicate or
      // out-of-order events (e.g. replayed after a reconnect) must not
      // re-run the transition or regress it to running.
      return { ...state, sequence: message.sequence };
    }
    const updated: ChatMessage = {
      ...existing,
      tool: {
        ...existing.tool,
        name: card.name,
        status: card.status,
        ...(card.argsText !== undefined ? { argsText: card.argsText } : {}),
        ...(card.outputText !== undefined ? { outputText: card.outputText } : {}),
      },
    };
    const messages = [...state.messages];
    messages[index] = updated;
    return { ...state, sequence: message.sequence, messages };
  }
  if (message.type === "messageFinal") {
    const messages = state.messages.some((item) => item.id === message.message.id)
      ? state.messages
      : [...state.messages, message.message];
    return { ...state, sequence: message.sequence, messages, draft: message.message.role === "assistant" ? undefined : state.draft };
  }
  if (message.type === "notification") {
    // Extension output is transient: it belongs in the transcript next to the
    // command that produced it, but it is never persisted in the session.
    const entry: ChatMessage = {
      id: `notice:${message.sequence}`,
      role: "notice",
      level: message.level,
      text: message.message,
      // Recorded now, because after the next snapshot there is no other way to
      // tell which part of the conversation this notice answered. Before the
      // first snapshot the transcript is still unknown, so no position is
      // claimed and the notice keeps the old end-of-list behaviour.
      ...(state.sequence < 0 ? {} : { anchor: state.messages.filter((item) => item.role !== "notice").length }),
    };
    return { ...state, sequence: message.sequence, messages: [...state.messages, entry] };
  }
  if (message.type === "runtimeStatus") {
    // Only a new run clears a reported failure. Status changes are frequent and
    // mostly unrelated, so overwriting with an absent error used to hide the
    // message within milliseconds of showing it.
    const error = message.error ?? (message.status === "running" ? undefined : state.error);
    return { ...state, sequence: message.sequence, status: message.status, error };
  }
  if (message.type === "prompts") {
    return { ...state, sequence: message.sequence, prompts: message.prompts };
  }
  if (message.type === "widgets") {
    return { ...state, sequence: message.sequence, widgets: message.widgets };
  }
  if (message.type === "statuses") {
    return { ...state, sequence: message.sequence, statuses: message.statuses };
  }
  return state;
}
