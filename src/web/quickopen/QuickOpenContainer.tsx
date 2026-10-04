import { useHotkeys } from "@mantine/hooks";
import { atHome } from "../app/state/app-state.js";
import { useAppController } from "../app/AppControllerContext.js";
import { useOverlays } from "../app/overlays/OverlayController.js";
import { QuickOpen } from "./QuickOpen.js";

export function QuickOpenContainer() {
  const { app, openSession, openProject } = useAppController();
  const overlays = useOverlays();
  const opened = overlays.state.quickOpen;
  const home = atHome(app);

  useHotkeys(
    [
      ["mod+shift+O", () => { if (!home) overlays.open("quickOpen"); }],
      ["mod+O", () => { if (!home) overlays.open("quickOpen"); }],
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
      />
    </>
  );
}
