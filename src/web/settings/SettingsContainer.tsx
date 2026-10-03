import { useCallback } from "react";
import { useAppController } from "../state/AppControllerContext.js";
import { useConfirmDialog } from "../dialogs/confirm/ConfirmDialogProvider.js";
import { useChimes } from "../app/use-chimes.js";
import { useDisplayPath } from "../app/use-display-path.js";
import { SettingsDrawer } from "./SettingsDrawer.js";

interface SettingsContainerProps {
  opened: boolean;
  onClose: () => void;
}

export function SettingsContainer({ opened, onClose }: SettingsContainerProps) {
  const chat = useAppController();
  const { confirm } = useConfirmDialog();
  const { app, state } = chat;
  const busy = state.status === "running" || state.status === "aborting";
  const chimes = useChimes(app.tabs);
  const displayPath = useDisplayPath();
  
  const restartServer = useCallback(async () => {
    if (await confirm({
      title: "Restart server?",
      body: "The client is rebuilt and the server restarts. Open sessions close and the page reconnects on its own.",
      confirmLabel: "Restart",
    })) await chat.restartServer();
  }, [chat, confirm]);

  return (
    <SettingsDrawer
      opened={opened}
      onClose={onClose}
      state={state}
      busy={busy}
      renameSession={chat.renameSession}
      setThinkingLevel={chat.setThinkingLevel}
      setModel={chat.setModel}
      compactSession={chat.compactSession}
      appFeatures={app.appFeatures}
      chimesEnabled={chimes.enabled}
      setChimesEnabled={chimes.setEnabled}
      chimesAvailable={chimes.available}
      displayPathShow={displayPath.show}
      setDisplayPathShow={displayPath.setShow}
      runExtensionAction={chat.runExtensionAction}
      restartServer={restartServer}
    />
  );
}
