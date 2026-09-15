import type { ChatMessage } from "./protocol.js";

/** Matches the width the TUI session list leaves for an unnamed session. */
const MAX_TITLE_LENGTH = 60;

/** The first user message, as the Pi TUI picks it for an unnamed session. */
export function firstUserMessage(messages: readonly ChatMessage[]): string | undefined {
  for (const message of messages) {
    if (message.role === "user") return message.text;
  }
  return undefined;
}

/**
 * How a session is labelled in tabs, the header and the session lists.
 *
 * The TUI shows `name ?? firstMessage`, so pi-chat does the same instead of
 * calling every unnamed session "New session". Control characters and line
 * breaks are folded into spaces: a pasted prompt would otherwise smear a tab.
 */
export function sessionTitle(name: string | undefined, firstMessage?: string, fallback = "New session"): string {
  const named = name?.trim();
  if (named) return named;
  // eslint-disable-next-line no-control-regex
  const summary = firstMessage?.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!summary) return fallback;
  return summary.length > MAX_TITLE_LENGTH ? `${summary.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…` : summary;
}
