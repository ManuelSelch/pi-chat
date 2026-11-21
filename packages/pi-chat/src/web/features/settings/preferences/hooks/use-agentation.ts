import { useLocalStorage } from "@mantine/hooks";

export const AGENTATION_STORAGE_KEY = "pi-chat:agentation";

/** Agentation is an opt-in browser preference. */
export function useAgentation() {
  const [enabled, setEnabled] = useLocalStorage({
    key: AGENTATION_STORAGE_KEY,
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  return { enabled, setEnabled };
}
