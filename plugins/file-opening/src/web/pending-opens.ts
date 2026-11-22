import { SDKError, type PiClient } from "@manuelselch/pi-sdk";
import type { OpenFileInput } from "../contract.js";

/** File-link UI policy, not required plugin/RPC boilerplate. Never retries OS effects. */
export function createPendingFileOpens(client: PiClient, open: (input: OpenFileInput) => Promise<void>) {
  const waits = new Map<string, Promise<void>>();
  return (sessionId: string, path: string): Promise<void> => {
    const key = JSON.stringify([sessionId, path]);
    const existing = waits.get(key);
    if (existing) return existing;

    let unsubscribe = () => {};
    const pending = new Promise<void>((resolve, reject) => {
      let known = !!client.getSession(sessionId);
      unsubscribe = client.subscribe(state => {
        if (state.connection.phase !== "ready") return;
        if (known && !Object.hasOwn(state.sessions, sessionId))
          reject(new SDKError("cancelled", "Stopped waiting; the server outcome may be unknown. No retry was sent.", "unknown"));
        known ||= Object.hasOwn(state.sessions, sessionId);
      });
      open({ sessionId, path }).then(resolve, reject);
    });
    waits.set(key, pending);
    const release = () => {
      unsubscribe();
      if (waits.get(key) === pending) waits.delete(key);
    };
    void pending.then(release, release);
    return pending;
  };
}
