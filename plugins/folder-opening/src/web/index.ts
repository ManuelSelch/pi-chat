import type { WebPlugin } from "@manuelselch/pi-sdk/plugins";
import type { ReactNode } from "react";
import { useFolderContributions } from "./hooks/use-folder-contributions.js";

export const folderOpeningWebPlugin: WebPlugin<ReactNode> = { id: "folder-opening", useContributions: useFolderContributions };

export { FolderPicker } from "./components/FolderPicker.js";
export { createFolderOpeningPlugin } from "./lib/folder-client.js";
