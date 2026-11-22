import { createContext, useContext, useState, type ReactNode } from "react";
import type { WebPluginHost, WebPluginProviderProps } from "@manuelselch/pi-sdk/plugins";

const FolderOpeningContext = createContext<{
  host: WebPluginHost;
  opened: boolean;
  open(): void;
  close(): void;
} | undefined>(undefined);

export function FolderOpeningProvider({ host, children }: WebPluginProviderProps<ReactNode>) {
  const [opened, setOpened] = useState(false);
  return <FolderOpeningContext.Provider value={{ host, opened, open: () => setOpened(true), close: () => setOpened(false) }}>
    {children}
  </FolderOpeningContext.Provider>;
}

export function useFolderOpening() {
  const value = useContext(FolderOpeningContext);
  if (!value) throw new Error("Folder opening must be used inside FolderOpeningProvider");
  return value;
}

export function useOpenFolderAction() {
  return { run: useFolderOpening().open };
}

export function useFolderPickerOpen() {
  return useFolderOpening().opened;
}
