import { useMemo } from "react";
import { useHotkeys } from "@mantine/hooks";
import { useAppController } from "../../app/AppControllerContext.js";
import { visibleTabs } from "../../app/state/app-state.js";
import { useOverlays } from "../../app/overlays/OverlayController.js";
import { useDisplayPath } from "../../settings/preferences/use-display-path.js";
import { useSessionActions } from "../actions/SessionActionsProvider.js";
import { QuickOpen } from "./QuickOpen.js";

export function QuickOpenContainer() {
  const { app, openSession, openProject, newSession, inbox, focusTab } = useAppController();
  const { actions } = useSessionActions();
  const displayPath = useDisplayPath();
  const overlays = useOverlays();
  const opened = overlays.state.quickOpen;
  const laterPaths = useMemo(() => new Set(inbox.later.map(row => row.path)), [inbox.later]);

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
        tabs={visibleTabs(app)}
        onOpenSession={openSession}
        onFocusSession={focusTab}
        onOpenProject={openProject}
        onNewSession={(path) => { void newSession(path); }}
        actions={actions}
        laterPaths={laterPaths}
        showDisplayPath={displayPath.show}
      />
    </>
  );
}
