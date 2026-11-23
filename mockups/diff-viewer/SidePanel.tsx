import type { ReactNode } from "react";
import { ActionIcon, Tabs } from "@mantine/core";
import { IconX } from "@tabler/icons-react";

interface SidePanelProps {
  tab: { id: string; label: string; icon: ReactNode };
  onClose: () => void;
  children: ReactNode;
}

export function SidePanel({ tab, onClose, children }: SidePanelProps) {
  return <aside id="side-panel" className="viewer" aria-label="Side panel">
    <Tabs defaultValue={tab.id} className="side-panel-tabs">
      <div className="side-panel-header">
        <Tabs.List aria-label="Panel views">
          <Tabs.Tab value={tab.id} leftSection={tab.icon} style={{borderBottomColor:"transparent"}}>{tab.label}</Tabs.Tab>
        </Tabs.List>
        <ActionIcon variant="subtle" color="gray" aria-label="Close side panel" onClick={onClose}><IconX size={18}/></ActionIcon>
      </div>
      <Tabs.Panel value={tab.id} className="side-panel-content">{children}</Tabs.Panel>
    </Tabs>
  </aside>;
}
