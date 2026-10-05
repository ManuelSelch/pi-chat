import { createContext, useContext, type ReactNode } from "react";
import { usePiChat } from "./use-pi-chat.js";
import { FileActionsProvider } from "../chat/markdown/FileActions.js";

export type AppController = ReturnType<typeof usePiChat>;

const AppControllerContext = createContext<AppController | undefined>(undefined);

export function AppControllerProvider({ children }: { children: ReactNode }) {
  const controller = usePiChat();

  return (
    <AppControllerContext.Provider value={controller}>
      <FileActionsProvider openFile={controller.openFile}>{children}</FileActionsProvider>
    </AppControllerContext.Provider>
  );
}

export function useAppController(): AppController {
  const controller = useContext(AppControllerContext);
  if (!controller) throw new Error("useAppController must be used inside AppControllerProvider");
  return controller;
}
