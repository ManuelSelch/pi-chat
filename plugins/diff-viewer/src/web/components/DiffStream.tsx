import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ChangedFile } from "../../contract.js";
import { FileNavigation } from "./FileNavigation.js";
import { FileDiff } from "./FileDiff.js";
import { HighlightWorkerClient } from "../lib/highlight-worker-client.js";

export function DiffStream({files,wrap=true}:{files:ChangedFile[];wrap?:boolean}) {
  const stream = useRef<HTMLDivElement>(null);
  const [highlighter] = useState(()=>new HighlightWorkerClient());
  useEffect(()=>()=>highlighter.dispose(),[highlighter]);
  const clickedSelection = useRef(false);
  const positions = useRef<{path:string;bottom:number}[]>([]);
  useLayoutEffect(()=>{
    const container = stream.current;
    if (!container) return;
    const sections = Array.from(container.children) as HTMLElement[];
    const measure = ()=>{
      positions.current = sections.map(section=>({path:section.dataset.diffFile!,bottom:section.offsetTop+section.offsetHeight}));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    sections.forEach(section=>observer.observe(section));
    return ()=>observer.disconnect();
  },[files]);
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
    const top = container.scrollTop+50;
    const cached = positions.current;
    let low = 0;
    let high = cached.length;
    while (low<high) {
      const middle = (low+high)>>>1;
      if (cached[middle]!.bottom<=top) low = middle+1;
      else high = middle;
    }
    const path = cached[low]?.path;
    if (path) setSelected(current=>current===path ? current : path);
  }
  const resume = ()=>{clickedSelection.current=false;};
  return <div className="grid min-h-0 flex-1 grid-cols-[clamp(112px,29vw,180px)_minmax(0,1fr)] min-[1200px]:grid-cols-[220px_minmax(0,1fr)]">
    <FileNavigation files={files} selected={active} onSelect={jump}/>
    <div ref={stream} role="region" aria-label="All file diffs" tabIndex={0} className="relative min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-(--mantine-color-body)"
      onScroll={track} onWheel={resume} onTouchMove={resume} onPointerDown={resume}
      onKeyDown={event=>{if(["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].includes(event.key)) resume();}}>
      {files.map(file=><FileDiff key={file.path} file={file} wrap={wrap} onHighlight={highlighter.request}/>)}
    </div>
  </div>;
}
