import { Modal, Stack, TextInput } from "@mantine/core";
import { DialogActions } from "../../ui/DialogActions.js";

interface RenameSessionDialogProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  onRename: (name: string) => void;
}

export function RenameSessionDialog({ value, onChange, onRename }: RenameSessionDialogProps) {
  const rename = () => {
    const name = value?.trim();
    if (name) {
      onRename(name);
      onChange(undefined);
    }
  };

  return (
    <Modal opened={value !== undefined} onClose={() => onChange(undefined)} title="Rename session" centered size="sm">
      <Stack gap="md">
        <TextInput
          data-autofocus
          aria-label="Session name"
          value={value ?? ""}
          onChange={(event) => onChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !value?.trim()) return;
            event.preventDefault();
            rename();
          }}
        />
        <DialogActions
          confirmLabel="Rename"
          onCancel={() => onChange(undefined)}
          onConfirm={rename}
          confirmProps={{ disabled: !value?.trim() }}
        />
      </Stack>
    </Modal>
  );
}
