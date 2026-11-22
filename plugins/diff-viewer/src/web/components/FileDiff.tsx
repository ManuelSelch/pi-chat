import { useMemo } from "react";
import type { ChangedFile } from "../../contract.js";
import { parsePatch } from "../../domain/parse-patch.js";

export function FileDiff({file}:{file:ChangedFile}) {
  const lines = useMemo(()=>parsePatch(file.patch),[file.patch]);
  return <section aria-label={"Diff for "+file.path} data-diff-file={file.path} className="border-b border-(--mantine-color-default-border)">
    <div className="sticky top-0 z-1 flex items-center justify-between gap-3 border-b border-(--mantine-color-default-border) bg-(--mantine-color-default) px-4 py-3 font-mono text-[11px]">
      <span className="min-w-0 wrap-anywhere">{file.path}</span>
      <span className="flex shrink-0 gap-2"><span className="text-(--pi-diff-added)">+{file.added}</span><span className="text-(--pi-diff-removed)">−{file.removed}</span></span>
    </div>
    {file.binary || !lines.length ? <div className="p-6 text-center text-xs text-(--mantine-color-dimmed)">{file.binary ? "Binary file changed. No text diff available." : file.status==="A" ? "Empty file added." : file.status==="D" ? "Empty file deleted." : "File metadata changed."}</div> :
    <div className="overflow-x-auto pb-5">
      {lines.map((line,index)=>line.kind==="hunk" || line.kind==="note" ?
        <div key={index} className="min-w-max bg-(--pi-selected-bg) px-4 py-2 font-mono text-[11px] text-(--mantine-color-dimmed)">{line.text}</div> :
        <div key={index} className={`flex min-w-max font-mono text-xs leading-[26px] ${line.kind==="add" ? "bg-(--pi-diff-added)/10" : line.kind==="remove" ? "bg-(--pi-diff-removed)/10" : ""}`}>
          <span aria-hidden="true" className="w-9 shrink-0 text-right text-[10px] text-(--mantine-color-dimmed) select-none">{line.old}</span>
          <span aria-hidden="true" className="w-9 shrink-0 text-right text-[10px] text-(--mantine-color-dimmed) select-none">{line.next}</span>
          <span aria-hidden="true" className="w-7 shrink-0 text-center select-none">{line.kind==="add" ? "+" : line.kind==="remove" ? "−" : " "}</span>
          <code className="whitespace-pre pr-6">{line.text || " "}</code>
        </div>)}
    </div>}
  </section>;
}
