import { useLocalStorage } from "@mantine/hooks";

export const DISPLAY_PATH_STORAGE_KEY = "pi-chat:displayPath";

/**
 * Whether to show the displayPath description in the projects panel.
 * Defaults to true (show).
 */
export function useDisplayPath(): { show: boolean; setShow: (value: boolean) => void } {
  const [show, setShow] = useLocalStorage({
    key: DISPLAY_PATH_STORAGE_KEY,
    defaultValue: true,
    getInitialValueInEffect: false,
  });
  return { show, setShow };
}