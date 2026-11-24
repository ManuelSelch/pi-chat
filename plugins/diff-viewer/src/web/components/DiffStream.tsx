import { useCallback, useMemo, useRef, useState } from "react";
import { CodeView, WorkerPoolContextProvider, type CodeViewHandle, type CodeViewItem, type CodeViewReactOptions, type CodeViewAnnotationArgs } from "@pierre/diffs/react";
import type { ChangedFile } from "../../contract.js";
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
  const entries = useMemo(()=>files.map(prepareFile),[files]);
  const comments = review?.state.comments;
  const stale = review?.stale;
  const revision = useRef(0);
  const items = useMemo<CodeViewItem<Comment>[]>(()=>{
    const version = ++revision.current;
    return entries.map(({file,diff,placeholder})=>({
      type:"diff",id:file.path,fileDiff:diff,version,
      collapsed:!!placeholder || (collapsed[file.path] ?? file.status==="D"),
      annotations:comments?.filter(comment=>comment.path===file.path && !stale?.some(old=>old.id===comment.id)).map(comment=>({side:comment.side,lineNumber:comment.line,metadata:comment})),
    }));
  },[entries,collapsed,comments,stale]);
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
  const active = files.some(file=>file.path===selected) ? selected : files[0]?.path ?? "";
  return <div className="grid min-h-0 flex-1 grid-cols-[clamp(112px,29vw,180px)_minmax(0,1fr)] min-[1200px]:grid-cols-[220px_minmax(0,1fr)]">
    <FileNavigation files={files} selected={active} onSelect={path=>{clicked.current=true;setSelected(path);viewer.current?.scrollTo({type:"item",id:path,align:"start",behavior:"instant"});}}/>
    <div role="region" aria-label="All file diffs" className="min-h-0 min-w-0 overflow-hidden"
      onWheel={()=>{clicked.current=false;}} onTouchMove={()=>{clicked.current=false;}} onPointerDown={()=>{clicked.current=false;}}
      onKeyDown={event=>{if(["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].includes(event.key)) clicked.current=false;}}>
      <CodeView<Comment> ref={viewer} className="h-full min-h-0 overflow-auto overscroll-contain bg-(--mantine-color-body)" items={items} options={options}
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
      />
    </div>
  </div>;
}
