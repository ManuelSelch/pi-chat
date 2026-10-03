import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { MANTINE_COLOR } from "../theme.js";
import type { Tab } from "../../shared/protocol.js";

interface CloseSessionDialogProps {
  tab: Tab | undefined;
  onClose: () => void;
  onConfirm: (sessionId: string) => void;
}

export function CloseSessionDialog({ tab, onClose, onConfirm }: CloseSessionDialogProps) {
  return (
    <Modal opened={Boolean(tab)} onClose={onClose} title="Close running session?" centered size="sm">
      <Stack gap="md">
        <Text size="sm">“{tab?.title}” is still running. Closing stops the run.</Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>Keep open</Button>
          <Button color={MANTINE_COLOR.danger} onClick={() => { onConfirm(tab!.sessionId); onClose(); }}>
            Stop and close
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
