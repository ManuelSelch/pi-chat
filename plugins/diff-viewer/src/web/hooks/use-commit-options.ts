import { useCallback, useEffect, useState } from "react";
import { diffViewerContract } from "../../contract.js";
import { useDiffViewer } from "../stores/DiffViewerProvider.js";
import { useRemoteQuery } from "./use-remote-query.js";

export function useCommitOptions(revision: number) {
  const {host,preferences} = useDiffViewer();
  const {request,connected,projectPath} = host;
  const [query,setQuery] = useState("");
  const [search,setSearch] = useState("");
  const [offset,setOffset] = useState(0);
  useEffect(()=>{
    const timeout = setTimeout(()=>{setSearch(query);setOffset(0);},200);
    return ()=>clearTimeout(timeout);
  },[query]);
  const key = JSON.stringify([projectPath,connected,search,offset,revision]);
  const load = useCallback(async(signal:AbortSignal)=>{
    const result = await request(client=>client.plugin(diffViewerContract).commits({projectPath:projectPath!,query:search,offset},{signal}));
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  },[request,projectPath,search,offset]);
  const page = useRemoteQuery(key,connected && !!projectPath && preferences.mode==="commit",load);
  return {query,setQuery,page,offset,previous:()=>setOffset(value=>Math.max(0,value-50)),next:()=>{if(page.status==="ready" && page.value.nextOffset!==null) setOffset(page.value.nextOffset);}};
}
