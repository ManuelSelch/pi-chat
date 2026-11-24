import { useEffect, useState } from "react";
import { useDiffData } from "../hooks/use-diff-data.js";
import { useCommitOptions } from "../hooks/use-commit-options.js";
import { ComparisonControls } from "./ComparisonControls.js";
import { DiffViewer } from "./DiffViewer.js";
import { useReview } from "../hooks/use-review.js";
import { ReviewFooter } from "./ReviewFooter.js";

export function DiffViewerContainer() {
  const [wrap,setWrap] = useState(true);
  const data = useDiffData();
  const commits = useCommitOptions(data.revision);
  const {host,context,diff,comparison,preferences,update} = data;
  useEffect(()=>{
    if (preferences.mode!=="branch" || preferences.branch || context.status!=="ready") return;
    const base = context.value.defaultBranch ?? context.value.suggestedBranches[0];
    if (base) update({branch:base});
  },[preferences.mode,preferences.branch,context,update]);
  useEffect(()=>{
    if (preferences.mode!=="commit" || preferences.commit || commits.status!=="ready") return;
    const latest = commits.value.commits[0];
    if (latest) update({commit:latest.sha,commitSubject:latest.subject});
  },[preferences.mode,preferences.commit,commits,update]);
  const available = host.connected && !!host.projectPath;
  const snapshot = available && comparison && diff.status==="ready" ? diff.value : null;
  const review = useReview(snapshot,comparison);
  const message = !host.projectPath ? "Open a project to view its changes." : !host.connected ? "Reconnect to load changes." :
    context.status==="error" ? context.message : !comparison ? `Select a ${data.preferences.mode}.` :
    diff.status==="error" ? diff.message : diff.status==="loading" ? "Loading changes…" : null;
  return <>
    <ComparisonControls wrap={wrap} onToggleWrap={()=>setWrap(current=>!current)} context={context}
      preferences={data.preferences} update={data.update} commits={commits} loading={available && !!comparison && diff.status==="loading"} disabled={!available} onRefresh={data.refresh}/>
    <DiffViewer key={JSON.stringify([host.activeSessionId,host.projectPath,comparison,snapshot?.baseCommit])} wrap={wrap} snapshot={snapshot} review={review} message={message} error={available && (context.status==="error" || (!!comparison && diff.status==="error"))} onRetry={data.refresh}/>
    <ReviewFooter review={review}/>
  </>;
}
