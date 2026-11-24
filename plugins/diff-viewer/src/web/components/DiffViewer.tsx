import { Button, Text } from "@mantine/core";
import { DiffStream } from "./DiffStream.js";
import type { DiffSnapshot } from "../../contract.js";

export function DiffViewer({snapshot,message,error,onRetry,wrap}:{wrap:boolean;snapshot:DiffSnapshot|null;message:string|null;error:boolean;onRetry():void}) {
  if (!snapshot || !snapshot.files.length) return <div role={error ? "alert" : "status"} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
    <Text size="sm" c="dimmed">{message ?? "No changes"}</Text>
    {error && <Button variant="default" size="xs" onClick={onRetry}>Retry</Button>}
  </div>;
  return <DiffStream files={snapshot.files} wrap={wrap}/>;
}
