import { createContext, useContext, type ReactNode } from "react";
import { usePromptPresentation } from "../features/extensions/prompts/hooks/use-prompt-presentation.js";
import { usePiChat } from "./hooks/use-pi-chat.js";
import { AppThemeProvider } from "../lib/theme/AppThemeProvider.js";
import { SessionDraftProvider } from "../features/sessions/drafts/stores/SessionDraftProvider.js";
import { FileActionsProvider } from "../features/chat/markdown/stores/FileActions.js";

export type AppController = ReturnType<typeof usePiChat> & { promptPresentation: ReturnType<typeof usePromptPresentation> };

const AppControllerContext = createContext<AppController | undefined>(undefined);

export function AppControllerProvider({ children }: { children: ReactNode }) {
  const controller = usePiChat();
  const promptPresentation = usePromptPresentation({ ...controller.app, respond: controller.respondToPrompt });

  return (
    <AppControllerContext.Provider value={{ ...controller, promptPresentation }}>
      <AppThemeProvider>
        <SessionDraftProvider><FileActionsProvider openFile={controller.openFile}>{children}</FileActionsProvider></SessionDraftProvider>
      </AppThemeProvider>
    </AppControllerContext.Provider>
  );
}

export function useAppController(): AppController {
  const controller = useContext(AppControllerContext);
  if (!controller) throw new Error("useAppController must be used inside AppControllerProvider");
  return controller;
}
