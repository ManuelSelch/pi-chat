import { useRef, useState } from "react";
import type { ChangedFile } from "../../contract.js";
import { FileNavigation } from "./FileNavigation.js";
import { FileDiff } from "./FileDiff.js";

export function DiffStream({files}:{files:ChangedFile[]}) {
  const stream = useRef<HTMLDivElement>(null);
  const clickedSelection = useRef(false);
  const [selected,setSelected] = useState(files[0]?.path ?? "");
  const active = files.some(file=>file.path===selected) ? selected : files[0]?.path ?? "";
  function jump(path:string) {
    const container = stream.current;
    const section = Array.from(container?.children ?? []).find(element=>element.getAttribute("data-diff-file")===path);
    if (!container || !section) return;
    clickedSelection.current = true;
    setSelected(path);
    container.scrollTop += section.getBoundingClientRect().top - container.getBoundingClientRect().top;
  }
  function track() {
    const container = stream.current;
    if (!container || clickedSelection.current || container.scrollHeight<=container.clientHeight) return;
    const top = container.getBoundingClientRect().top;
    const section = Array.from(container.children).find(element=>element.getBoundingClientRect().bottom>top+50);
    if(section) setSelected(section.getAttribute("data-diff-file")!);
  }
  const resume = ()=>{clickedSelection.current=false;};
  return <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)] min-[1200px]:grid-cols-[220px_minmax(0,1fr)]">
    <FileNavigation files={files} selected={active} onSelect={jump}/>
    <div ref={stream} role="region" aria-label="All file diffs" tabIndex={0} className="min-h-0 overflow-x-hidden overflow-y-auto bg-(--mantine-color-body)"
      onScroll={track} onWheel={resume} onTouchMove={resume} onPointerDown={resume}
      onKeyDown={event=>{if(["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].includes(event.key)) resume();}}>
      {files.map(file=><FileDiff key={file.path} file={file}/>)}
    </div>
  </div>;
}
