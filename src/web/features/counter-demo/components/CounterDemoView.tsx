import { Button, Popover } from "@mantine/core";
import { IconPlugConnected } from "@tabler/icons-react";
import { CounterPanelView } from "./CounterPanelView.js";
import type { CounterDemoState } from "../hooks/use-counter-demo.js";
import { MANTINE_COLOR } from "../../../config/theme.js";

interface CounterDemoViewProps {
  opened: boolean;
  connected: boolean;
  state: CounterDemoState;
  onOpenChange(opened: boolean): void;
  onRead(): void;
  onIncrement(): void;
}

export function CounterDemoView({ opened, connected, state, onOpenChange, onRead, onIncrement }: CounterDemoViewProps) {
  return (
    <Popover opened={opened} onChange={onOpenChange} position="bottom-end" width={288} shadow="md" withinPortal>
      <Popover.Target>
        <Button className="shrink-0" variant="subtle" color={MANTINE_COLOR.neutral} size="compact-sm"
          leftSection={<IconPlugConnected size={16} />} onClick={() => onOpenChange(!opened)} aria-expanded={opened}>
          Counter
        </Button>
      </Popover.Target>
      <Popover.Dropdown p={18}>
        <CounterPanelView state={state} connected={connected} onRead={onRead} onIncrement={onIncrement} />
      </Popover.Dropdown>
    </Popover>
  );
}
