import { useCallback, useMemo, useRef } from "react";
import type { Comparison, DiffSnapshot } from "../../contract.js";
import { createReviewComment, formatReview, isCommentStale, reviewScope, type ReviewComment } from "../../domain/review.js";
import { useDiffViewer } from "../stores/DiffViewerProvider.js";
import { emptyReview } from "../stores/review-state.js";
import { sendReview } from "../lib/send-review.js";

export function useReview(snapshot:DiffSnapshot|null,comparison:Comparison|null) {
  const {host,reviews,updateReview} = useDiffViewer();
  const sessionId = host.activeSessionId;
  const scope = sessionId && host.projectPath && comparison ? reviewScope(sessionId,host.projectPath,comparison) : "";
  const state = reviews[scope] ?? emptyReview;
  const stale = useMemo(()=>snapshot ? state.comments.filter(comment=>isCommentStale(comment,snapshot)) : [],[snapshot,state.comments]);
  const locked = useRef(new Set<string>());
  const idle = host.sessions.find(session=>session.sessionId===sessionId)?.status==="idle";
  const canSend = !!scope && host.connected && idle && !!snapshot && !!state.comments.length && !stale.length && !state.editor && !state.sending;
  const change = (update:(current:typeof state)=>typeof state)=>{if (scope) updateReview(scope,current=>current.sending ? current : update(current));};
  const begin = useCallback((path:string,side:ReviewComment["side"],line:number)=>{
    if (!snapshot || !scope || state.sending) return;
    const existing = state.comments.find(comment=>comment.path===path && comment.side===side && comment.line===line);
    const comment = existing ?? createReviewComment(crypto.randomUUID(),snapshot,path,side,line);
    updateReview(scope,current=>current.sending ? current : ({...current,comments:existing ? current.comments : [...current.comments.filter(comment=>comment.body),comment],editor:{id:comment.id,body:comment.body},error:null}));
  },[snapshot,scope,state.sending,state.comments,updateReview]);
  function cancel() {
    change(current=>({...current,comments:current.comments.filter(comment=>comment.id!==current.editor?.id || !!comment.body),editor:null}));
  }
  async function send() {
    if (!canSend || !sessionId || !comparison || locked.current.has(scope)) return;
    locked.current.add(scope);
    const batch = state.comments;
    const ids = new Set(batch.map(comment=>comment.id));
    updateReview(scope,current=>({...current,sending:true,error:null}));
    try {
      await host.request(client=>sendReview(client,sessionId,formatReview(batch,comparison)));
      updateReview(scope,current=>({...current,sending:false,comments:current.comments.filter(comment=>!ids.has(comment.id))}));
    } catch(error) {
      updateReview(scope,current=>({...current,sending:false,error:error instanceof Error ? error.message : String(error)}));
    } finally { locked.current.delete(scope); }
  }
  return {state,stale,canSend,enabled:!!scope,waitingForIdle:!idle,begin,cancel,send,
    edit:(id:string)=>{const comment=state.comments.find(comment=>comment.id===id);if(comment) change(current=>({...current,editor:{id,body:comment.body}}));},
    draft:(body:string)=>change(current=>({...current,editor:current.editor ? {...current.editor,body} : null})),
    save:()=>change(current=>{
      if (!current.editor?.body.trim()) return current;
      return {...current,comments:current.comments.map(comment=>comment.id===current.editor!.id ? {...comment,body:current.editor!.body.trim()} : comment),editor:null};
    }),
    remove:(id:string)=>change(current=>({...current,comments:current.comments.filter(comment=>comment.id!==id),editor:current.editor?.id===id ? null : current.editor,error:null})),
  };
}
export type ReviewActions = ReturnType<typeof useReview>;
