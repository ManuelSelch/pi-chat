import { Group, Stack, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { Panel } from "../../../ui/Panel.js";
import { SectionHeader } from "../../../ui/SectionHeader.js";

export function VersionsPanel({ chat, sdk, server }: { chat: string; sdk: string; server: string | null }) {
  return <Panel>
    <div role="group" aria-label="Versions">
      <SectionHeader icon={<IconInfoCircle size={16} />}>Versions</SectionHeader>
      <Stack gap="sm">
        {[["Pi Chat", chat], ["Pi Server", server ?? "Unavailable"], ["Pi SDK", sdk]].map(([label, value]) =>
          <Group key={label} justify="space-between"><Text size="sm">{label}</Text><Text size="sm" ff="monospace">{value}</Text></Group>)}
      </Stack>
    </div>
  </Panel>;
}
