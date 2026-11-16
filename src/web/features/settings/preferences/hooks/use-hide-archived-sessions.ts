import { useLocalStorage } from "@mantine/hooks";

export const HIDE_ARCHIVED_SESSIONS_STORAGE_KEY = "pi-chat:hideArchivedSessions";

/** Hide archived rows and their section headings without changing saved history. */
export function useHideArchivedSessions(): { hide: boolean; setHide: (value: boolean) => void } {
  const [hide, setHide] = useLocalStorage({
    key: HIDE_ARCHIVED_SESSIONS_STORAGE_KEY,
    defaultValue: true,
    getInitialValueInEffect: false,
  });
  return { hide, setHide };
}
