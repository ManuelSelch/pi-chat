import { highlightPatch } from "./highlight-patch.js";
import type { HighlightMessage, HighlightReply } from "./highlight-worker-client.js";

const scope = globalThis as unknown as {
  onmessage:(event:MessageEvent<HighlightMessage>)=>void;
  postMessage(message:HighlightReply):void;
};
scope.onmessage = ({data})=>{
  let tokens:HighlightReply["tokens"] = [];
  try {
    tokens = highlightPatch(data.path,data.lines);
    // Bound the number of additional React nodes even for token-dense short files.
    if (tokens.reduce((sum,line)=>sum+line.length,0)>10_000) tokens = [];
  } catch {
    // Worker failures must never prevent the plain diff from rendering.
  }
  scope.postMessage({id:data.id,tokens});
};
