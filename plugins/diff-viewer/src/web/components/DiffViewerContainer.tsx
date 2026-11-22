import { useDiffData } from "../hooks/use-diff-data.js";
import { useCommitOptions } from "../hooks/use-commit-options.js";
import { ComparisonControls } from "./ComparisonControls.js";
import { DiffViewer } from "./DiffViewer.js";

export function DiffViewerContainer() {
  const data = useDiffData();
  const commits = useCommitOptions(data.revision);
  const {host,context,diff,comparison} = data;
  const available = host.connected && !!host.projectPath;
  const snapshot = available && comparison && diff.status==="ready" ? diff.value : null;
  const message = !host.projectPath ? "Open a project to view its changes." : !host.connected ? "Reconnect to load changes." :
    context.status==="error" ? context.message : !comparison ? `Select a ${data.preferences.mode}.` :
    diff.status==="error" ? diff.message : diff.status==="loading" ? "Loading changes…" : null;
  return <>
    <ComparisonControls branch={context.status==="ready" ? context.value.branch : ""} context={context}
      preferences={data.preferences} update={data.update} commits={commits.page} onQuery={commits.setQuery}
      offset={commits.offset} onNext={commits.next} onPrevious={commits.previous} loading={available && !!comparison && diff.status==="loading"} disabled={!available} onRefresh={data.refresh}/>
    <DiffViewer snapshot={snapshot} message={message} error={available && (context.status==="error" || (!!comparison && diff.status==="error"))} onRetry={data.refresh}/>
  </>;
}
