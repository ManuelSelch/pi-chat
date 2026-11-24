import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { groupFiles } from "../../domain/file-navigation.js";
import { DiffSummary } from "./DiffSummary.js";
import type { ChangedFile } from "../../contract.js";
import { FileNavigation } from "./FileNavigation.js";
import { FileDiff } from "./FileDiff.js";
import { HighlightWorkerClient } from "../lib/highlight-worker-client.js";

export function DiffStream({files,wrap=true}:{files:ChangedFile[];wrap?:boolean}) {
  const [query,setQuery] = useState("");
  const visibleFiles = useMemo(()=>groupFiles(files.filter(file=>file.path.toLowerCase().includes(query.toLowerCase()))).flatMap(group=>group.files),[files,query]);
  const stream = useRef<HTMLDivElement>(null);
  const [highlighter] = useState(()=>new HighlightWorkerClient());
  useEffect(()=>()=>highlighter.dispose(),[highlighter]);
  const clickedSelection = useRef(false);
  const positions = useRef<{path:string;bottom:number}[]>([]);
  useLayoutEffect(()=>{
    const container = stream.current;
    if (!container) return;
    const sections = Array.from(container.querySelectorAll<HTMLElement>("[data-diff-file]"));
    const measure = ()=>{
      positions.current = sections.map(section=>({path:section.dataset.diffFile!,bottom:section.offsetTop+section.offsetHeight}));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    sections.forEach(section=>observer.observe(section));
    return ()=>observer.disconnect();
  },[visibleFiles]);
  const [selected,setSelected] = useState(visibleFiles[0]?.path ?? "");
  const active = visibleFiles.some(file=>file.path===selected) ? selected : visibleFiles[0]?.path ?? "";
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
  return <>
  <div className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)]">
    <aside className="flex min-h-0 w-[205px] min-w-[170px] max-w-[min(420px,55vw)] resize-x flex-col overflow-auto border-r border-(--mantine-color-default-border) bg-(--pi-sidebar-bg) min-[1200px]:w-[270px]">
      <TextInput aria-label="Filter files by path" placeholder="Filter files…" size="xs" leftSection={<IconSearch size={13}/>} value={query} onChange={event=>{clickedSelection.current=false;setQuery(event.currentTarget.value);if(stream.current)stream.current.scrollTop=0;}} className="shrink-0 px-2.5 py-2.5"/>
      <FileNavigation files={visibleFiles} selected={active} onSelect={jump}/>
    </aside>
    <div ref={stream} role="region" aria-label="All file diffs" tabIndex={0} className="relative min-h-0 overflow-x-hidden overflow-y-auto overscroll-contain bg-(--mantine-color-body)"
      onScroll={track} onWheel={resume} onTouchMove={resume} onPointerDown={resume}
      onKeyDown={event=>{if(["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].includes(event.key)) resume();}}>
      {visibleFiles.map(file=><FileDiff key={file.path} file={file} wrap={wrap} onHighlight={highlighter.request}/>)}
      {!visibleFiles.length && <Text role="status" size="xs" c="dimmed" className="p-6 text-center">No matching diffs</Text>}
    </div>
  </div>
  <DiffSummary files={visibleFiles}/>
  </>;
}
