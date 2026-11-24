import { memo, useMemo, useRef, useState } from "react";
import { UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import type { ChangedFile } from "../../contract.js";
import { parsePatch } from "../../domain/parse-patch.js";
import { useHighlightedPatch } from "../hooks/use-highlighted-patch.js";
import type { RequestHighlight } from "../lib/highlight-worker-client.js";
import { DiffLines } from "./DiffLines.js";

export const FileDiff = memo(function FileDiff({file,wrap=true,onHighlight}:{file:ChangedFile;wrap?:boolean;onHighlight:RequestHighlight}) {
  const lines = useMemo(()=>parsePatch(file.patch),[file.patch]);
  const [expanded,setExpanded] = useState(file.status!=="D");
  const section = useRef<HTMLElement>(null);
  const highlighted = useHighlightedPatch(section,file.path,lines,expanded && !file.binary,onHighlight);
  const headingClass = "sticky top-0 z-1 flex w-full items-center justify-between gap-3 border-b border-(--mantine-color-default-border) bg-(--mantine-color-default) px-4 py-3 font-mono text-[11px]";
  const heading = <>
    <span className="flex min-w-0 items-center gap-2 wrap-anywhere">{file.status==="D" && (expanded ? <IconChevronDown size={14} className="shrink-0"/> : <IconChevronRight size={14} className="shrink-0"/>)}<span>{file.path}</span></span>
    <span className="flex shrink-0 gap-2"><span className="text-(--pi-diff-added)">+{file.added}</span><span className="text-(--pi-diff-removed)">−{file.removed}</span></span>
  </>;
  return <section ref={section} aria-label={"Diff for "+file.path} data-diff-file={file.path} className="border-b border-(--mantine-color-default-border)">
    {file.status==="D" ? <UnstyledButton className={headingClass+" hover:bg-(--mantine-color-default-hover)"} aria-expanded={expanded} aria-label={(expanded ? "Collapse " : "Expand ")+file.path} onClick={()=>setExpanded(current=>!current)}>{heading}</UnstyledButton> : <div className={headingClass}>{heading}</div>}
    {expanded && (file.binary || !lines.length ? <div className="p-6 text-center text-xs text-(--mantine-color-dimmed)">{file.binary ? "Binary file changed. No text diff available." : file.status==="A" ? "Empty file added." : file.status==="D" ? "Empty file deleted." : "File metadata changed."}</div> :
      <DiffLines lines={lines} highlighted={highlighted} wrap={wrap}/>)}
  </section>;
});
