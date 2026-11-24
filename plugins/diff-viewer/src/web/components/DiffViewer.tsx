import { Button, Text } from "@mantine/core";
import { lazy, Suspense } from "react";
const DiffStream = lazy(()=>import("./DiffStream.js").then(module=>({default:module.DiffStream})));
import type { DiffSnapshot } from "../../contract.js";
import type { ReviewActions } from "../hooks/use-review.js";

export function DiffViewer({snapshot,message,error,onRetry,wrap,review}:{review?:ReviewActions;wrap:boolean;snapshot:DiffSnapshot|null;message:string|null;error:boolean;onRetry():void}) {
  if (!snapshot || !snapshot.files.length) return <div role={error ? "alert" : "status"} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
    <Text size="sm" c="dimmed">{message ?? "No changes"}</Text>
    {error && <Button variant="default" size="xs" onClick={onRetry}>Retry</Button>}
  </div>;
  return <>
    <Suspense fallback={<div role="status" className="p-4 text-xs text-(--mantine-color-dimmed)">Loading diff renderer…</div>}><DiffStream files={snapshot.files} wrap={wrap} review={review}/></Suspense>
    <footer className="flex gap-4 border-t border-(--mantine-color-default-border) px-4 py-2 text-[11px] text-(--mantine-color-dimmed)">
      <span>{snapshot.files.length} {snapshot.files.length===1 ? "file" : "files"} changed</span>
      <span className="text-(--pi-diff-added)">+{snapshot.files.reduce((sum,file)=>sum+file.added,0)}</span>
      <span className="text-(--pi-diff-removed)">−{snapshot.files.reduce((sum,file)=>sum+file.removed,0)}</span>
    </footer>
  </>;
}
