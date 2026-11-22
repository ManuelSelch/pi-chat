export interface PatchLine {
  kind: "context" | "add" | "remove" | "hunk" | "note";
  text: string;
  old: number | null;
  next: number | null;
}

/** Only hunk bodies carry code; metadata and binary markers do not. */
export function parsePatch(patch: string): PatchLine[] {
  const result: PatchLine[] = [];
  let old = 0;
  let next = 0;
  let inHunk = false;
  for (const line of patch.split("\n")) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      old = Number(hunk[1]); next = Number(hunk[2]); inHunk = true;
      result.push({ kind: "hunk", text: line, old: null, next: null });
    } else if (inHunk && line.startsWith("+")) {
      result.push({ kind: "add", text: line.slice(1), old: null, next: next++ });
    } else if (inHunk && line.startsWith("-")) {
      result.push({ kind: "remove", text: line.slice(1), old: old++, next: null });
    } else if (inHunk && line.startsWith(" ")) {
      result.push({ kind: "context", text: line.slice(1), old: old++, next: next++ });
    } else if (inHunk && line.startsWith("\\")) {
      result.push({ kind: "note", text: line, old: null, next: null });
    }
  }
  return result;
}
