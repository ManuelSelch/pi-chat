import { Button, Group } from "@mantine/core";
import type { PiChatButton, PiChatSlot } from "../../shared/protocol.js";

export interface SlotProps {
  name: PiChatSlot;
  buttons: readonly PiChatButton[];
  onAction(actionId: string): void;
}

export function Slot({ name, buttons, onAction }: SlotProps) {
  const visible = buttons.filter((button) => button.slot === name);
  if (visible.length === 0) return null;
  return (
    <Group gap="xs" wrap="nowrap">
      {visible.map((button) => (
        <Button key={button.id} size="xs" variant="light" onClick={() => onAction(button.actionId)}>
          {button.label}
        </Button>
      ))}
    </Group>
  );
}
