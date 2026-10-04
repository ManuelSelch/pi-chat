import type { ChatMessage } from "../../../shared/protocol.js";
import { projectEditDiff } from "../../../shared/edit-diff.js";
import { clampToolOutput, toolCallsFromContent, toolCardFromCall, toolMessageId } from "./tool-mapping.js";

/**
 * Reasoning is kept on every assistant message and therefore in every snapshot,
 * so a long session would pay for it repeatedly. The tail is what a reader
 * wants — the conclusion of the chain, not its opening — so this clamp drops
 * the beginning rather than the end.
 */
const THINKING_TEXT_MAX = 8_000;

function clampThinking(text: string): string {
  return text.length > THINKING_TEXT_MAX ? `[truncated] …${text.slice(-THINKING_TEXT_MAX)}` : text;
}

/**
 * Merges flattened entries by id. A tool call appears twice in history — the
 * assistant's tool-call block (running, with arguments) and its toolResult
 * (final, with output) — so the merge keeps the latest status/output while
 * preserving argsText from the earlier entry.
 */
export function mergeEntriesById(flattened: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  const order: string[] = [];
  for (const entry of flattened) {
    if (!byId.has(entry.id)) order.push(entry.id);
    const previous = byId.get(entry.id);
    if (previous?.role === "tool" && entry.role === "tool") {
      byId.set(entry.id, {
        ...entry,
        tool: {
          ...previous.tool,
          ...entry.tool,
          ...(previous.tool.argsText !== undefined && entry.tool.argsText === undefined
            ? { argsText: previous.tool.argsText }
            : {}),
        },
      });
    } else {
      byId.set(entry.id, entry);
    }
  }
  return order.map((id) => byId.get(id)!);
}

function messageFromEntry(entry: unknown, identity: MessageIdentity): ChatMessage[] {
  if (!entry || typeof entry !== "object") return [];
  const value = entry as Record<string, unknown>;
  if (value.type === "message") return toChatMessages(value.message, identity);
  const custom = customMessageFromEntry(value);
  return custom ? [custom] : [];
}

export function messagesFromBranch(branch: Iterable<unknown>, identity: MessageIdentity): ChatMessage[] {
  return mergeEntriesById(Array.from(branch).flatMap((entry) => messageFromEntry(entry, identity)));
}

function timestampFromEntry(value: Record<string, unknown>): { timestamp?: number } {
  if (typeof value.timestamp !== "string") return {};
  const timestamp = Date.parse(value.timestamp);
  return Number.isFinite(timestamp) ? { timestamp } : {};
}

export function customMessageFromEntry(entry: unknown): ChatMessage | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const value = entry as Record<string, unknown>;
  if (value.type !== "custom_message") return undefined;
  if (value.display !== true || typeof value.customType !== "string" || value.customType.length === 0) return undefined;
  if (typeof value.id !== "string" || value.id.length === 0) return undefined;
  const text = textFromContent(value.content);
  if (text.length === 0) return undefined;
  return { id: value.id, role: "custom", customType: value.customType, text, ...timestampFromEntry(value) };
}

export function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const value = part as Record<string, unknown>;
      if (value.type === "text" && typeof value.text === "string") return value.text;
      return "";
    })
    .join("");
}

/**
 * The model's reasoning blocks, joined in order.
 *
 * A redacted block carries no readable text at all (only an opaque signature),
 * so it becomes a marker: an empty panel would read as "the model did not
 * think", which is the opposite of what happened.
 */
function thinkingFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const value = part as Record<string, unknown>;
      if (value.type !== "thinking") return "";
      if (value.redacted === true) return "_[redacted reasoning]_";
      return typeof value.thinking === "string" ? value.thinking : "";
    })
    .filter((part) => part.length > 0)
    .join("\n\n");
}

/**
 * Stable per-message identity.
 *
 * Ids must match whether a message is first seen as a live `message_end` event
 * or later read back from `session.messages` for a snapshot, otherwise a reload
 * would duplicate messages the client already holds. Pi hands out the same
 * object in both paths, so identity is keyed on the object itself rather than
 * on its position, timestamp, or text.
 */
export class MessageIdentity {
  private readonly ids = new WeakMap<object, string>();
  private next = 0;

  idFor(message: object): string {
    const existing = this.ids.get(message);
    if (existing) return existing;
    const id = `msg-${++this.next}`;
    this.ids.set(message, id);
    return id;
  }
}

/**
 * Maps one Pi session message to zero or more transcript entries.
 *
 * - user/system/assistant text becomes one text entry.
 * - an assistant tool-call block becomes a *running* tool entry; the matching
 *   toolResult message, which follows in session order, overwrites it as
 *   success/error, so flattening the whole session in order yields final cards.
 * - an assistant message with neither text, reasoning, nor tool calls yields
 *   nothing, so a failed turn never leaves an empty bubble.
 */
export function toChatMessages(message: unknown, identity: MessageIdentity): ChatMessage[] {
  if (!message || typeof message !== "object") return [];
  const value = message as Record<string, unknown>;
  const timestamp = typeof value.timestamp === "number" ? value.timestamp : undefined;
  const stamp = timestamp === undefined ? {} : { timestamp };

  if (value.role === "toolResult") {
    if (typeof value.toolCallId !== "string" || value.toolCallId.length === 0) return [];
    const output = textFromContent(value.content).trim();
    return [
      {
        id: toolMessageId(value.toolCallId),
        role: "tool",
        tool: {
          toolCallId: value.toolCallId,
          name: typeof value.toolName === "string" && value.toolName.length > 0 ? value.toolName : "tool",
          status: value.isError === true ? "error" : "success",
          editDiff: projectEditDiff(String(value.toolName), value.isError === true, value.details),
          ...(output ? { outputText: clampToolOutput(output) } : {}),
        },
        ...stamp,
      },
    ];
  }

  if (value.role === "custom") {
    if (value.display !== true || typeof value.customType !== "string" || value.customType.length === 0) return [];
    const text = textFromContent(value.content);
    if (text.length === 0) return [];
    return [{ id: identity.idFor(message), role: "custom", customType: value.customType, text, ...stamp }];
  }

  if (value.role !== "user" && value.role !== "assistant" && value.role !== "system") return [];

  const entries: ChatMessage[] = [];
  const text = textFromContent(value.content);
  // Reasoning alone is worth a bubble: a turn that only thought and then called
  // a tool would otherwise show the tool card with nothing explaining it.
  const thinking = value.role === "assistant" ? clampThinking(thinkingFromContent(value.content)) : "";
  if (text.length > 0 || thinking.length > 0) {
    entries.push({
      id: identity.idFor(message),
      role: value.role,
      text,
      ...(thinking ? { thinking } : {}),
      ...stamp,
    });
  }
  for (const call of toolCallsFromContent(value.content)) {
    entries.push({ id: toolMessageId(call.id), role: "tool", tool: toolCardFromCall(call), ...stamp });
  }
  return entries;
}

/** @deprecated single-text-entry view, kept for callers that only want text */
export function toChatMessage(message: unknown, identity: MessageIdentity): ChatMessage | undefined {
  return toChatMessages(message, identity).find((entry) => entry.role !== "tool");
}

