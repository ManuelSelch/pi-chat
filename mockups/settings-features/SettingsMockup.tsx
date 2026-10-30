import { useState, type ReactNode } from "react";
import { Alert, Badge, Button, Divider, Drawer, Group, Paper, Select, Stack, Switch, Text, TextInput } from "@mantine/core";
import { IconAdjustments, IconBrain, IconServer } from "@tabler/icons-react";

const state = new URLSearchParams(location.search).get("state");
const defaultEndpoint = "ws://localhost:3000/ws";
function Section({ title, icon, children, accessory }: { title: string; icon: ReactNode; children: ReactNode; accessory?: ReactNode }) {
  return <Paper withBorder p="md"><Stack gap="sm"><Group justify="space-between" wrap="nowrap"><Group gap="xs">{icon}<Text className="section-title">{title}</Text></Group>{accessory}</Group>{children}</Stack></Paper>;
}
export function SettingsMockup() {
  const [opened, setOpened] = useState(true);
  const [compact, setCompact] = useState(false);
  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(defaultEndpoint);
  const disconnected = state === "disconnected";
  const busy = state === "running";
  const invalid = !!endpoint && !/^wss?:\/\//.test(endpoint);
  return <div className="shell">
    <Group justify="space-between" p="md"><Text c="dimmed">Settings grouping · revision 6</Text><Button variant="subtle" onClick={() => setOpened(true)}>Settings</Button></Group>
    <div className="preview-note"><Text size="sm">Mockup only: local state, no connections or persistence.</Text>{notice && <Alert mt="sm">{notice}</Alert>}</div>
    <Drawer opened={opened} onClose={() => setOpened(false)} title="Settings" size="md" position="right">
      <Stack gap="md">
        {state !== "home" && <Section title="Session" icon={<IconBrain size={16}/>}>
          <Select label="Thinking level" defaultValue="medium" data={["off", "low", "medium", "high"]} disabled={busy}/>
          <Select label="Model" defaultValue="GPT-5" data={["GPT-5", "Claude Sonnet"]} searchable disabled={busy}/>
          <Divider/>
          <Text size="sm" fw={500}>Compact session</Text>
          <Button disabled={busy} onClick={() => setNotice("Session compaction simulated.")}>Compact</Button>
        </Section>}
        <Section title="Feature Toggles" icon={<IconAdjustments size={16}/>}>
          <Switch defaultChecked label="Show open sessions in sidebar"/>
          <Switch label="Chime when a run finishes or needs an answer"/>
          <Switch defaultChecked label="Show folder path in projects panel"/>
          <Switch defaultChecked label="Hide archived sessions"/>
          <Switch label="Compact transcript" checked={compact} onChange={event => setCompact(event.currentTarget.checked)}/>
        </Section>
        <Section title="Backend server" icon={<IconServer size={16}/>} accessory={<Badge variant="light" color={disconnected ? "red" : "green"}>{disconnected ? "Disconnected" : "Connected"}</Badge>}>
          {disconnected && <Alert color="red">Could not connect. Check the address or reset to this page’s server.</Alert>}
          <TextInput label="WebSocket endpoint" placeholder="ws://localhost:3000/ws" value={endpoint} onChange={event => setEndpoint(event.currentTarget.value)} error={invalid ? "Use a full ws:// or wss:// URL." : undefined}/>
          <Group gap="xs" grow wrap="nowrap"><Button disabled={invalid || (endpoint || defaultEndpoint) === saved} onClick={() => {setSaved(endpoint || defaultEndpoint); setNotice("Save and reload simulated.");}}>Save and reload</Button><Button variant="default" disabled={saved === defaultEndpoint} onClick={() => {setEndpoint(defaultEndpoint); setSaved(defaultEndpoint); setNotice("Reset simulated.");}}>Reset to default</Button></Group>
          <Divider/>
          <Button variant="light" color="red" onClick={() => setNotice("Restart simulated.")}>Restart server</Button>
        </Section>
      </Stack>
    </Drawer>
  </div>;
}
