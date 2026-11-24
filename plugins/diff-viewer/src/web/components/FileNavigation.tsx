import { useMemo, useState } from "react";
import { Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconFileCode, IconFileText, IconFolder, IconSettings, IconTestPipe } from "@tabler/icons-react";
import type { ChangedFile } from "../../contract.js";
import { groupFiles, type FileKind, type NavigationNode } from "../../domain/file-navigation.js";

const rowClass = "mb-px flex min-h-7 w-full items-center gap-1.5 rounded-xs px-2 py-1 text-[11px] hover:bg-(--mantine-color-default-hover)";
const icons = {Source:IconFileCode,Tests:IconTestPipe,Docs:IconFileText,Config:IconSettings};
interface Selection { selected:string; onSelect(path:string):void }
function NavigationRow({node,kind,selected,onSelect}:{node:NavigationNode;kind:FileKind} & Selection) {
  const [expanded,setExpanded] = useState(true);
  if (node.type==="folder") return <div>
    <UnstyledButton aria-label={"Folder "+node.path} aria-expanded={expanded} onClick={()=>setExpanded(current=>!current)} className={rowClass+" text-(--mantine-color-dimmed)"}>
      {expanded ? <IconChevronDown size={12} className="shrink-0"/> : <IconChevronRight size={12} className="shrink-0"/>}<IconFolder size={14} className="shrink-0"/>
      <span className="min-w-0 flex-1 truncate text-left text-[11px]">{node.name}</span><span className="text-[10px]">{node.count}</span>
    </UnstyledButton>
    {expanded && <div className="pl-3.5">{node.children.map(child=><NavigationRow key={child.path} node={child} kind={kind} selected={selected} onSelect={onSelect}/>)}</div>}
  </div>;
  const Icon = icons[kind];
  return <UnstyledButton aria-label={node.path} aria-pressed={node.path===selected} onClick={()=>onSelect(node.path)} className={rowClass} bg={node.path===selected ? "var(--pi-selected-bg)" : undefined}>
    <Icon size={14} className="shrink-0"/>
    <span className="min-w-0 flex-1 truncate text-left text-[11px]">{node.name}</span>
    <Text component="span" size="10px" c={node.file.status==="A" ? "var(--pi-diff-added)" : node.file.status==="D" ? "var(--pi-diff-removed)" : "dimmed"}>{node.file.status}</Text>
  </UnstyledButton>;
}
function KindGroup({kind,nodes,count,selected,onSelect}:{kind:FileKind;nodes:NavigationNode[];count:number} & Selection) {
  const [expanded,setExpanded] = useState(true);
  return <section className="pb-2">
    <UnstyledButton aria-label={kind} aria-expanded={expanded} onClick={()=>setExpanded(current=>!current)} className={rowClass+" mt-2"}>
      {expanded ? <IconChevronDown size={12}/> : <IconChevronRight size={12}/>}<strong className="flex-1 text-left text-[11px] font-semibold">{kind}</strong><span className="text-[10px] text-(--mantine-color-dimmed)">{count}</span>
    </UnstyledButton>
    {expanded && nodes.map(node=><NavigationRow key={node.path} node={node} kind={kind} selected={selected} onSelect={onSelect}/>)}
  </section>;
}
export function FileNavigation({files,selected,onSelect}:{files:ChangedFile[]} & Selection) {
  const groups = useMemo(()=>groupFiles(files),[files]);
  return <nav aria-label="Changed files" className="min-h-0 flex-1 overflow-auto px-1.5 pb-3">
    {groups.map(group=><KindGroup key={group.kind} kind={group.kind} nodes={group.nodes} count={group.files.length} selected={selected} onSelect={onSelect}/>)}
    {!files.length && <Text size="xs" c="dimmed" className="p-3">No matching files</Text>}
  </nav>;
}
