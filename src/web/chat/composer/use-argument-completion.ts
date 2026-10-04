import { useEffect, useRef, useState } from "react";
import type { CommandCompletionItem } from "../../../shared/protocol.js";
import type { ArgumentContext } from "./argument-completion.js";

type Complete = (sessionId: string, commandName: string, prefix: string, signal?: AbortSignal) => Promise<CommandCompletionItem[]>;

export function useArgumentCompletion(sessionId: string, input: string, context: ArgumentContext | undefined, complete: Complete) {
  const key = context ? JSON.stringify([sessionId, input, context.end]) : undefined;
  const currentKey = useRef(key);
  currentKey.current = key;
  const [result, setResult] = useState<{ key: string; items: CommandCompletionItem[] }>();
  const commandName = context?.commandName;
  const prefix = context?.argumentPrefix;

  useEffect(() => {
    setResult(undefined);
    if (!key || !commandName || prefix === undefined) return;
    const abort = new AbortController();
    complete(sessionId, commandName, prefix, abort.signal).then(
      (items) => { if (!abort.signal.aborted && currentKey.current === key) setResult({ key, items }); },
      () => { /* Completion failure does not fail the chat. */ },
    );
    return () => abort.abort();
  }, [key, sessionId, commandName, prefix, complete]);

  return result && result.key === key ? result.items : [];
}
