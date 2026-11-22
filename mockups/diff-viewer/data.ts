export type DiffLine = { kind: "context" | "add" | "remove"; text: string; old?: number; next?: number };
export type ChangedFile = { path: string; status: "M" | "A" | "D"; added: number; removed: number; hunk: string; lines: DiffLine[]; binary?: boolean };
export const files: ChangedFile[] = [
  { path: "src/web/app/plugins/RegisteredPlugins.tsx", status: "M", added: 2, removed: 1, hunk: "@@ -1,8 +1,9 @@", lines: [
    {kind:"context",old:1,next:1,text:'import { folderOpeningPlugin } from "@manuelselch/pi-plugin-folder-opening";'},
    {kind:"add",next:2,text:'import { diffViewerPlugin } from "@manuelselch/pi-plugin-diff-viewer";'},
    {kind:"context",old:2,next:3,text:'import { chimesPlugin } from "@manuelselch/pi-plugin-chimes";'},
    {kind:"context",old:3,next:4,text:""},
    {kind:"context",old:4,next:5,text:"export const plugins = ["},
    {kind:"remove",old:5,text:"  folderOpeningPlugin, chimesPlugin,"},
    {kind:"add",next:6,text:"  folderOpeningPlugin, chimesPlugin, diffViewerPlugin,"},
    {kind:"context",old:6,next:7,text:"];"},
    {kind:"context",old:7,next:8,text:""},
    {kind:"context",old:8,next:9,text:"// Browser entries load before the first render."},
  ] },
  { path:"plugins/diff-viewer/README.md", status:"A", added:6, removed:0, hunk:"@@ -0,0 +1,6 @@", lines:[
    "# Diff viewer plugin", "", "- Read-only project changes against HEAD.", "- Unified and split views.", "- Plugin-owned Git access and UI.", "- No staging, reverting or editing.",
  ].map((text,index)=>({kind:"add" as const,next:index+1,text})) },
  { path:"src/web/legacy-diff.ts",status:"D",added:0,removed:3,hunk:"@@ -1,3 +0,0 @@",lines:[
    "export function openDiff() {", '  throw new Error("Not implemented");', "}",
  ].map((text,index)=>({kind:"remove" as const,old:index+1,text})) },
  { path:"docs/images/changes.png",status:"M",added:0,removed:0,hunk:"",lines:[],binary:true },
];
