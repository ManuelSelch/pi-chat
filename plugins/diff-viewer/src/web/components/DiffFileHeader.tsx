import { ActionIcon, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconMessagePlus } from "@tabler/icons-react";
import type { RenderFile } from "../lib/diff-items.js";
import type { ReviewComment } from "../../domain/review.js";

export function DiffFileHeader({entry,collapsed,onToggle,onComment}:{entry:RenderFile;collapsed:boolean;onToggle():void;onComment?:(path:string,side:ReviewComment["side"],line:number)=>void}) {
  const {file,placeholder} = entry;
  const first = onComment ? entry.first : undefined;
  return <div data-diff-file={file.path}>
    <div className="flex items-center justify-between gap-2 border-b border-(--mantine-color-default-border) bg-(--mantine-color-default) px-3 py-3 font-mono text-[11px]">
      <UnstyledButton className="flex min-w-0 items-center gap-1.5 text-[11px]" aria-expanded={!collapsed} aria-label={(collapsed ? "Expand " : "Collapse ")+file.path} onClick={onToggle}>
        {collapsed ? <IconChevronRight size={14} className="shrink-0"/> : <IconChevronDown size={14} className="shrink-0"/>}<span className="wrap-anywhere">{file.path}</span>
      </UnstyledButton>
      <span className="flex shrink-0 items-center gap-2"><span className="text-(--pi-diff-added)">+{file.added}</span><span className="text-(--pi-diff-removed)">−{file.removed}</span>
        {first && <ActionIcon variant="subtle" color="gray" size="sm" aria-label={"Comment on "+file.path} onClick={()=>onComment?.(file.path,first.next!==null ? "additions" : "deletions",first.next ?? first.old!)}><IconMessagePlus size={15}/></ActionIcon>}
      </span>
    </div>
    {!collapsed && placeholder && <div className="p-6 text-center text-xs text-(--mantine-color-dimmed)">{placeholder}</div>}
  </div>;
}
