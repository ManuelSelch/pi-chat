import { useMemo } from "react";
import type { WebPluginHost } from "@manuelselch/pi-sdk/plugins";
import { createFolderOpeningPlugin } from "../lib/folder-client.js";
import { FolderPicker } from "./FolderPicker.js";

/** Plugin-owned integration: shell capabilities in, picker behavior stays here. */
export function FolderPickerContainer({ host, opened, onClose }: { host: WebPluginHost; opened: boolean; onClose(): void }) {
  const { browseDirectories } = useMemo(() => createFolderOpeningPlugin(host.request), [host.request]);
  const focusReturn = host.useOverlayFocus(opened);
  return <FolderPicker {...focusReturn} opened={opened} connected={host.connected} initialPath={host.projectPath}
    onClose={onClose} browseDirectories={browseDirectories} startSession={host.createSession} />;
}
