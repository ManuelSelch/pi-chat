import { useCallback, useMemo, useRef, useState } from "react";
import { ActionIcon, Badge, Button, Group, Text, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconGitCompare, IconLayoutSidebarRight, IconMessagePlus, IconRefresh, IconTextWrap } from "@tabler/icons-react";
import { CodeView, type CodeViewHandle, type CodeViewItem } from "@pierre/diffs/react";
import { BaseSelector } from "../diff-base-picker/BaseSelector";
import { ChatWorkspace } from "./ChatWorkspace";
import { CommentCard } from "./CommentCard";
import { files, formatBatch, type Comment } from "./data";
import { diffCSS, diffTheme } from "./theme";

export function ReviewMockup() {
  const [opened,setOpened] = useState(true);
  const [wrap,setWrap] = useState(true);
  const [base,setBase] = useState("branch:refs/heads/main");
  const [active,setActive] = useState(files[0].path);
  const [collapsed,setCollapsed] = useState<string[]>(files.filter(file=>!file.after).map(file=>file.path));
  const [comments,setComments] = useState<Comment[]>(new URLSearchParams(location.search).get("state")==="comments" ? [{id:"seed",path:files[0].path,side:"additions",line:11,body:"Can we include the selected comparison in this message too?"}] : []);
  const [editing,setEditing] = useState<string | null>(null);
  const [batches,setBatches] = useState<string[]>([]);
  const viewer = useRef<CodeViewHandle<Comment>>(null);
  const begin = useCallback((path:string,side:Comment["side"],line:number)=>{
    const existing = comments.find(comment=>comment.path===path && comment.side===side && comment.line===line);
    if (existing) { setEditing(existing.id);return; }
    const comment = {id:crypto.randomUUID(),path,side,line,body:""};
    setEditing(comment.id);
    setComments(current=>[...current,comment]);
  },[comments]);
  const itemRevision = useRef(0);
  const items = useMemo<CodeViewItem<Comment>[]>(()=>{
    const version = ++itemRevision.current;
    return files.map(file=>({
      id:file.path,type:"diff",fileDiff:file.diff,version,
      collapsed:collapsed.includes(file.path),
      annotations:comments.filter(comment=>comment.path===file.path).map(comment=>({side:comment.side,lineNumber:comment.line,metadata:comment})),
    }));
  },[comments,collapsed]);
  const options = useMemo(()=>({
    diffStyle:"unified" as const, theme:diffTheme,themeType:"dark" as const,
    overflow:wrap ? "wrap" as const : "scroll" as const,
    enableLineSelection:true,enableGutterUtility:true,stickyHeaders:true,
    onGutterUtilityClick: (range: {start:number;end:number;side?:Comment["side"]}, context: {item:CodeViewItem<Comment>}) => begin(context.item.id,range.side ?? "additions",range.start),
    unsafeCSS:diffCSS,
  }),[wrap,begin]);
  const pending = comments.filter(comment=>comment.body.trim());
  function cancel(comment:Comment) {
    if(!comment.body) setComments(current=>current.filter(item=>item.id!==comment.id));
    setEditing(null);
  }
  function send() {
    if(!pending.length || editing) return;
    setBatches(current=>[...current,formatBatch(pending)]);
    setComments([]);
  }
  return <>
    <header className="shell-header"><Text size="sm">pi-chat</Text><Text size="xs" c="dimmed">feature/diffs-spike</Text>
      <div className="shell-actions"><Badge size="xs" variant="outline" color="gray">Mockup</Badge><ActionIcon aria-label="Toggle side panel" aria-expanded={opened} color="gray" variant={opened ? "light" : "subtle"} onClick={()=>setOpened(current=>!current)}><IconLayoutSidebarRight size={19}/></ActionIcon></div>
    </header>
    <div className="parallel-workspace" data-panel-open={opened}>
      <ChatWorkspace batches={batches}/>
      {opened && <aside className="viewer" aria-label="Changes">
        <div className="review-panel-heading"><IconGitCompare size={16}/><Text size="xs">Changes</Text></div>
        <div className="viewer-toolbar"><BaseSelector base={base} onChange={setBase}/><div className="diff-actions">
          <ActionIcon color="gray" variant={wrap ? "light" : "subtle"} aria-label="Wrap lines" aria-pressed={wrap} onClick={()=>setWrap(current=>!current)}><IconTextWrap size={17}/></ActionIcon>
          <ActionIcon color="gray" variant="subtle" aria-label="Refresh preview" onClick={()=>viewer.current?.scrollTo({type:"position",position:0})}><IconRefresh size={17}/></ActionIcon>
        </div></div>
        <div className="review-workspace">
          <nav className="file-list-wrapper" aria-label="Changed files"><div className="file-list"><div className="list-heading">Files <span>{files.length}</span></div>
            {files.map(file=><UnstyledButton key={file.path} className="file-item" data-selected={active===file.path} aria-label={file.path} onClick={()=>{setActive(file.path);viewer.current?.scrollTo({type:"item",id:file.path,align:"start"});}}>
              <span className="file-name">{file.path.split("/").at(-1)}</span><span className={!file.after ? "removed" : "added"}>{!file.after ? "D" : "M"}</span>
            </UnstyledButton>)}
          </div></nav>
          <CodeView<Comment> ref={viewer} className="pierre-view" items={items} options={options}
            renderCustomHeader={item=><div className="review-file-heading">
              <UnstyledButton className="review-file-toggle" aria-expanded={!collapsed.includes(item.id)} onClick={()=>setCollapsed(current=>current.includes(item.id) ? current.filter(path=>path!==item.id) : [...current,item.id])}>
                {collapsed.includes(item.id) ? <IconChevronRight size={14}/> : <IconChevronDown size={14}/>}<span>{item.id}</span>
              </UnstyledButton>
              <ActionIcon variant="subtle" color="gray" size="sm" aria-label={"Comment on "+item.id} onClick={()=>{setCollapsed(current=>current.filter(path=>path!==item.id));begin(item.id,files.find(file=>file.path===item.id)?.after ? "additions" : "deletions",1);}}><IconMessagePlus size={15}/></ActionIcon>
            </div>}
            renderAnnotation={annotation=><CommentCard key={annotation.metadata.id+String(editing===annotation.metadata.id)} comment={annotation.metadata} editing={editing===annotation.metadata.id}
              onSave={body=>{setComments(current=>current.map(comment=>comment.id===annotation.metadata.id ? {...comment,body} : comment));setEditing(null);}}
              onCancel={()=>cancel(annotation.metadata)} onEdit={()=>setEditing(annotation.metadata.id)}
              onDelete={()=>{setComments(current=>current.filter(comment=>comment.id!==annotation.metadata.id));setEditing(null);}}/>}
          />
        </div>
        <footer className="review-footer"><Text size="xs" c="dimmed">{pending.length ? pending.length+" draft comment"+(pending.length===1 ? "" : "s") : files.length+" files changed"}</Text><Button size="xs" variant="light" color="gray" disabled={!pending.length || !!editing} onClick={send}>Send{pending.length ? " "+pending.length : ""} comment{pending.length===1 ? "" : "s"}</Button></footer>
      </aside>}
    </div>
  </>;
}
