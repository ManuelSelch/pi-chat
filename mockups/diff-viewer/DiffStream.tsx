import { useRef, useState } from "react";
import { DiffContent } from "./DiffContent";
import { FileList } from "./FileList";
import { files } from "./data";

export function DiffStream() {
  const stream = useRef<HTMLDivElement>(null);
  const clickedSelection = useRef(false);
  const [activeFile, setActiveFile] = useState(files[0].path);
  function jumpToFile(path: string) {
    const container = stream.current;
    const section = Array.from(container?.children ?? []).find(element => element.getAttribute("data-file") === path);
    if (!container || !section) return;
    clickedSelection.current = true;
    setActiveFile(path);
    container.scrollTop += section.getBoundingClientRect().top - container.getBoundingClientRect().top;
  }
  function trackFile() {
    const container = stream.current;
    if (!container || clickedSelection.current || container.scrollHeight <= container.clientHeight) return;
    const top = container.getBoundingClientRect().top;
    const section = Array.from(container.children).find(element => element.getBoundingClientRect().bottom > top + 50);
    if (section) setActiveFile(section.getAttribute("data-file")!);
  }
  return <div className="viewer-workspace">
    <div className="file-list-wrapper"><FileList files={files} selected={activeFile} onSelect={jumpToFile}/></div>
    <div ref={stream} className="diff-stream" onScroll={trackFile} onWheel={()=>{clickedSelection.current=false;}} onTouchMove={()=>{clickedSelection.current=false;}} onPointerDown={()=>{clickedSelection.current=false;}} onKeyDown={event=>{if (["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].includes(event.key)) clickedSelection.current=false;}} tabIndex={0} role="region" aria-label="All file diffs">
      {files.map(file=><div key={file.path} data-file={file.path}><DiffContent file={file}/></div>)}
    </div>
  </div>;
}
