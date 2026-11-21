import { act } from "@testing-library/react";
import { vi } from "vitest";

/** Drain controlled UI lifecycle timers, committing React between each phase. */
export async function finishUiTransitions(): Promise<void> {
  for (let phase = 0; vi.getTimerCount() > 0; phase++) {
    if (phase === 100) throw new Error("UI timers did not settle after 100 lifecycle phases");
    // Commit between timer phases to exercise ordinary transition sequencing.
    // The focus regressions separately cover a deliberately batched exit.
    await act(async () => { await vi.advanceTimersToNextTimerAsync(); });
  }
}
