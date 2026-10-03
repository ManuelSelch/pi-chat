import { useCallback } from "react";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { MANTINE_COLOR } from "../../theme.js";
import { useConfirmOnEnter } from "./confirm-enter.js";

export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
}

interface ConfirmDialogProps {
  options: ConfirmOptions | undefined;
  onResolve: (confirmed: boolean) => void;
}

export function ConfirmDialog({ options, onResolve }: ConfirmDialogProps) {
  const resolve = useCallback((confirmed: boolean) => onResolve(confirmed), [onResolve]);
  useConfirmOnEnter({ enabled: Boolean(options), onConfirm: () => resolve(true) });

  return (
    <Modal opened={Boolean(options)} onClose={() => resolve(false)} title={options?.title} centered size="sm" zIndex={400}>
      <Stack gap="md">
        <Text size="sm">{options?.body}</Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => resolve(false)}>Cancel</Button>
          <Button color={MANTINE_COLOR.danger} onClick={() => resolve(true)}>{options?.confirmLabel ?? "Confirm"}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
