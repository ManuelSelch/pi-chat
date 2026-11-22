import { useFolderPicker } from "../hooks/use-folder-picker.js";
import type { FolderPickerProps } from "../types.js";
import { FolderPickerView } from "./FolderPickerView.js";

/** App-composed container with explicit browsing, session and focus dependencies. */
export function FolderPicker(props: FolderPickerProps) {
  const picker = useFolderPicker(props);
  return <FolderPickerView {...props} {...picker} />;
}
