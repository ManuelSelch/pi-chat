import { useEffect, useState, type RefObject } from "react";
import type { PatchLine } from "../../domain/parse-patch.js";
import type { HighlightSegment } from "../lib/highlight-patch.js";
import type { RequestHighlight } from "../lib/highlight-worker-client.js";

const noTokens:HighlightSegment[][] = [];

export function useHighlightedPatch(section:RefObject<HTMLElement|null>,path:string,lines:PatchLine[],enabled:boolean,request:RequestHighlight) {
  const [visible,setVisible] = useState(false);
  const [result,setResult] = useState<{path:string;lines:PatchLine[];tokens:HighlightSegment[][]}|null>(null);
  useEffect(()=>{
    const element = section.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries=>{
      setVisible(entries.some(entry=>entry.isIntersecting));
    },{root:element.closest('[aria-label="All file diffs"]'),rootMargin:"300px 0px"});
    observer.observe(element);
    return ()=>observer.disconnect();
  },[section]);

  useEffect(()=>{
    if (!enabled || !visible || (result?.path===path && result.lines===lines)) return;
    let current = true;
    const cancel = request(path,lines,tokens=>{
      if (current) setResult({path,lines,tokens});
    });
    return ()=>{current=false;cancel();};
  },[enabled,visible,path,lines,request,result]);
  return result?.path===path && result.lines===lines ? result.tokens : noTokens;
}
