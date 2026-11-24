import type { ChangedFile } from "../../contract.js";

export function DiffSummary({files}:{files:ChangedFile[]}) {
  return <footer className="flex gap-4 border-t border-(--mantine-color-default-border) px-4 py-2 text-[11px] text-(--mantine-color-dimmed)">
    <span>{files.length} {files.length===1 ? "file" : "files"} changed</span>
    <span className="text-(--pi-diff-added)">+{files.reduce((sum,file)=>sum+file.added,0)}</span>
    <span className="text-(--pi-diff-removed)">−{files.reduce((sum,file)=>sum+file.removed,0)}</span>
  </footer>;
}
