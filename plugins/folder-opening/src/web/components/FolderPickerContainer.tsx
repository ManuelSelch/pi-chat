import { useMemo } from "react";
import { useFolderOpening } from "../stores/FolderOpeningProvider.js";
import { createFolderClient } from "../lib/folder-client.js";
import { FolderPicker } from "./FolderPicker.js";

/** Plugin-owned integration: shell capabilities in, picker behavior stays here. */
export function FolderPickerContainer() {
  const { host, opened, close } = useFolderOpening();
  const { browseDirectories } = useMemo(() => createFolderClient(host.request), [host.request]);
  const focusReturn = host.useOverlayFocus(opened);
  return <FolderPicker {...focusReturn} opened={opened} connected={host.connected} initialPath={host.projectPath}
    onClose={close} browseDirectories={browseDirectories} startSession={host.createSession} />;
}
