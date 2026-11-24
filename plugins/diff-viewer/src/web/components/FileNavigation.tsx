import { Text, UnstyledButton } from "@mantine/core";
import { IconFileCode } from "@tabler/icons-react";
import type { ChangedFile } from "../../contract.js";

export function FileNavigation({files,selected,onSelect}:{files:ChangedFile[];selected:string;onSelect(path:string):void}) {
  return <nav aria-label="Changed files" className="min-h-0 overflow-auto border-r border-(--mantine-color-default-border) bg-(--pi-sidebar-bg) p-1.5">
    <div className="flex justify-between px-2 py-2 text-[11px] text-(--mantine-color-dimmed)"><span>Files</span><span>{files.length}</span></div>
    {files.map(file=><UnstyledButton key={file.path} aria-label={file.path} aria-pressed={file.path===selected} onClick={()=>onSelect(file.path)}
        className="mb-px flex min-h-7 w-full items-center gap-1.5 rounded-xs px-2 py-1 hover:bg-(--mantine-color-default-hover)"
        bg={file.path===selected ? "var(--pi-selected-bg)" : undefined}>
        <IconFileCode size={14} className="shrink-0"/>
        <span className="min-w-0 flex-1 truncate text-xs">{file.path.split("/").at(-1)}</span>
        <Text size="10px" c={file.status==="A" ? "var(--pi-diff-added)" : file.status==="D" ? "var(--pi-diff-removed)" : "dimmed"}>{file.status}</Text>
      </UnstyledButton>)}
  </nav>;
}
