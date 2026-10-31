import { useEffect, useId, useRef, useState } from "react";
import { ActionIcon, Badge, Button, Group, SegmentedControl, Text } from "@mantine/core";
import { IconArrowUp, IconCheck, IconChevronDown, IconChevronRight, IconMessageCircle, IconMoon } from "@tabler/icons-react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad:false, securityLevel:"strict", theme:"base", themeVariables:{ background:"#191b20", primaryColor:"#252932", primaryTextColor:"#e4e7ed", primaryBorderColor:"#49505e", lineColor:"#687181", fontFamily:"-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", fontSize:"15px" }, flowchart:{ htmlLabels:false, curve:"basis", nodeSpacing:35, rankSpacing:42 } });

function plan(complete:boolean) {
  return `flowchart TD
    A["✓ Foundations"] --> B["✓ Union types"]
    A --> C["${complete ? "✓" : "●"} Type narrowing"]
    B --> D["${complete ? "●" : "○"} Combine both in practice"]
    C --> D
    D --> E["○ Independent challenge"]
    classDef done fill:#19392e,stroke:#448b6c,color:#c1eed8,rx:10,ry:10
    classDef current fill:#203955,stroke:#6ba8f2,stroke-width:2px,color:#dcecff,rx:10,ry:10
    classDef upcoming fill:#24272e,stroke:#505664,color:#aeb6c4,rx:10,ry:10
    class A,B${complete ? ",C" : ""} done
    class ${complete ? "D" : "C"} current
    class ${complete ? "E" : "D,E"} upcoming`;
}

function MermaidDiagram({ source }: { source:string }) {
  const id=useId().replace(/[^a-zA-Z0-9]/g,"");
  const ref=useRef<HTMLDivElement>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    let disposed=false;
    setError(false);
    void mermaid.render("learning"+id,source).then(({svg})=>{
      if(!disposed && ref.current) ref.current.innerHTML=svg;
    }).catch(()=>{if(!disposed) setError(true);});
    return ()=>{ disposed=true; };
  },[source,id]);
  return error ? <pre>{source}</pre> : <div className="diagram" ref={ref} role="img" aria-label="Learning plan: Foundations splits into Union types and Type narrowing; both lead to combined practice, then an independent challenge." />;
}

function PlanWidget({ complete, graph }: {complete:boolean;graph:boolean}) {
  const [open,setOpen]=useState(true);
  return <section className="plan-widget" aria-label={graph ? "Mermaid plan widget" : "Milestone list widget"}>
    <button className="widget-heading" onClick={()=>setOpen(v=>!v)} aria-expanded={open}>
      {open ? <IconChevronDown size={14}/> : <IconChevronRight size={14}/>}
      <span>learning-plan · {graph ? "Mermaid graph" : "Milestone list"}</span>
      <span className="widget-count">{complete ? 3 : 2}/5</span>
    </button>
    {open && <div className="widget-content">
      {graph ? <MermaidDiagram source={plan(complete)}/> : <div className="milestone-list">
        <div className="list-title">TypeScript fundamentals</div>
        <div className="milestone done-text">✓ Explain basic types</div>
        <div className="milestone done-text">✓ Understand union types</div>
        <div className={complete ? "milestone done-text" : "milestone active-text"}>{complete ? "✓" : "●"} Apply type narrowing {!complete && <span>← current</span>}</div>
        <div className={complete ? "milestone active-text" : "milestone muted-text"}>{complete ? "●" : "○"} Combine both in practice {complete && <span>← current</span>}</div>
        <div className="milestone muted-text">○ Independent challenge</div>
      </div>}
      <div className="widget-summary">{complete ? 3 : 2} of 5 milestones demonstrated</div>
    </div>}
  </section>;
}

function Conversation({complete}:{complete:boolean}) {
  return <main>
    <div className="user-message">Help me understand union types and narrowing, then check that I can use them.</div>
    <article className="assistant-message">
      <div className="speaker"><span className="avatar">π</span><strong>Pi</strong><Text size="xs" c="dimmed">Learning together</Text></div>
      <h1>{complete ? "Ready to bring both ideas together" : "Let’s work on type narrowing"}</h1>
      <p>{complete ? "You explained both union types and narrowing with sound reasoning. Next, we’ll combine them in a different situation." : "You already understand union types. Next, let’s look at how a runtime check narrows a value to a more specific type."}</p>
      <p>Both branches lead into the practice task. Your learning plan stays visible in the widget below while we continue the conversation.</p>
      <div className="example"><code>{'function describe(value: string | number) {'}<br/>{'  if (typeof value === "string") {'}<br/>{'    return value.toUpperCase();'}<br/>{'  }'}<br/>{'  return value.toFixed(2);'}<br/>{'}'}</code></div>
      <p>Why is <code>toUpperCase()</code> safe inside the first branch, but not before the check?</p>
      <Text size="xs" c="dimmed">Illustrative conversation only · no quiz is running</Text>
    </article>
  </main>;
}

export function App() {
  const params=new URLSearchParams(location.search);
  const [complete,setComplete]=useState(params.get("state")==="after");
  const [view,setView]=useState(params.get("view") || "compare");
  return <div className="shell">
    <header><Group gap="xs"><IconMessageCircle size={21}/><strong>Pi Chat</strong><span className="divider"/><Text size="sm">TypeScript · learning session</Text></Group><Badge color="gray" variant="light">Mockup · r2</Badge></header>
    <div className="review-controls">
      <SegmentedControl size="xs" value={view} onChange={setView} data={[{label:"Graph",value:"graph"},{label:"List",value:"list"},{label:"Compare",value:"compare"}]}/>
      <Button size="compact-xs" variant="subtle" leftSection={<IconCheck size={14}/>} onClick={()=>setComplete(v=>!v)}>{complete ? "Reset progress" : "Demonstrate narrowing"}</Button>
    </div>
    <Conversation complete={complete}/>
    <footer>
      <div className={view==="compare" ? "widget-area comparison" : "widget-area"}>
        {view!=="list" && <PlanWidget graph complete={complete}/>}
        {view!=="graph" && <PlanWidget graph={false} complete={complete}/>}
      </div>
      <div className="composer"><Text c="dimmed" size="sm">Ask a question or explain your thinking…</Text><ActionIcon disabled radius="xl" aria-label="Send unavailable in mockup"><IconArrowUp size={18}/></ActionIcon></div>
      <div className="footer-note"><IconMoon size={12}/> {view==="list" ? "Text list: existing widget capability" : view==="graph" ? "Mermaid widget: proposed enhancement" : "Same progress · graph shows dependencies, list uses less space"}</div>
    </footer>
  </div>;
}
