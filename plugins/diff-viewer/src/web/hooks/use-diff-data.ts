import { useCallback, useMemo, useState } from "react";
import { diffViewerContract, type Comparison } from "../../contract.js";
import { useDiffViewer } from "../stores/DiffViewerProvider.js";
import { useRemoteQuery } from "./use-remote-query.js";

export function useDiffData() {
  const {host,preferences,update} = useDiffViewer();
  const {request,connected,projectPath} = host;
  const [revision,setRevision] = useState(0);
  const comparison = useMemo<Comparison | null>(()=>preferences.mode==="uncommitted" ? {kind:"uncommitted"} :
    preferences.mode==="branch" ? preferences.branch ? {kind:"branch",ref:preferences.branch} : null :
    preferences.commit ? {kind:"commit",sha:preferences.commit} : null,[preferences]);
  const enabled = connected && !!projectPath;
  const key = JSON.stringify([projectPath,connected,revision]);
  const loadContext = useCallback(async(signal:AbortSignal)=>{
    const result = await request(client=>client.plugin(diffViewerContract).context({projectPath:projectPath!},{signal}));
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  },[request,projectPath]);
  const loadDiff = useCallback(async(signal:AbortSignal)=>{
    const result = await request(client=>client.plugin(diffViewerContract).diff({projectPath:projectPath!,comparison:comparison!},{signal}));
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  },[request,projectPath,comparison]);
  const context = useRemoteQuery(key,enabled,loadContext);
  const diff = useRemoteQuery(key+JSON.stringify(comparison),enabled && comparison!==null,loadDiff);
  return {host,preferences,update,comparison,context,diff,revision,refresh:()=>setRevision(value=>value+1)};
}
