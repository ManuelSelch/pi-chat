import { createContext, useContext, type ReactNode } from "react";
import { usePromptPresentation } from "../extensions/prompts/app/use-prompt-presentation.js";
import { usePiChat } from "./use-pi-chat.js";
import { SessionThemeProvider } from "./theme/SessionThemeProvider.js";
import { SessionDraftProvider } from "../sessions/drafts/app/SessionDraftProvider.js";
import { FileActionsProvider } from "../chat/markdown/FileActions.js";

export type AppController = ReturnType<typeof usePiChat> & { promptPresentation: ReturnType<typeof usePromptPresentation> };

const AppControllerContext = createContext<AppController | undefined>(undefined);

export function AppControllerProvider({ children }: { children: ReactNode }) {
  const controller = usePiChat();
  const promptPresentation = usePromptPresentation({ ...controller.app, respond: controller.respondToPrompt });
  const { themes, activeSessionId } = controller.app;
  const palette = Object.hasOwn(themes, activeSessionId) ? themes[activeSessionId] : undefined;

  return (
    <AppControllerContext.Provider value={{ ...controller, promptPresentation }}>
      <SessionThemeProvider palette={palette}>
        <SessionDraftProvider><FileActionsProvider openFile={controller.openFile}>{children}</FileActionsProvider></SessionDraftProvider>
      </SessionThemeProvider>
    </AppControllerContext.Provider>
  );
}

export function useAppController(): AppController {
  const controller = useContext(AppControllerContext);
  if (!controller) throw new Error("useAppController must be used inside AppControllerProvider");
  return controller;
}
