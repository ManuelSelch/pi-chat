import { UnstyledButton } from "@mantine/core";
import { IconFileCode, IconFileText, IconPhoto } from "@tabler/icons-react";
import type { ChangedFile } from "./data";

export function FileList({ files, selected, onSelect }: {files: ChangedFile[]; selected:string; onSelect:(path:string)=>void}) {
  return <nav className="file-list" aria-label="Changed files">
    <div className="list-heading">Files <span>{files.length}</span></div>
    {files.map(file => {
      const parts = file.path.split("/");
      const name = parts.pop();
      const Icon = file.binary ? IconPhoto : name?.endsWith(".md") ? IconFileText : IconFileCode;
      return <UnstyledButton key={file.path} className="file-item" title={file.path} aria-label={file.path} data-selected={file.path === selected} onClick={()=>onSelect(file.path)} aria-pressed={file.path === selected}>
        <Icon size={14}/><span className="file-name">{name}</span>
        <span className={"status status-"+file.status} aria-label={file.status==="M"?"Modified":file.status==="A"?"Added":"Deleted"}>{file.status}</span>
      </UnstyledButton>;
    })}
  </nav>;
}
