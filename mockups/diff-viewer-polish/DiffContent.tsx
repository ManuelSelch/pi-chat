import { IconPhoto } from "@tabler/icons-react";
import type { ChangedFile, DiffLine } from "./data";

function CodeLine({line}:{line:DiffLine}) {
  return <div className={"code-line "+line.kind}>
    <span className="line-number">{line.old}</span>
    <span className="line-number">{line.next}</span>
    <span className="line-sign">{line.kind==="add"?"+":line.kind==="remove"?"−":" "}</span>
    <code>{line.text || " "}</code>
  </div>;
}
export function DiffContent({file}:{file:ChangedFile}) {
  return <section className="diff-content" aria-label={"Diff for "+file.path}>
    <div className="file-heading"><span>{file.path}</span><span className="counts"><span className="added">+{file.added}</span><span className="removed">−{file.removed}</span></span></div>
    {file.binary ? <div className="empty"><IconPhoto size={26}/><strong>Binary file changed</strong><span>No text diff available.</span></div> :
    <div className="diff-scroll">
      <div className="diff-lines"><div className="hunk">{file.hunk}</div>{file.lines.map((line,i)=><CodeLine key={i} line={line}/>)}</div>
    </div>}
  </section>;
}
