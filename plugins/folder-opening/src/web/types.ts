import type { ModalProps } from "@mantine/core";
import type { DirectoryBrowse, DirectoryListing } from "@manuelselch/pi-sdk/protocol";

export interface FolderPickerProps {
  returnFocus?: ModalProps["returnFocus"];
  onExitTransitionEnd?: ModalProps["onExitTransitionEnd"];
  opened: boolean;
  connected: boolean;
  initialPath?: string;
  onClose: () => void;
  browseDirectories: (request: DirectoryBrowse, signal?: AbortSignal) => Promise<DirectoryListing>;
  startSession: (path: string, signal?: AbortSignal) => Promise<string>;
}
