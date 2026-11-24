import { useCallback } from "react";
import { diffViewerContract } from "../../contract.js";
import { useDiffViewer } from "../stores/DiffViewerProvider.js";
import { useRemoteQuery } from "./use-remote-query.js";

export function useCommitOptions(revision: number) {
  const {host,preferences} = useDiffViewer();
  const {request,connected,projectPath} = host;
  const key = JSON.stringify([projectPath,connected,revision]);
  const load = useCallback(async(signal:AbortSignal)=>{
    const result = await request(client=>client.plugin(diffViewerContract).commits({projectPath:projectPath!},{signal}));
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  },[request,projectPath]);
  return useRemoteQuery(key,connected && !!projectPath && preferences.mode==="commit",load);
}
