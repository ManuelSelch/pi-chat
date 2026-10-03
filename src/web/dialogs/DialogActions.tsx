import { Button, Group, type ButtonProps } from "@mantine/core";

export interface DialogActionsProps {
  cancelLabel?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmProps?: ButtonProps;
  cancelProps?: ButtonProps;
}

/** Consistent action row for confirmation, rename, and other dialogs. */
export function DialogActions({
  cancelLabel = "Cancel",
  confirmLabel,
  onCancel,
  onConfirm,
  confirmProps,
  cancelProps,
}: DialogActionsProps) {
  return (
    <Group justify="flex-end" gap="xs">
      <Button variant="default" onClick={onCancel} {...cancelProps}>{cancelLabel}</Button>
      <Button onClick={onConfirm} {...confirmProps}>{confirmLabel}</Button>
    </Group>
  );
}
