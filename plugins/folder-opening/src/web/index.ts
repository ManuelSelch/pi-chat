import { definePlugin, type PluginUI } from "@manuelselch/pi-sdk/plugins";
import type { ReactNode } from "react";
import { folderOpeningContract } from "../contract.js";
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

export * from "../contract.js";
export { FolderPicker } from "./components/FolderPicker.js";
export { createFolderClient } from "./lib/folder-client.js";

/** Web definition; importing it does not mount the UI. */
export const folderOpeningPlugin = definePlugin({
  id: "folder-opening",
  provides: [folderOpeningContract],
  web: () => folderOpeningUI,
});
