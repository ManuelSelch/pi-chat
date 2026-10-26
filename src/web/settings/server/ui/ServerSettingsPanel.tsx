import { Alert, Badge, Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { IconAlertCircle, IconServer } from "@tabler/icons-react";
import { Panel } from "../../../ui/Panel.js";
import { SectionHeader } from "../../../ui/SectionHeader.js";

export interface ServerSettingsPanelProps {
  endpoint: string;
  placeholder: string;
  connected: boolean;
  failed: boolean;
  draft: string;
  validation?: string;
  error?: string;
  warning?: string;
  otherHost: boolean;
  busy: boolean;
  canSave: boolean;
  canReset: boolean;
  onEdit: (value: string) => void;
  onSave: () => void;
  onReset: () => void;
}

export function ServerSettingsPanel(props: ServerSettingsPanelProps) {
  return <Panel>
    <Stack gap="sm">
      <Group justify="space-between">
        <SectionHeader icon={<IconServer size={16} />}>Backend server</SectionHeader>
        <Badge variant="light" color={props.connected ? "green" : props.failed ? "red" : "gray"}>
          {props.connected ? "Connected" : props.failed ? "Disconnected" : "Connecting"}
        </Badge>
      </Group>
      {props.failed && <Alert color="red" icon={<IconAlertCircle size={16} />}>Could not connect. Check the address or reset to this page’s server.</Alert>}
      <div><Text size="xs" c="dimmed">Current endpoint</Text><Text size="sm" style={{ overflowWrap: "anywhere" }}>{props.endpoint}</Text></div>
      <TextInput
        label="WebSocket endpoint"
        description="Leave blank to use this page’s server."
        placeholder={props.placeholder}
        value={props.draft}
        onChange={event => props.onEdit(event.currentTarget.value)}
        error={props.validation}
        disabled={props.busy}
        spellCheck={false}
        autoComplete="off"
      />
      {props.otherHost && !props.validation && <Alert color="yellow">This server requires Pi Chat at the same host and port. For another server, open its own Pi Chat URL instead.</Alert>}
      <Text size="xs" c="dimmed">Remembered in this browser for this site. Applying reloads the page; server sessions keep running.</Text>
      {props.warning && <Alert color="yellow">{props.warning}</Alert>}
      {props.error && <Alert color="red">{props.error}</Alert>}
      <Group gap="xs">
        <Button disabled={!props.canSave} onClick={props.onSave}>Save and reload</Button>
        <Button variant="default" disabled={!props.canReset} onClick={props.onReset}>Reset to default</Button>
      </Group>
    </Stack>
  </Panel>;
}
