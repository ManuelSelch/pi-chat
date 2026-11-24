import { useRef, useState } from "react";
import { ActionIcon, Badge, Button, SegmentedControl, TextInput } from "@mantine/core";
import { IconArrowsDiagonal, IconArrowsSort, IconChevronDown, IconGitBranch, IconLayoutSidebar, IconSearch, IconRefresh, IconTextWrap } from "@tabler/icons-react";
import { DiffContent } from "../diff-viewer-polish/DiffContent";
import { FileExplorer, folderOrder, type Variant } from "./FileExplorer";
import { files } from "./data";
const descriptions:Record<Variant,string>={folders:"Repository structure. Colocated source and tests stay together.",kinds:"Review source, tests and documentation separately, with paths inside each group.",areas:"Feature changes together, including tests and docs outside the feature folder."};
export function NavigationMockup() {
  const initial = new URLSearchParams(location.search).get("view");
  const [variant,setVariant]=useState<Variant>(initial==="kinds" || initial==="areas" ? initial : "folders");
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState(files[0].path);
  const [epoch,setEpoch]=useState(0);
  const [wrap,setWrap]=useState(true);
  const [wide,setWide]=useState(false);
  const [navOpen,setNavOpen]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const stream=useRef<HTMLDivElement>(null);
  const shown=files.filter(file=>file.path.toLowerCase().includes(query.toLowerCase()));
  const ordered=variant==="kinds" ? ["Source","Tests","Docs","Config"].flatMap(kind=>folderOrder(shown.filter(file=>file.kind===kind))) : variant==="areas" ? ["Checkout","Shared styles","Project config"].flatMap(area=>shown.filter(file=>file.area===area)) : folderOrder(shown);
  function choose(value:string) {setVariant(value as Variant);setQuery("");setEpoch(v=>v+1);const url=new URL(location.href);url.searchParams.set("view",value);history.replaceState(null,"",url);}
  function jump(path:string) {setSelected(path);const container=stream.current;const target=Array.from(container?.children??[]).find(child=>child.getAttribute("data-file")===path) as HTMLElement|undefined;if(container && target)container.scrollTop=target.offsetTop-container.offsetTop;}
  return <div className="navigation-study">
    <header className="study-toolbar"><span className="study-title">File navigation</span><SegmentedControl size="xs" value={variant} onChange={choose} data={[{value:"folders",label:"A  Folders"},{value:"kinds",label:"B  File kinds"},{value:"areas",label:"C  Feature areas"}]}/><Badge variant="outline" color="gray" size="sm">Mockup</Badge><Button variant="subtle" color="gray" size="xs" leftSection={<IconArrowsDiagonal size={14}/>} onClick={()=>setWide(!wide)}>{wide ? "Side panel" : "Expand viewer"}</Button></header>
    <div className="study-caption">{descriptions[variant]}</div>
    <header className="product-header"><b>pi</b><span>shop-web</span><span className="project-branch"><IconGitBranch size={13}/> feature/checkout</span><IconLayoutSidebar size={17}/></header>
    <main className="study-workspace" data-wide={wide}>
      <aside className="context-chat"><span className="session-label">Checkout submission</span><div className="context-user">Prevent duplicate payments and add coverage for the checkout flow.</div><div className="context-assistant">Checkout now prevents repeated submissions while payment is pending. Added component and end-to-end coverage.</div><div className="context-tool">9 files changed</div><div className="context-composer">Follow up…<span>↵</span></div></aside>
      <section className="review-panel"><header className="review-tabs"><span>Preview</span><strong>Changes</strong><span>Terminal</span></header>
        <div className="review-controls"><span className="branch-name">feature/checkout</span><div className="compare-controls"><Button variant="default" size="xs" rightSection={<IconChevronDown size={12}/>}>Branch</Button><Button variant="default" size="xs" rightSection={<IconChevronDown size={12}/>}>main</Button><div className="control-spacer"/><ActionIcon variant="subtle" color="gray" aria-label="Toggle file navigation" onClick={()=>setNavOpen(!navOpen)}><IconLayoutSidebar size={16}/></ActionIcon><ActionIcon variant={wrap ? "light" : "subtle"} color="gray" aria-label="Wrap lines" aria-pressed={wrap} onClick={()=>setWrap(!wrap)}><IconTextWrap size={16}/></ActionIcon><ActionIcon variant="subtle" color="gray" aria-label="Refresh fake changes" loading={refreshing} onClick={()=>{setRefreshing(true);setTimeout(()=>setRefreshing(false),450);}}><IconRefresh size={16}/></ActionIcon></div></div>
        <div className="navigation-layout viewer-workspace" data-wrap={wrap} data-nav={navOpen}>
          {navOpen && <aside className="explorer-pane"><div className="explorer-header"><span>Files <small>{shown.length===files.length ? files.length : `${shown.length}/${files.length}`}</small></span><ActionIcon size="xs" variant="subtle" color="gray" aria-label="Expand all folders" onClick={()=>setEpoch(v=>v+1)}><IconArrowsSort size={14}/></ActionIcon></div><TextInput className="file-search" aria-label="Filter files by path" placeholder="Filter files…" size="xs" leftSection={<IconSearch size={13}/>} value={query} onChange={event=>setQuery(event.currentTarget.value)}/><FileExplorer key={variant+epoch} files={shown} variant={variant} selected={selected} onSelect={jump} collapseEpoch={epoch}/></aside>}
          <div className="diff-stream study-diff-stream" ref={stream} onScroll={()=>{const container=stream.current;if(!container)return;const target=Array.from(container.children).find(child=>child.getBoundingClientRect().bottom>container.getBoundingClientRect().top+60);if(target)setSelected(target.getAttribute("data-file")??"");}}>{ordered.map(file=><div key={file.path} data-file={file.path}><DiffContent file={file}/></div>)}{!ordered.length && <div className="empty">No matching files</div>}</div>
        </div>
        <footer className="viewer-footer"><span>{shown.length} files changed</span><span className="added">+{shown.reduce((sum,file)=>sum+file.added,0)}</span><span className="removed">−{shown.reduce((sum,file)=>sum+file.removed,0)}</span>{variant==="areas" && <span className="footer-note">Area assignments are simulated</span>}</footer>
      </section>
    </main>
  </div>;
}
