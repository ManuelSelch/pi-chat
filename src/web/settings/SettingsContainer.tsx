import { useCallback } from "react";
import { useAppController } from "../app/AppControllerContext.js";
import { useOverlays } from "../app/overlays/OverlayController.js";
import { useConfirmDialog } from "../ui/confirm/ConfirmDialogProvider.js";
import { useChimes } from "./preferences/use-chimes.js";
import { useDisplayPath } from "./preferences/use-display-path.js";
import { SettingsDrawer } from "./SettingsDrawer.js";

export function SettingsContainer() {
  const chat = useAppController();
  const { confirm } = useConfirmDialog();
  const overlays = useOverlays();
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
      opened={overlays.state.settings}
      onClose={() => overlays.close("settings")}
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
