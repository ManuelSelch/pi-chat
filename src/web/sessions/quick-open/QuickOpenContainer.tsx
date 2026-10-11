import { useHotkeys } from "@mantine/hooks";
import { useAppController } from "../../app/AppControllerContext.js";
import { useOverlays } from "../../app/overlays/OverlayController.js";
import { QuickOpen } from "./QuickOpen.js";

export function QuickOpenContainer() {
  const { app, state, newSession, openSession, openProject } = useAppController();
  const overlays = useOverlays();
  const opened = overlays.state.quickOpen;

  useHotkeys(
    [
      ["mod+shift+O", () => overlays.open("quickOpen")],
      ["mod+O", () => overlays.open("quickOpen")],
    ],
    [],
  );

  return (
    <>
      <QuickOpen
        opened={opened}
        onClose={() => overlays.close("quickOpen")}
        catalogue={app.catalogue}
        tabs={app.tabs}
        onOpenSession={openSession}
        onOpenProject={openProject}
        onNewSession={() => newSession(state.projectPath || undefined)}
        onOpenFolder={() => overlays.open("folderPicker")}
        onOpenSettings={() => overlays.open("settings")}
      />
    </>
  );
}
