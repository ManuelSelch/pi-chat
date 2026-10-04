import { Box, Text } from "@mantine/core";
import type { ToolCard } from "../../../shared/protocol.js";
import { THEME } from "../../theme.js";

type Row = { kind: "addition" | "removal" | "context" | "header"; text: string; old?: number; next?: number; marker?: string };

export function diffRows(diff: NonNullable<ToolCard["editDiff"]>): Row[] {
  let old = 0, next = 0, oldRemaining = 0, newRemaining = 0;
  const lines = diff.text.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.slice(0, 2000).map((line): Row => {
    if (diff.format === "pi-display") {
      const match = /^([ +\-])\s*(\d+) (.*)$/.exec(line);
      if (!match) return { kind: "header", text: line };
      const [, marker, number, text] = match;
      return { kind: marker === "+" ? "addition" : marker === "-" ? "removal" : "context", marker, text: text!, ...(marker === "-" ? { old: Number(number) } : { next: Number(number) }) };
    }
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      old = Number(hunk[1]); next = Number(hunk[3]);
      oldRemaining = Number(hunk[2] ?? 1); newRemaining = Number(hunk[4] ?? 1);
      return { kind: "header", text: line };
    }
    const marker = line[0];
    if (marker === "-" && oldRemaining > 0) {
      oldRemaining--; return { kind: "removal", marker, text: line.slice(1), old: old++ };
    }
    if (marker === "+" && newRemaining > 0) {
      newRemaining--; return { kind: "addition", marker, text: line.slice(1), next: next++ };
    }
    if (marker === " " && oldRemaining > 0 && newRemaining > 0) {
      oldRemaining--; newRemaining--; return { kind: "context", marker, text: line.slice(1), old: old++, next: next++ };
    }
    return { kind: "header", text: line };
  });
}

export function EditDiff({ diff }: { diff: NonNullable<ToolCard["editDiff"]> }) {
  const rows = diffRows(diff);
  const truncated = diff.truncated || diff.text.split("\n").length > 2001;
  return <>
    <Text size="xs" fw={650} c="dimmed" mt="sm" mb={4}>Changes</Text>
    <Box role="region" aria-label="Edit changes" tabIndex={0} style={{ overflow: "auto", maxHeight: 360, maxWidth: "100%", border: `1px solid ${THEME.border.default}`, borderRadius: 4 }}>
      <Box ff="monospace" fz={12} lh={1.5} style={{ minWidth: "100%", width: "max-content" }}>
        {rows.map((row, index) => <div key={index} data-kind={row.kind} style={{ display: "flex", whiteSpace: "pre", background: row.kind === "addition" ? THEME.diff.addition : row.kind === "removal" ? THEME.diff.removal : undefined }}>
          <span style={{ width: "5ch", flexShrink: 0, textAlign: "right", color: THEME.text.muted, userSelect: "none" }}>{row.old ?? ""}</span>
          <span style={{ width: "5ch", flexShrink: 0, textAlign: "right", color: THEME.text.muted, userSelect: "none" }}>{row.next ?? ""}</span>
          <span style={{ width: "3ch", flexShrink: 0, textAlign: "center" }}>{row.marker ?? " "}</span>
          <span style={{ paddingRight: 12 }}>{row.text || " "}</span>
        </div>)}
      </Box>
    </Box>
    {truncated ? <Text size="xs" c="dimmed">Diff truncated — only part of the changes is shown.</Text> : null}
  </>;
}
