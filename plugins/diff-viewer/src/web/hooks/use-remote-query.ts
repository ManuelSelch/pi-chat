import { useEffect, useState } from "react";

export type QueryState<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; value: T };

/** Keys guard render-time project/base changes; cleanup cancels waits and ignores late replies. */
export function useRemoteQuery<T>(key: string, enabled: boolean, load: (signal: AbortSignal) => Promise<T>): QueryState<T> {
  const [state,setState] = useState<{key:string;result:QueryState<T>}>({key:"",result:{status:"loading"}});
  useEffect(()=>{
    if (!enabled) return;
    const controller = new AbortController();
    setState({key,result:{status:"loading"}});
    void load(controller.signal).then(
      value=>{if(!controller.signal.aborted) setState({key,result:{status:"ready",value}});},
      error=>{if(!controller.signal.aborted) setState({key,result:{status:"error",message:error instanceof Error ? error.message : "Unable to load changes."}});},
    );
    return ()=>controller.abort();
  },[key,enabled,load]);
  return state.key === key ? state.result : {status:"loading"};
}
