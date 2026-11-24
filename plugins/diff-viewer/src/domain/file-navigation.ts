import type { ChangedFile } from "../contract.js";

export type FileKind = "Source" | "Tests" | "Docs" | "Config";
export type FileNode = { type:"file"; path:string; name:string; file:ChangedFile };
export type FolderNode = { type:"folder"; path:string; name:string; children:NavigationNode[]; count:number };
export type NavigationNode = FileNode | FolderNode;
export interface FileGroup { kind:FileKind; files:ChangedFile[]; nodes:NavigationNode[] }
const kinds:FileKind[] = ["Source","Tests","Docs","Config"];

export function fileKind(path:string):FileKind {
  const lower = path.toLowerCase();
  const name = lower.split("/").at(-1)!;
  if (/(^|\/)(__tests__|__test__|tests?|testing|e2e|specs?)(\/|$)/.test(lower) || /[.-](test|spec)\.[^.]+$/.test(name)) return "Tests";
  if (/(^|\/)(docs?|documentation)(\/|$)/.test(lower) || /\.(md|mdx|rst|adoc)$/.test(name) || /^(readme|changelog|license|contributing)(\.|$)/.test(name)) return "Docs";
  if (/(^|\/)(\.github|\.gitlab|config)(\/|$)/.test(lower) || /(^|[.-])config([.-]|$)/.test(name) || /^(tsconfig|jsconfig)(\.|$)/.test(name) || /\.(json|jsonc|ya?ml|toml|ini|lock)$/.test(name) || /^(\.[^.]+|\.env.*|dockerfile.*|makefile|yarn\.lock|bun\.lockb)$/.test(name)) return "Config";
  return "Source";
}

function buildTree(files:ChangedFile[]):NavigationNode[] {
  const root:FolderNode = {type:"folder",path:"",name:"",children:[],count:files.length};
  for (const file of files) {
    let parent = root;
    const parts = file.path.split("/");
    parts.slice(0,-1).forEach((name,index)=>{
      const path = parts.slice(0,index+1).join("/");
      let folder = parent.children.find((node):node is FolderNode=>node.type==="folder" && node.path===path);
      if (!folder) { folder={type:"folder",name,path,children:[],count:0}; parent.children.push(folder); }
      folder.count++;
      parent=folder;
    });
    parent.children.push({type:"file",name:parts.at(-1)!,path:file.path,file});
  }
  function compact(nodes:NavigationNode[]):NavigationNode[] {
    return nodes.map(node=>{
      if (node.type==="file") return node;
      let folder = node;
      while (folder.children.length===1 && folder.children[0]!.type==="folder") {
        const child = folder.children[0] as FolderNode;
        folder = {...child,name:folder.name+"/"+child.name};
      }
      return {...folder,children:compact(folder.children)};
    }).sort((a,b)=>Number(a.type==="file")-Number(b.type==="file")||a.name.localeCompare(b.name));
  }
  return compact(root.children);
}

export function navigationFiles(nodes:NavigationNode[]):ChangedFile[] {
  return nodes.flatMap(node=>node.type==="file" ? [node.file] : navigationFiles(node.children));
}

export function groupFiles(files:ChangedFile[]):FileGroup[] {
  return kinds.flatMap(kind=>{
    const matching = files.filter(file=>fileKind(file.path)===kind);
    if (!matching.length) return [];
    const nodes = buildTree(matching);
    return [{kind,nodes,files:navigationFiles(nodes)}];
  });
}
