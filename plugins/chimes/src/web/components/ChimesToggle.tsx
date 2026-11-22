import { Switch } from "@mantine/core";

export interface ChimesToggleProps {
  enabled: boolean;
  available: boolean;
  onChange(value: boolean): void;
}

export function ChimesToggle({ enabled, available, onChange }: ChimesToggleProps) {
  return <Switch
    checked={enabled}
    onChange={event => onChange(event.currentTarget.checked)}
    disabled={!available}
    label="Chime when a run finishes or needs an answer"
  />;
}
