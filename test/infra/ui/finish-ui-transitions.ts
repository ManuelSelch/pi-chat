import { act } from "@testing-library/react";
import { vi } from "vitest";

/** Drain controlled UI lifecycle timers, committing React between each phase. */
export async function finishUiTransitions(): Promise<void> {
  for (let phase = 0; vi.getTimerCount() > 0; phase++) {
    if (phase === 100) throw new Error("UI timers did not settle after 100 lifecycle phases");
    // A single large advance batches React commits: a post-exit animation frame
    // would then run against the old DOM, unlike in a browser event loop.
    await act(async () => { await vi.advanceTimersToNextTimerAsync(); });
  }
}
