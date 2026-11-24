import { useMemo, useState } from "react";
import { UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import type { ChangedFile } from "../../contract.js";
import { parsePatch } from "../../domain/parse-patch.js";

export function FileDiff({file,wrap=true}:{file:ChangedFile;wrap?:boolean}) {
  const lines = useMemo(()=>parsePatch(file.patch),[file.patch]);
  const [expanded,setExpanded] = useState(file.status!=="D");
  const headingClass = "sticky top-0 z-1 flex w-full items-center justify-between gap-3 border-b border-(--mantine-color-default-border) bg-(--mantine-color-default) px-4 py-3 font-mono text-[11px]";
  const heading = <>
    <span className="flex min-w-0 items-center gap-2 wrap-anywhere">{file.status==="D" && (expanded ? <IconChevronDown size={14} className="shrink-0"/> : <IconChevronRight size={14} className="shrink-0"/>)}<span>{file.path}</span></span>
    <span className="flex shrink-0 gap-2"><span className="text-(--pi-diff-added)">+{file.added}</span><span className="text-(--pi-diff-removed)">−{file.removed}</span></span>
  </>;
  return <section aria-label={"Diff for "+file.path} data-diff-file={file.path} className="border-b border-(--mantine-color-default-border)">
    {file.status==="D" ? <UnstyledButton className={headingClass+" hover:bg-(--mantine-color-default-hover)"} aria-expanded={expanded} aria-label={(expanded ? "Collapse " : "Expand ")+file.path} onClick={()=>setExpanded(current=>!current)}>{heading}</UnstyledButton> : <div className={headingClass}>{heading}</div>}
    {expanded && (file.binary || !lines.length ? <div className="p-6 text-center text-xs text-(--mantine-color-dimmed)">{file.binary ? "Binary file changed. No text diff available." : file.status==="A" ? "Empty file added." : file.status==="D" ? "Empty file deleted." : "File metadata changed."}</div> :
    <div className="overflow-x-auto pb-5">
      <div className={wrap ? "w-full" : "w-max min-w-full"}>
        {lines.map((line,index)=>line.kind==="hunk" || line.kind==="note" ?
          <div key={index} className={`bg-(--pi-selected-bg) px-4 py-2 font-mono text-[11px] text-(--mantine-color-dimmed) ${wrap ? "wrap-anywhere" : "whitespace-pre"}`}>{line.text}</div> :
          <div key={index} className={`grid grid-cols-[34px_34px_24px_minmax(0,1fr)] bg-(--diff-row-bg) font-mono text-xs leading-6 ${line.kind==="add" ? "[--diff-row-bg:color-mix(in_srgb,var(--pi-diff-added)_11%,var(--mantine-color-body))]" : line.kind==="remove" ? "[--diff-row-bg:color-mix(in_srgb,var(--pi-diff-removed)_11%,var(--mantine-color-body))]" : "[--diff-row-bg:var(--mantine-color-body)]"}`}>
            <span aria-hidden="true" className="sticky left-0 bg-(--diff-row-bg) text-right text-[10px] text-(--mantine-color-dimmed) select-none">{line.old}</span>
            <span aria-hidden="true" className="sticky left-[34px] bg-(--diff-row-bg) text-right text-[10px] text-(--mantine-color-dimmed) select-none">{line.next}</span>
            <span aria-hidden="true" className="sticky left-[68px] bg-(--diff-row-bg) text-center select-none">{line.kind==="add" ? "+" : line.kind==="remove" ? "−" : " "}</span>
            <code className={`min-w-0 pr-5 ${wrap ? "whitespace-pre-wrap wrap-anywhere" : "whitespace-pre"}`}>{line.text || " "}</code>
          </div>)}
      </div>
    </div>)}
  </section>;
}
