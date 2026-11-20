import { useState } from "react";
import { ActionIcon, Badge, Button, Group, Popover, Text, TextInput, Title, Tooltip } from "@mantine/core";
import { IconArrowUp, IconHome, IconLayoutSidebar, IconPlugConnected, IconSearch, IconSettings } from "@tabler/icons-react";
import { CounterPanel, type CounterState } from "./CounterPanel";

const allowedStates: CounterState[] = ["ready", "loading", "disconnected", "error", "unavailable"];
function initialState(): CounterState {
  const state = new URLSearchParams(location.search).get("state");
  return allowedStates.find(value => value === state) ?? "ready";
}

export function CounterDemo() {
  const [opened, setOpened] = useState(true);
  const [state, setState] = useState<CounterState>(initialState);
  const [count, setCount] = useState<number | null>(() => ["loading", "unavailable"].includes(initialState()) ? null : initialState() === "error" ? 3 : 0);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    setState("loading");
    setTimeout(() => { setCount(value => value ?? 0); setState("ready"); }, 450);
  };
  const increment = () => {
    setBusy(true);
    setTimeout(() => { setCount(value => (value ?? 0) + 1); setBusy(false); }, 350);
  };

  return (
    <div className="demo-shell">
      <header className="demo-header">
        <Tooltip label="Projects and sessions"><ActionIcon variant="subtle" color="gray" aria-label="Projects and sessions"><IconLayoutSidebar size={18} /></ActionIcon></Tooltip>
        <Group gap="sm" wrap="nowrap">
          <Popover opened={opened} onChange={setOpened} position="bottom-end" width={288} shadow="md" withinPortal>
            <Popover.Target>
              <Button variant="subtle" color="gray" size="compact-sm" leftSection={<IconPlugConnected size={16} />}
                onClick={() => setOpened(value => !value)} aria-expanded={opened}>Counter</Button>
            </Popover.Target>
            <Popover.Dropdown><CounterPanel count={count} state={state} busy={busy} onIncrement={increment} onRefresh={refresh} /></Popover.Dropdown>
          </Popover>
          <Tooltip label="Settings"><ActionIcon variant="subtle" color="gray" aria-label="Settings"><IconSettings size={18} /></ActionIcon></Tooltip>
        </Group>
      </header>
      <nav className="demo-tabs"><Button variant="subtle" color="gray" size="compact-sm" leftSection={<IconHome size={15} />}>Home</Button></nav>
      <main className="demo-home">
        <Title order={1} size={32} fw={550} ta="center">Lets cook</Title>
        <TextInput className="demo-search" size="md" leftSection={<IconSearch size={17} />} placeholder="Search projects and sessions" aria-label="Search projects and sessions" />
        <section className="demo-inbox">
          <Text size="xs" c="dimmed" fw={600} mb="sm">READY</Text>
          <div className="demo-session"><span className="ready-dot" /><div><Text size="sm" fw={550}>Counter plugin demo</Text><Text size="xs" c="dimmed">pi-chat / refactor/plugin-arch</Text></div><Badge size="xs" variant="light" color="gray">Ready</Badge></div>
        </section>
      </main>
      <div className="demo-composer"><Text size="sm" c="dimmed">Message Pi…</Text><ActionIcon color="gray" variant="light" aria-label="Send message" disabled><IconArrowUp size={18} /></ActionIcon></div>
    </div>
  );
}
