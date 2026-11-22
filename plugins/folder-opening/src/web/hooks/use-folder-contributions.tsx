import { useState, type ReactNode } from "react";
import type { WebPluginContributions, WebPluginHost } from "@manuelselch/pi-sdk/plugins";
import { FolderPickerContainer } from "../components/FolderPickerContainer.js";

export function useFolderContributions(host: WebPluginHost): WebPluginContributions<ReactNode> {
  const [opened, setOpened] = useState(false);
  return {
    commands: [{
      id: "folder-opening.open",
      name: "Open folder…",
      description: "Choose a folder to start a session",
      placements: ["menus", "projects"],
      run: () => setOpened(true),
    }],
    overlay: <FolderPickerContainer host={host} opened={opened} onClose={() => setOpened(false)} />,
    blocking: opened,
  };
}
