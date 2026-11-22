import { useChimesSettings } from "../stores/ChimesProvider.js";
import { ChimesToggle } from "./ChimesToggle.js";

export function ChimesToggleContainer() {
  const { enabled, available, setEnabled } = useChimesSettings();
  return <ChimesToggle enabled={enabled} available={available} onChange={setEnabled} />;
}
