import type { PluginUI } from "@manuelselch/pi-sdk/plugins";
import type { ReactNode } from "react";
import { FolderOpeningProvider, useOpenFolderAction, useFolderPickerOpen } from "./stores/FolderOpeningProvider.js";
import { FolderPickerContainer } from "./components/FolderPickerContainer.js";

export const folderOpeningUI: PluginUI<ReactNode> = {
  Provider: FolderOpeningProvider,
  commands: [{
    id: "folder-opening.open",
    name: "Open folder…",
    description: "Choose a folder to start a session",
    placements: ["menus", "projects"],
    useAction: useOpenFolderAction,
  }],
  Overlay: FolderPickerContainer,
  useOverlayOpen: useFolderPickerOpen,
};

export { FolderPicker } from "./components/FolderPicker.js";
export { createFolderClient } from "./lib/folder-client.js";
