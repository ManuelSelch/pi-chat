import { Modal, Stack, Text } from "@mantine/core";
import { DialogActions } from "../ui/DialogActions.js";
import { MANTINE_COLOR } from "../ui/theme.js";
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
        <DialogActions
          cancelLabel="Keep open"
          confirmLabel="Stop and close"
          onCancel={onClose}
          onConfirm={() => { onConfirm(tab!.sessionId); onClose(); }}
          confirmProps={{ color: MANTINE_COLOR.danger }}
        />
      </Stack>
    </Modal>
  );
}
