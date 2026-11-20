import type { FileOpenResult } from "@manuelselch/pi-sdk/protocol";

// Reuse the installed contract until plugin-owned protocol routing is implemented.
export { filePathSchema, fileOpenErrorCodeSchema, fileOpenResultSchema } from "@manuelselch/pi-sdk/protocol";
export type { FileOpenErrorCode, FileOpenResult } from "@manuelselch/pi-sdk/protocol";

export interface OpenFileInput {
  /** Runtime identity; never substitute the currently selected browser session. */
  sessionId: string;
  /** A path on the server machine, resolved against the runtime's directory. */
  path: string;
}

/** Proposed feature boundary, not yet registered as a remote contract. */
export interface FileOpeningContract {
  /** Success means the server OS accepted the open, not that a window appeared. */
  open(input: OpenFileInput): Promise<FileOpenResult>;
}
