import { memo } from "react";
import type { PatchLine } from "../../domain/parse-patch.js";
import type { HighlightSegment } from "../lib/highlight-patch.js";

export const DiffLines = memo(function DiffLines({lines,highlighted,wrap}:{lines:PatchLine[];highlighted:HighlightSegment[][];wrap:boolean}) {
  return <div className="overflow-x-auto pb-5">
    <div className={wrap ? "w-full" : "w-max min-w-full"}>
      {lines.map((line,index)=>line.kind==="hunk" || line.kind==="note" ?
        <div key={index} className={`bg-(--pi-selected-bg) px-4 py-2 font-mono text-[11px] text-(--mantine-color-dimmed) ${wrap ? "wrap-anywhere [content-visibility:auto] [contain-intrinsic-block-size:auto_40px]" : "whitespace-pre"}`}>{line.text}</div> :
        <div key={index} className={`grid grid-cols-[92px_minmax(0,1fr)] bg-(--diff-row-bg) font-mono text-xs leading-6 ${wrap ? "[content-visibility:auto] [contain-intrinsic-block-size:auto_24px]" : ""} ${line.kind==="add" ? "[--diff-row-bg:color-mix(in_srgb,var(--pi-diff-added)_11%,var(--mantine-color-body))]" : line.kind==="remove" ? "[--diff-row-bg:color-mix(in_srgb,var(--pi-diff-removed)_11%,var(--mantine-color-body))]" : "[--diff-row-bg:var(--mantine-color-body)]"}`}>
          <span aria-hidden="true" className={`grid grid-cols-[34px_34px_24px] self-stretch bg-(--diff-row-bg) select-none ${wrap ? "" : "sticky left-0"}`}>
            <span className="text-right text-[10px] text-(--mantine-color-dimmed)">{line.old}</span>
            <span className="text-right text-[10px] text-(--mantine-color-dimmed)">{line.next}</span>
            <span className="text-center">{line.kind==="add" ? "+" : line.kind==="remove" ? "−" : " "}</span>
          </span>
          <code className={`min-w-0 pr-5 ${wrap ? "whitespace-pre-wrap wrap-anywhere" : "whitespace-pre"}`}>{line.text ? highlighted[index]?.map((segment,key)=>segment.classes.length ? <span key={key} className={segment.classes.join(" ")}>{segment.text}</span> : segment.text) ?? line.text : " "}</code>
        </div>)}
    </div>
  </div>;
});
