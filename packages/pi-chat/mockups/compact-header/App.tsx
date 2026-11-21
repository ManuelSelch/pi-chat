import { useState } from "react";
import { ActionIcon, Button, SegmentedControl } from "@mantine/core";
import { IconArchive, IconChevronRight, IconClockPause, IconLayoutSidebar, IconPlus, IconX } from "@tabler/icons-react";

function Header({ worktree }: { worktree: boolean }) {
  const label = worktree ? "feat-improve-header" : "Improve the header on small screens";
  return <header className="header">
    <ActionIcon variant="subtle" color="gray" aria-label="Sessions"><IconLayoutSidebar size={18}/></ActionIcon>
    <div className="breadcrumb"><span className="project">pi-chat</span><IconChevronRight size={12} className="chevron"/><span className="title" title={label}>{label}</span></div>
    <span className="status">Idle</span>
    <div className="actions"><ActionIcon size="sm" variant="subtle" color="gray" aria-label="Move to Later"><IconClockPause size={17}/></ActionIcon><ActionIcon size="sm" variant="subtle" color="gray" aria-label="Archive"><IconArchive size={17}/></ActionIcon><ActionIcon size="sm" variant="subtle" color="gray" aria-label="Close"><IconX size={17}/></ActionIcon></div>
    <ActionIcon variant="subtle" color="gray" aria-label="New session"><IconPlus size={19}/></ActionIcon>
  </header>;
}
export function App() {
  const [state, setState] = useState("worktree");
  return <main><div className="controls"><strong>Header preview</strong><SegmentedControl value={state} onChange={setState} data={[{label:"Worktree",value:"worktree"},{label:"No worktree",value:"session"}]} size="xs"/><span>Resize the window to compare small screens.</span></div><Header worktree={state === "worktree"}/><section><div className="conversation"><p className="muted">Today</p><div className="message">Improve the header on small screens</div><p>Let's make the session header easier to read on smaller screens.</p></div><div className="composer"><span>Ask anything...</span><Button size="xs" variant="light">Send</Button></div></section></main>;
}