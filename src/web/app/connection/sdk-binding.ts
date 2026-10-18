import type { PiClient } from "@manuelselch/pi-sdk";
import type { AppAction } from "../state/app-state.js";

/** Share the same SDK-to-view boundary between React and domain integration tests. */
export function bindPiChat(client: PiClient, dispatch: (action: AppAction) => void): () => void {
  const stopState = client.subscribe((state) => {
    if (["connecting", "reconnecting", "superseded", "failed", "stopped"].includes(state.connection.phase)) dispatch({ type: "sdkState", state });
  });
  const stopMessages = client.onMessage((message) => dispatch({ type: "sdkState", state: client.getState(), message }));
  return () => { stopState(); stopMessages(); };
}
