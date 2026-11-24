import { useState } from "react";
import { UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconChevronRight, IconFolder, IconFileCode, IconFileText, IconTestPipe, IconSettings } from "@tabler/icons-react";
import type { ReviewFile } from "./data";
export type Variant = "folders" | "kinds" | "areas";
type Node = {name:string;path:string;children:Node[];file?:ReviewFile};
function buildTree(files:ReviewFile[]):Node[] {
  const root:Node = {name:"",path:"",children:[]};
  for (const file of files) {
    let parent = root;
    const parts = file.path.split("/");
    parts.forEach((name,index)=>{
      const path = parts.slice(0,index+1).join("/");
      let node = parent.children.find(child=>child.path===path);
      if (!node) { node = {name,path,children:[]}; parent.children.push(node); }
      if (index===parts.length-1) node.file=file;
      parent=node;
    });
  }
  function compact(nodes:Node[]):Node[] {
    return nodes.map(original=>{
      let node = {...original};
      while (!node.file && node.children.length===1 && !node.children[0].file) {
        const child = node.children[0];
        node = {...child,name:node.name+"/"+child.name};
      }
      return {...node,children:compact(node.children)};
    }).sort((a,b)=>Number(!!a.file)-Number(!!b.file)||a.name.localeCompare(b.name));
  }
  return compact(root.children);
}
export function folderOrder(files:ReviewFile[]):ReviewFile[] {
  const flatten=(nodes:Node[]):ReviewFile[]=>nodes.flatMap(node=>node.file ? [node.file] : flatten(node.children));
  return flatten(buildTree(files));
}
function count(node:Node):number { return node.file ? 1 : node.children.reduce((sum,child)=>sum+count(child),0); }
function FileRow({file,selected,onSelect,depth=0,showPath=false}:{file:ReviewFile;selected:string;onSelect(path:string):void;depth?:number;showPath?:boolean}) {
  const Icon = file.kind==="Tests" ? IconTestPipe : file.kind==="Docs" ? IconFileText : file.kind==="Config" ? IconSettings : IconFileCode;
  return <UnstyledButton className="explorer-file" style={{paddingLeft:10+depth*14}} data-active={selected===file.path} aria-label={file.path} aria-pressed={selected===file.path} onClick={()=>onSelect(file.path)}>
    <Icon size={14}/><span className="explorer-label"><span>{file.path.split("/").at(-1)}</span>{showPath && <small>{file.path.substring(0,file.path.lastIndexOf("/")) || "/"}</small>}</span><span className={"status status-"+file.status}>{file.status}</span>
  </UnstyledButton>;
}
function FolderNode({node,depth,selected,onSelect,scope,closed,toggle}:{node:Node;depth:number;selected:string;onSelect(path:string):void;scope:string;closed:Set<string>;toggle(path:string):void}) {
  if (node.file) return <FileRow file={node.file} depth={depth} selected={selected} onSelect={onSelect}/>;
  const id=scope+node.path;
  const open=!closed.has(id);
  return <div><UnstyledButton className="folder-row" style={{paddingLeft:8+depth*14}} aria-expanded={open} onClick={()=>toggle(id)}>{open ? <IconChevronDown size={12}/> : <IconChevronRight size={12}/>}<IconFolder size={14}/><span>{node.name}</span><small>{count(node)}</small></UnstyledButton>{open && node.children.map(child=><FolderNode key={child.path} node={child} depth={depth+1} selected={selected} onSelect={onSelect} scope={scope} closed={closed} toggle={toggle}/>)}</div>;
}
export function FileExplorer({files,variant,selected,onSelect,collapseEpoch}:{files:ReviewFile[];variant:Variant;selected:string;onSelect(path:string):void;collapseEpoch:number}) {
  const [closed,setClosed]=useState(new Set<string>());
  const [lastEpoch,setLastEpoch]=useState(collapseEpoch);
  if (lastEpoch!==collapseEpoch) { setLastEpoch(collapseEpoch); setClosed(new Set()); }
  const toggle=(id:string)=>setClosed(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
  const groups = variant==="folders" ? [{name:"",files}] : (variant==="kinds" ? ["Source","Tests","Docs","Config"] : ["Checkout","Shared styles","Project config"]).map(name=>({name,files:files.filter(file=>(variant==="kinds" ? file.kind : file.area)===name)})).filter(group=>group.files.length);
  return <nav aria-label="Changed files" className="explorer-scroll">{!files.length && <p className="no-matches">No matching files</p>}{groups.map(group=><section className="explorer-group" key={group.name}>{group.name && <UnstyledButton className="group-title" aria-expanded={!closed.has(group.name)} onClick={()=>toggle(group.name)}>{closed.has(group.name) ? <IconChevronRight size={12}/> : <IconChevronDown size={12}/>}<strong>{group.name}</strong><small>{group.files.length}</small></UnstyledButton>}{!closed.has(group.name) && (variant==="areas" ? group.files.map(file=><FileRow key={file.path} file={file} selected={selected} onSelect={onSelect} showPath/>) : buildTree(group.files).map(node=><FolderNode key={node.path} node={node} depth={0} scope={group.name} selected={selected} onSelect={onSelect} closed={closed} toggle={toggle}/>))}</section>)}</nav>;
}
