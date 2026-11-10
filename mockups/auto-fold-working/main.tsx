import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider, createTheme, Button, Group, Text, UnstyledButton, Stack } from "@mantine/core";
import { IconChevronRight, IconSettings, IconX } from "@tabler/icons-react";
import { Agentation } from "agentation";
import "@mantine/core/styles.css";
import "./styles.css";

function Mockup() {
  const [working, setWorking] = useState(true);
  const [expanded, setExpanded] = useState(false);
  function finish() {
    setWorking(false);
    setExpanded(false);
  }
  return <>
    <header>Pi Chat <Text size="sm" c="dimmed">Auto-fold Working · PIC-2 · revision 1</Text></header>
    <div className="layout">
      <nav aria-label="Sessions">
        <Group justify="flex-end"><IconX size={18}/></Group>
        <div className="sessions">
          <Group justify="space-between"><Text size="xs" c="dimmed">Ready</Text><Text size="xs" c="dimmed">{working ? 1 : 2}</Text></Group>
          <div className="session">Plan release<Text size="xs" c="dimmed">pi-chat · main</Text></div>
          {!working && <div className="session">Fix session sidebar<Text size="xs" c="dimmed">pi-chat · main</Text></div>}
          {working && <section aria-label="Working">
            <UnstyledButton className="working" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
              <span><IconChevronRight size={12} style={{ transform: expanded ? "rotate(90deg)" : undefined }}/> Working</span><span>1</span>
            </UnstyledButton>
            {expanded && <div className="session">Fix session sidebar<Text size="xs" c="dimmed">pi-chat · main</Text></div>}
          </section>}
        </div>
        <div className="settings"><IconSettings size={19}/></div>
      </nav>
      <main><Stack maw={540}>
        <Text fw={600}>Review the folding behavior</Text>
        <Text size="sm" c="dimmed">Working starts collapsed. Expand it, finish the session, then start it again: the section returns collapsed. Reload also resets expansion.</Text>
        <Group>
          <Button variant="light" disabled={!working} onClick={finish}>Finish working session</Button>
          <Button variant="light" disabled={working} onClick={() => setWorking(true)}>Start working session</Button>
        </Group>
        <Text size="xs" c="dimmed">Demo controls only; existing sidebar styling and all other session actions remain unchanged in production.</Text>
      </Stack></main>
    </div>
    {import.meta.env.DEV && <Agentation/>}
  </>;
}
const theme = createTheme({ primaryColor: "blue", defaultRadius: "sm", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' });
createRoot(document.getElementById("root")!).render(<MantineProvider theme={theme}><Mockup/></MantineProvider>);
