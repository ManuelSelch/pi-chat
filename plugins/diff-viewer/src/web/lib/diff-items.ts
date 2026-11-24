import { getSingularPatch, parseDiffFromFile, type FileDiffMetadata } from "@pierre/diffs";
import type { ChangedFile } from "../../contract.js";
import { parsePatch, type PatchLine } from "../../domain/parse-patch.js";

let snapshotSequence=0;

export interface RenderFile {file:ChangedFile;diff:FileDiffMetadata;placeholder:string|null;first:PatchLine|undefined}
export function prepareFile(file:ChangedFile):RenderFile {
  const start = file.patch.search(/^@@ /m);
  const placeholder = file.binary ? "Binary file changed. No text diff available." : start<0 ?
    file.status==="A" ? "Empty file added." : file.status==="D" ? "Empty file deleted." : "File metadata changed." : null;
  const diff = placeholder ? parseDiffFromFile({name:file.path,contents:""},{name:file.path,contents:""}) :
    getSingularPatch("--- a/patch\n+++ b/patch\n"+file.patch.slice(start));
  diff.name = file.path;
  // Stable snapshot identity; library caches don't confuse refreshes or same-named projects.
  diff.cacheKey = "pi-chat-diff-"+(++snapshotSequence);
  if (file.patch.length>128_000 || diff.unifiedLineCount>2000) diff.lang="text";
  return {file,diff,placeholder,first:placeholder ? undefined : parsePatch(file.patch).find(line=>line.old!==null || line.next!==null)};
}
