import { createHash } from "node:crypto";
import type { ToolCard } from "../../../shared/protocol.js";

const ARGS_TEXT_MAX = 4_000;
const OUTPUT_TEXT_MAX = 20_000;

function clampText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}… [truncated]` : text;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Pi provider IDs are opaque and may be very long; normalize them to the wire bound. */
export function normalizePiId(value: string, maxLength = 128): string {
  if (value.length <= maxLength && !/[\u0000-\u001f\u007f-\u009f]/.test(value)) return value;
  return `pi-${createHash("sha256").update(value).digest("hex")}`;
}

/** Deterministic so live tool events and rebuilt snapshots share one bounded ID. */
export function toolMessageId(toolCallId: string): string {
  return `tool:${normalizePiId(toolCallId, 123)}`;
}

export interface ToolCallBlock {
  id: string;
  name: string;
  arguments?: unknown;
}

export function toolCallsFromContent(content: unknown): ToolCallBlock[] {
  if (!Array.isArray(content)) return [];
  const calls: ToolCallBlock[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const value = part as Record<string, unknown>;
    if (value.type !== "toolCall" || typeof value.id !== "string" || value.id.length === 0) continue;
    calls.push({
      id: value.id,
      name: typeof value.name === "string" && value.name.length > 0 ? value.name : "tool",
      arguments: value.arguments,
    });
  }
  return calls;
}

export function toolCardFromCall(call: ToolCallBlock): ToolCard {
  const args = call.arguments;
  const content = call.name === "write" && args && typeof args === "object" && !Array.isArray(args)
    ? (args as Record<string, unknown>).content : undefined;
  let writeContent: ToolCard["writeContent"];
  if (typeof content === "string") {
    // Iterate code points only up to the byte budget; never split surrogate pairs.
    let bytes = 0, end = 0;
    for (const character of content) {
      const size = Buffer.byteLength(character, "utf8");
      if (bytes + size > 102400) break;
      bytes += size;
      end += character.length;
    }
    writeContent = { text: content.slice(0, end), truncated: end < content.length };
  }
  return {
    ...(writeContent !== undefined ? { writeContent } : {}),
    toolCallId: normalizePiId(call.id, 123),
    name: call.name,
    status: "running",
    ...(call.arguments === undefined ? {} : { argsText: clampText(safeStringify(call.arguments), ARGS_TEXT_MAX) }),
  };
}

/** The same output budget applies to historical results and live tool updates. */
export function clampToolOutput(text: string): string {
  return clampText(text, OUTPUT_TEXT_MAX);
}
