import { useState } from "react";
import { useHotkeys } from "@mantine/hooks";
import { atHome } from "../chat/app-state.js";
import { useAppController } from "../state/AppControllerContext.js";
import { QuickOpen } from "./QuickOpen.js";

export function QuickOpenContainer() {
  const { app, openSession, openProject } = useAppController();
  const [opened, setOpened] = useState(false);
  const home = atHome(app);

  useHotkeys(
    [
      ["mod+shift+O", open],
      ["mod+O", () => open],
    ],
    [],
  );

  function open() {
    if (home) return;
    setOpened(true);
  }

  return (
    <>
      <QuickOpen
        opened={opened}
        onClose={() => setOpened(false)}
        catalogue={app.catalogue}
        tabs={app.tabs}
        onOpenSession={openSession}
        onOpenProject={openProject}
      />
    </>
  );
}
