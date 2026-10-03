import type { ToolCard } from "./protocol.js";

/** Whitelist result metadata; never forward arbitrary tool details. */
export function projectEditDiff(name: string, isError: boolean, details: unknown): ToolCard["editDiff"] {
  if (name !== "edit" || isError || !details || typeof details !== "object") return undefined;
  const value = details as Record<string, unknown>;
  const patch = typeof value.patch === "string" && value.patch.trim() ? value.patch : undefined;
  const display = typeof value.diff === "string" && value.diff.trim() ? value.diff : undefined;
  const source = patch ?? display;
  if (!source) return undefined;
  const truncated = source.length > 102400;
  let text = source.slice(0, 102400);
  if (truncated) text = text.slice(0, Math.max(0, text.lastIndexOf("\n")));
  return {
    format: patch ? "unified" : "pi-display", text, truncated,
    ...(typeof value.firstChangedLine === "number" && Number.isInteger(value.firstChangedLine) && value.firstChangedLine > 0
      ? { firstChangedLine: value.firstChangedLine } : {}),
  };
}
