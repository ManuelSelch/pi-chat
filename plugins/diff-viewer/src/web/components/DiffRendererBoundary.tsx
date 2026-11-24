import { Component, type ReactNode } from "react";
import type { ChangedFile } from "../../contract.js";

/** Preserve all patch text if parsing or the third-party renderer fails. */
export class DiffRendererBoundary extends Component<{files:ChangedFile[];children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError() {return {failed:true};}
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="region" aria-label="All file diffs" className="min-h-0 flex-1 overflow-auto p-3">
      <p role="alert" className="text-xs text-(--mantine-color-dimmed)">The diff renderer failed. Showing complete plain patches; refresh to retry.</p>
      {this.props.files.map(file=><section key={file.path} aria-label={"Diff for "+file.path}>
        <h3 className="py-2 font-mono text-xs wrap-anywhere">{file.path}</h3>
        <pre className="whitespace-pre-wrap font-mono text-xs wrap-anywhere">{file.binary ? "Binary file changed. No text diff available." : file.patch || (file.status==="A" ? "Empty file added." : file.status==="D" ? "Empty file deleted." : "File metadata changed.")}</pre>
      </section>)}
    </div>;
  }
}
