import type { ToolCard } from "../../../shared/protocol.js";

/** Display-only parity with Pi's read renderer; never changes the real tool call. */
export function skillReadHeader(tool: ToolCard): { name: string; subject: string } | undefined {
  if (tool.name !== "read" || !tool.argsText) return undefined;
  let args: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(tool.argsText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    args = parsed as Record<string, unknown>;
  } catch {
    // An unfinished path may still grow beyond SKILL.md. Keep the ordinary header.
    return undefined;
  }
  const path = args.file_path ?? args.path;
  if (typeof path !== "string") return undefined;
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.pop() !== "SKILL.md") return undefined;
  const label = parts.pop() || "SKILL.md";
  const offset = typeof args.offset === "number" ? args.offset : undefined;
  const limit = typeof args.limit === "number" ? args.limit : undefined;
  const start = offset ?? 1;
  const range = offset === undefined && limit === undefined ? "" : `:${start}${limit === undefined ? "" : `-${start + limit - 1}`}`;
  return { name: "[skill]", subject: label + range };
}
