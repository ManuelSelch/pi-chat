import { createContext, useContext, useState, type ReactNode } from "react";
import { ActionIcon, Tabs, Tooltip } from "@mantine/core";
import { IconLayoutSidebarRight, IconX } from "@tabler/icons-react";
import { usePluginSidePanels } from "./PluginProvider.js";

const PanelState = createContext({ opened: false, available: false, toggle() {}, close() {} });

export function SidePanelProvider({children}:{children:ReactNode}) {
  const panels = usePluginSidePanels();
  const [opened,setOpened] = useState(false);
  return <PanelState.Provider value={{opened:opened && panels.length>0,available:panels.length>0,toggle:()=>setOpened(value=>!value),close:()=>setOpened(false)}}>{children}</PanelState.Provider>;
}
export const useSidePanel = () => useContext(PanelState);

export function SidePanelToggle() {
  const panel = useSidePanel();
  if (!panel.available) return null;
  return <ActionIcon variant={panel.opened ? "light" : "subtle"} color="gray" aria-label="Toggle side panel" aria-expanded={panel.opened} aria-controls="plugin-side-panel" onClick={panel.toggle}><IconLayoutSidebarRight size={18}/></ActionIcon>;
}

export function PluginSidePanel({stacked = false}:{stacked?:boolean}) {
  const panel = useSidePanel();
  const panels = usePluginSidePanels();
  const [active,setActive] = useState<string | null>(null);
  if (!panel.opened || !panels.length) return null;
  const value = panels.some(item=>item.id===active) ? active : panels[0]!.id;
  return <aside id="plugin-side-panel" data-stacked={stacked} data-single-tab={panels.length===1} aria-label="Side panel" className="pi-side-panel border-l border-(--mantine-color-default-border) bg-(--pi-sidebar-bg)">
    <Tabs value={value} onChange={setActive} style={{display:"flex",flexDirection:"column"}} className="min-h-0 flex-1">
      <div className="flex min-h-12 items-center justify-between px-3">
        <Tabs.List aria-label="Panel views" className="min-w-0 flex-1">{panels.map(item=><Tabs.Tab key={item.id} value={item.id} leftSection={<item.Icon/>} style={panels.length===1 ? {borderBottomColor:"transparent"} : undefined}>{item.label}</Tabs.Tab>)}</Tabs.List>
        <Tooltip label="Close side panel"><ActionIcon variant="subtle" color="gray" aria-label="Close side panel" onClick={panel.close}><IconX size={18}/></ActionIcon></Tooltip>
      </div>
      {panels.map(item=><Tabs.Panel key={item.id} value={item.id} keepMounted={false} style={{flex:1}} className="flex min-h-0 flex-col"><item.Component/></Tabs.Panel>)}
    </Tabs>
  </aside>;
}
