import { useCallback, useEffect, useRef, useState } from "react";
import { SDKError } from "@manuelselch/pi-sdk";

export interface CounterDemoState {
  count: number | null;
  status: "loading" | "ready" | "error" | "unavailable";
  busy: boolean;
  error?: string;
}
interface CounterDemoOptions {
  opened: boolean;
  connected: boolean;
  serverInstanceId?: string;
  read(): Promise<number>;
  increment(): Promise<number>;
}

/** Server-owned state: only reads may be repeated after reopening/reconnection. */
export function useCounterDemo({ opened, connected, serverInstanceId, read, increment }: CounterDemoOptions) {
  const [view, setView] = useState<CounterDemoState>({ count: null, status: "loading", busy: false });
  const generation = useRef(0);
  const pending = useRef(false);
  const canIncrement = useRef(false);

  const run = useCallback(async (action: "read" | "increment") => {
    if (!opened || !connected || pending.current || (action === "increment" && !canIncrement.current)) return;
    pending.current = true;
    canIncrement.current = false;
    const owner = ++generation.current;
    setView(previous => action === "read"
      ? { ...previous, status: "loading", busy: false, error: undefined }
      : { ...previous, busy: true, error: undefined });
    try {
      const count = await (action === "read" ? read() : increment());
      if (owner !== generation.current) return;
      canIncrement.current = true;
      setView({ count, status: "ready", busy: false });
    } catch (error) {
      if (owner !== generation.current) return;
      const unavailable = error instanceof SDKError && ["unsupportedOperation", "contractUnavailable", "contractVersionMismatch", "methodUnavailable"].includes(error.code);
      const message = action === "read" ? "Couldn't read the count. Try again."
        : error instanceof SDKError && error.outcome === "unknown" ? "Result unknown. Read the count before trying again."
          : "Couldn't increment. Read the count before trying again.";
      setView(previous => ({ ...previous, status: unavailable ? "unavailable" : "error", busy: false, error: message }));
    } finally {
      if (owner === generation.current) pending.current = false;
    }
  }, [opened, connected, read, increment]);

  useEffect(() => {
    if (opened && connected) void run("read");
    else setView(previous => ({ ...previous, busy: false }));
    return () => { ++generation.current; pending.current = false; canIncrement.current = false; };
  }, [opened, connected, serverInstanceId, run]);

  return {
    view,
    read: useCallback(() => run("read"), [run]),
    increment: useCallback(() => run("increment"), [run]),
  };
}
