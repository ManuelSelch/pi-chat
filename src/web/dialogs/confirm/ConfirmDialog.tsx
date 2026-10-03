import { useCallback } from "react";
import { Modal, Stack, Text } from "@mantine/core";
import { DialogActions } from "../DialogActions.js";
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
        <DialogActions
          confirmLabel={options?.confirmLabel ?? "Confirm"}
          onCancel={() => resolve(false)}
          onConfirm={() => resolve(true)}
          confirmProps={{ color: MANTINE_COLOR.danger }}
        />
      </Stack>
    </Modal>
  );
}
