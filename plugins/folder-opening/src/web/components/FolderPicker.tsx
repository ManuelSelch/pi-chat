import { useFolderPicker } from "../hooks/use-folder-picker.js";
import type { FolderPickerProps } from "../types.js";
import { FolderPickerView } from "./FolderPickerView.js";

/** Bind picker behavior to its value-and-callback view. */
export function FolderPicker(props: FolderPickerProps) {
  const picker = useFolderPicker(props);
  return <FolderPickerView {...props} {...picker} />;
}
