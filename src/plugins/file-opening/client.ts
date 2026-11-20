import { PiClient, SDKError } from "@manuelselch/pi-sdk";
import { fileOpeningContract } from "@manuelselch/pi-sdk/plugins/file-opening";

/** App-composed adapter over the existing SDK connection, not a web plugin loader. */
export function createFileOpeningAction(client: PiClient) {
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
      client.plugin(fileOpeningContract).open({ sessionId, path }).then(result => {
        if (!result.ok) reject(new SDKError(result.error.code, result.error.message, "rejected"));
        else resolve();
      }, reject);
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
