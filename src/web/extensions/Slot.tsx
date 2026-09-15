import { Badge, Button, Group } from "@mantine/core";
import type { PiChatBadge, PiChatButton, PiChatSlot } from "../../shared/protocol.js";

const TONE_COLOR: Record<PiChatBadge["tone"], string> = {
  neutral: "gray",
  green: "green",
  yellow: "yellow",
  red: "red",
};

export interface SlotProps {
  name: PiChatSlot;
  buttons: readonly PiChatButton[];
  badges?: readonly PiChatBadge[];
  onAction(actionId: string): void;
}

export function Slot({ name, buttons, badges = [], onAction }: SlotProps) {
  const visibleButtons = buttons.filter((button) => button.slot === name);
  const visibleBadges = badges.filter((badge) => badge.slot === name);
  if (visibleButtons.length === 0 && visibleBadges.length === 0) return null;
  return (
    <Group gap="xs" wrap="nowrap">
      {visibleBadges.map((badge) => (
        <Badge key={badge.id} size="sm" variant="light" color={TONE_COLOR[badge.tone]}>
          {badge.label}
        </Badge>
      ))}
      {visibleButtons.map((button) => (
        <Button key={button.id} size="xs" variant="light" onClick={() => onAction(button.actionId)}>
          {button.label}
        </Button>
      ))}
    </Group>
  );
}
