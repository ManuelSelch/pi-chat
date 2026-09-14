import { Button, Group, Modal, Stack, Text } from "@mantine/core";

/** A pending destructive action, held until the user agrees to it. */
export interface Confirmation {
  title: string;
  body: string;
  confirmLabel: string;
  run: () => void;
}

interface ConfirmModalProps {
  confirmation: Confirmation | undefined;
  onClose: () => void;
}

export function ConfirmModal({ confirmation, onClose }: ConfirmModalProps) {
  return (
    // A confirmation is often raised from inside the settings drawer, and
    // Mantine gives drawers and modals the same default z-index, so the
    // drawer's overlay would swallow the clicks meant for these buttons.
    <Modal opened={Boolean(confirmation)} onClose={onClose} title={confirmation?.title} centered size="sm" zIndex={400}>
      <Stack gap="md">
        <Text size="sm">{confirmation?.body}</Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>Cancel</Button>
          <Button
            color="red"
            onClick={() => {
              confirmation?.run();
              onClose();
            }}
          >
            {confirmation?.confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
