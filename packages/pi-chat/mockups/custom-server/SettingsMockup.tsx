import { useState } from "react";
import { ActionIcon, Alert, Badge, Button, Drawer, Group, Modal, Paper, SegmentedControl, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { IconAlertCircle, IconBell, IconFolder, IconMessageCircle, IconServer, IconSettings } from "@tabler/icons-react";

const defaultEndpoint = "wss://pi.home.example/ws";
const customEndpoint = "wss://pi.home.example/ws?profile=personal";
const scenario = new URLSearchParams(window.location.search).get("state");

function validation(value: string): string | undefined {
  if (!value.trim()) return;
  try {
    const url = new URL(value.trim());
    if (!["ws:", "wss:"].includes(url.protocol)) return "Use a full ws:// or wss:// URL.";
    if (url.username || url.password || value.includes("#")) return "Credentials and fragments are not supported.";
    if (url.protocol === "ws:") return "This HTTPS example requires a secure wss:// endpoint.";
  } catch { return "Enter a valid WebSocket URL, such as wss://pi.home.example/ws."; }
}

export function SettingsMockup() {
  const initial = scenario === "disconnected" ? "wss://offline.home.example/ws" : scenario === "custom" ? customEndpoint : "";
  const [opened, setOpened] = useState(true);
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [connected, setConnected] = useState(scenario !== "disconnected");
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState("");
  const invalid = validation(draft);
  const effective = saved || defaultEndpoint;
  const changed = draft.trim() !== saved;
  let crossHost = false;
  try { crossHost = new URL(draft || defaultEndpoint).host !== new URL(defaultEndpoint).host; } catch { /* Inline validation explains malformed URLs. */ }
  const apply = () => {
    if (scenario === "storage-error") {
      setError("Could not save the endpoint in this browser. Your connection has not changed.");
      setPending(undefined);
      return;
    }
    const value = pending!;
    setSaved(value); setDraft(value); setPending(undefined); setError(undefined);
    const ok = new URL(value || defaultEndpoint).host === new URL(defaultEndpoint).host;
    setConnected(ok);
    setNotice("Simulated reload. No real server connection or browser storage was changed.");
  };
  return <div className="shell">
    <Group justify="space-between" className="topbar"><Text fw={600}>Pi Chat</Text><ActionIcon aria-label="Settings" variant="subtle" onClick={() => setOpened(true)}><IconSettings size={20}/></ActionIcon></Group>
    <Stack className="empty" align="center"><Title order={2}>No session open</Title><Text c="dimmed">Open a project to start a conversation.</Text>{notice && <Alert>{notice}</Alert>}</Stack>
    <div className="preview-note"><Text size="xs" c="dimmed">Settings mockup · revision 1<br/>Backend, reload and storage are simulated.</Text><Button size="xs" variant="subtle" mt="xs" onClick={() => setOpened(true)}>Open Settings</Button></div>
    <Drawer opened={opened} onClose={() => setOpened(false)} title="Settings" size="md" position="right">
      <Stack gap="md">
        <Paper withBorder p="md"><Stack gap="sm">
          <Group justify="space-between"><Group gap="xs"><IconServer size={16}/><Text className="section-title">Backend server</Text></Group><Badge variant="light" color={connected ? "green" : "red"}>{connected ? "Connected" : "Disconnected"}</Badge></Group>
          {!connected && <Alert color="red" icon={<IconAlertCircle size={16}/>}>Could not connect. Check the address or reset to this page’s server.</Alert>}
          <div><Text size="xs" c="dimmed">Current endpoint</Text><Text size="sm" className="endpoint">{effective.replace(/\?.*$/, "?…")}</Text></div>
          <TextInput label="WebSocket endpoint" description="Leave blank to use this page’s server." placeholder={defaultEndpoint} value={draft} onChange={event => { setDraft(event.currentTarget.value); setError(undefined); }} error={invalid} spellCheck={false} autoComplete="off"/>
          {crossHost && !invalid && <Alert color="yellow">This server requires Pi Chat at the same host and port. For another server, open its own Pi Chat URL instead.</Alert>}
          <Text size="xs" c="dimmed">Remembered in this browser for this site. Applying reloads the page; server sessions keep running.</Text>
          {error && <Alert color="red">{error}</Alert>}
          <Group gap="xs"><Button disabled={!changed || !!invalid} onClick={() => setPending(draft.trim())}>Save and reload</Button><Button variant="default" disabled={!saved} onClick={() => setPending("")}>Reset to default</Button></Group>
        </Stack></Paper>
        <Paper withBorder p="md"><Group gap="xs" mb="sm"><IconBell size={16}/><Text className="section-title">Sounds</Text></Group><Switch defaultChecked label="Chime when a run finishes or needs an answer"/></Paper>
        <Paper withBorder p="md"><Group gap="xs" mb="sm"><IconMessageCircle size={16}/><Text className="section-title">Transcript</Text></Group><Text size="sm" mb="xs">Tool call display</Text><SegmentedControl fullWidth defaultValue="comfortable" data={[{label:"Comfortable",value:"comfortable"},{label:"Compact",value:"compact"}]}/></Paper>
        <Paper withBorder p="md"><Group gap="xs" mb="sm"><IconFolder size={16}/><Text className="section-title">Projects</Text></Group><Switch label="Show folder path in projects panel"/><Switch mt="sm" defaultChecked label="Hide archived sessions"/></Paper>
      </Stack>
    </Drawer>
    <Modal opened={pending !== undefined} onClose={() => setPending(undefined)} title={pending === "" ? "Reset endpoint and reload?" : "Save endpoint and reload?"} centered>
      <Stack><Text size="sm">Reloading discards unsent drafts in all tabs. Running sessions stay on the server; no commands are replayed.</Text><Group justify="flex-end"><Button variant="default" onClick={() => setPending(undefined)}>Cancel</Button><Button onClick={apply}>{pending === "" ? "Reset and reload" : "Save and reload"}</Button></Group></Stack>
    </Modal>
  </div>;
}
