import { useState } from "react";
import { ActionIcon, Badge, Button, Group, Text } from "@mantine/core";
import { IconGitBranch, IconGitCompare, IconRefresh, IconLayoutSidebarRight } from "@tabler/icons-react";
import { DiffStream } from "./DiffStream";
import { ChatWorkspace } from "./ChatWorkspace";
import { SidePanel } from "./SidePanel";
import { BaseSelector } from "./BaseSelector";

export function DiffViewerMockup() {
  const state = new URLSearchParams(location.search).get("state");
  const [opened,setOpened] = useState(true);
  const [base,setBase] = useState("branch:refs/heads/main");
  const [refreshing,setRefreshing] = useState(false);
  const choosingBase = base.endsWith(":");
  const noDiff = choosingBase || state==="empty" || state==="error" || state==="not-git" || state==="loading";
  function refresh() { setRefreshing(true); window.setTimeout(()=>setRefreshing(false),500); }
  return <>
    <header className="shell-header">
      <Text size="sm">pi-chat</Text><Text size="xs" c="dimmed">Diff viewer plugin</Text>
      <div className="shell-actions"><Badge color="gray" variant="outline" size="xs">Mockup</Badge>
        <ActionIcon variant={opened ? "light" : "subtle"} color="gray" size="lg" aria-label="Toggle side panel" title="Toggle side panel" aria-expanded={opened} aria-controls="side-panel" onClick={()=>setOpened(current=>!current)}><IconLayoutSidebarRight size={19}/></ActionIcon>
      </div>
    </header>
    <div className="parallel-workspace" data-panel-open={opened}>
      <ChatWorkspace />
      {opened && <SidePanel tab={{id:"changes",label:"Changes",icon:<IconGitCompare size={16}/>}} onClose={()=>setOpened(false)}>
        <div className="viewer-toolbar">
          <Group gap="xs"><IconGitBranch size={15}/><Text size="xs">feature/diff-viewer</Text></Group>
          <BaseSelector base={base} onChange={setBase}/>
          <ActionIcon variant="subtle" color="gray" aria-label="Refresh changes" loading={refreshing} onClick={refresh}><IconRefresh size={17}/></ActionIcon>
        </div>
        {noDiff ? <div className="empty" role="status">
          <IconGitCompare size={28}/>
          <strong>{choosingBase?(base.startsWith("branch:")?"Select a branch":"Select a commit"):state==="empty"?"No changes":state==="not-git"?"Not a Git repository":state==="loading"?"Loading changes…":"Couldn’t load changes"}</strong>
          <span>{choosingBase?"":state==="empty"?"The working tree matches the selected base.":state==="not-git"?"Open a project with a Git repository.":state==="loading"?"Reading the project’s local changes.":"Git could not read this repository. Try refreshing."}</span>
          {state==="error" && <Button variant="default" size="xs" onClick={refresh} loading={refreshing}>Retry</Button>}
        </div> : <DiffStream/>}
        {!noDiff && <footer className="viewer-footer"><span>4 files changed</span><span className="counts"><span className="added">+8</span><span className="removed">−4</span></span></footer>}
      </SidePanel>}
    </div>
  </>;
}
