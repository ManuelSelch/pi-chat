import { useCallback, useMemo, useRef, useState } from "react";
import { CodeView, WorkerPoolContextProvider, type CodeViewHandle, type CodeViewItem, type CodeViewReactOptions, type CodeViewAnnotationArgs } from "@pierre/diffs/react";
import type { ChangedFile } from "../../contract.js";
import { Text, TextInput } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { groupFiles } from "../../domain/file-navigation.js";
import { DiffSummary } from "./DiffSummary.js";
import type { ReviewComment as Comment } from "../../domain/review.js";
import type { ReviewActions } from "../hooks/use-review.js";
import { prepareFile } from "../lib/diff-items.js";
import { diffCSS, diffTheme } from "../lib/diff-theme.js";
import { FileNavigation } from "./FileNavigation.js";
import { DiffFileHeader } from "./DiffFileHeader.js";
import { ReviewComment } from "./ReviewComment.js";
import { DiffRendererBoundary } from "./DiffRendererBoundary.js";

const poolOptions = {
  workerFactory:()=>new Worker(new URL("../lib/diff.worker.js",import.meta.url),{type:"module"}),
  poolSize:2, mainThreadMaxCharacters:0,workerInitializationTimeout:2000,totalASTLRUCacheSize:32,
};
const highlighterOptions = {theme:diffTheme};
interface Props {files:ChangedFile[];wrap?:boolean;review?:ReviewActions}
export function DiffStream(props:Props) {
  return <DiffRendererBoundary files={props.files}><WorkerPoolContextProvider poolOptions={poolOptions} highlighterOptions={highlighterOptions}><DiffStreamContent {...props}/></WorkerPoolContextProvider></DiffRendererBoundary>;
}
function DiffStreamContent({files,wrap=true,review}:Props) {
  const viewer = useRef<CodeViewHandle<Comment,undefined>>(null);
  const clicked = useRef(false);
  const [selected,setSelected] = useState(files[0]?.path ?? "");
  const [collapsed,setCollapsed] = useState<Record<string,boolean>>({});
  const [query,setQuery] = useState("");
  const entries = useMemo(()=>groupFiles(files).flatMap(group=>group.files).map(prepareFile),[files]);
  const visibleEntries = useMemo(()=>entries.filter(entry=>entry.file.path.toLowerCase().includes(query.toLowerCase())),[entries,query]);
  const visibleFiles = useMemo(()=>visibleEntries.map(entry=>entry.file),[visibleEntries]);
  const comments = review?.state.comments;
  const stale = review?.stale;
  const revision = useRef(0);
  const items = useMemo<CodeViewItem<Comment>[]>(()=>{
    const version = ++revision.current;
    return visibleEntries.map(({file,diff,placeholder})=>({
      type:"diff",id:file.path,fileDiff:diff,version,
      collapsed:!!placeholder || (collapsed[file.path] ?? file.status==="D"),
      annotations:comments?.filter(comment=>comment.path===file.path && !stale?.some(old=>old.id===comment.id)).map(comment=>({side:comment.side,lineNumber:comment.line,metadata:comment})),
    }));
  },[visibleEntries,collapsed,comments,stale]);
  const canComment = review?.enabled && !review.state.sending;
  const begin = review?.begin;
  const options = useMemo<CodeViewReactOptions<Comment,undefined>>(()=>({
    diffStyle:"unified",theme:diffTheme,themeType:"dark",overflow:wrap ? "wrap" : "scroll",
    tokenizeMaxLength:128_000,tokenizeMaxLineLength:4096,
    enableLineSelection:true,enableGutterUtility:!!canComment,stickyHeaders:true,
    layout:{paddingTop:0,paddingBottom:8,gap:0},itemMetrics:{lineHeight:24},
    ...(canComment ? {onGutterUtilityClick:(range,context)=>begin?.(context.item.id,range.side ?? "additions",range.start)} : {}),
    onPostRender:(node,_instance,_phase,context)=>{node.setAttribute("role","region");node.setAttribute("aria-label","Diff for "+context.item.id);},
    onLineEnter:line=>{(line.lineElement.getRootNode() as ShadowRoot).querySelector("[data-utility-button]")?.setAttribute("aria-label","Add line comment");},
    unsafeCSS:diffCSS,
  }),[wrap,canComment,begin]);
  const complete = useCallback((action:()=>void)=>{action();viewer.current?.clearSelectedLines();},[]);
  const active = visibleFiles.some(file=>file.path===selected) ? selected : visibleFiles[0]?.path ?? "";
  return <>
  <div className="grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)]">
    <aside className="flex min-h-0 w-[205px] min-w-[170px] max-w-[min(420px,55vw)] resize-x flex-col overflow-auto border-r border-(--mantine-color-default-border) bg-(--pi-sidebar-bg) min-[1200px]:w-[270px]">
      <TextInput aria-label="Filter files by path" placeholder="Filter files…" size="xs" leftSection={<IconSearch size={13}/>} value={query} onChange={event=>{clicked.current=false;setQuery(event.currentTarget.value);viewer.current?.scrollTo({type:"position",position:0,behavior:"instant"});}} className="shrink-0 px-2.5 py-2.5"/>
      <FileNavigation files={visibleFiles} selected={active} onSelect={path=>{clicked.current=true;setSelected(path);viewer.current?.scrollTo({type:"item",id:path,align:"start",behavior:"instant"});}}/>
    </aside>
    <div role="region" aria-label="All file diffs" className="min-h-0 min-w-0 overflow-hidden"
      onWheel={()=>{clicked.current=false;}} onTouchMove={()=>{clicked.current=false;}} onPointerDown={()=>{clicked.current=false;}}
      onKeyDown={event=>{if(["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].includes(event.key)) clicked.current=false;}}>
      {!visibleFiles.length ? <Text role="status" size="xs" c="dimmed" className="p-6 text-center">No matching diffs</Text> : <CodeView<Comment> ref={viewer} className="h-full min-h-0 overflow-auto overscroll-contain bg-(--mantine-color-body)" items={items} options={options}
        onScroll={(_top,instance)=>{
          if (clicked.current || instance.getScrollHeight()<=instance.getHeight()) return;
          const anchor = instance.getScrollAnchor(instance.getScrollTop());
          if(anchor) setSelected(anchor.id);
        }}
        renderCustomHeader={item=>{
          const entry=entries.find(entry=>entry.file.path===item.id)!;
          const closed=collapsed[item.id] ?? entry.file.status==="D";
          return <DiffFileHeader entry={entry} collapsed={closed}
            onToggle={()=>setCollapsed(current=>({...current,[item.id]:!closed}))}
            onComment={canComment ? review.begin : undefined}/>;
        }}
        renderAnnotation={(...args:CodeViewAnnotationArgs<Comment>)=>{const annotation=args[0];return review && <ReviewComment comment={annotation.metadata} editor={review.state.editor} disabled={review.state.sending}
          onDraft={review.draft} onSave={()=>complete(review.save)} onCancel={()=>complete(review.cancel)} onEdit={()=>review.edit(annotation.metadata.id)} onDelete={()=>review.remove(annotation.metadata.id)}/>;}}
      />}
    </div>
  </div>
  <DiffSummary files={visibleFiles}/>
  </>;
}
