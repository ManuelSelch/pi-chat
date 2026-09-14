import { describe, expect, it } from "vitest";
import type { Tab, TabStatus } from "../src/shared/protocol.js";
import { ChimePlayer, chimesFor, statusMap } from "../src/web/app/chime.js";

const tab = (sessionId: string, status: TabStatus): Tab => ({
  sessionId,
  title: sessionId,
  projectPath: "/p",
  projectName: "p",
  status,
});

describe("which tab changes deserve a sound", () => {
  it("chimes when a running session settles", () => {
    expect(chimesFor(statusMap([tab("a", "running")]), [tab("a", "idle")])).toEqual(["finished"]);
  });

  it("chimes when a session starts waiting on a dialog", () => {
    expect(chimesFor(statusMap([tab("a", "running")]), [tab("a", "blocked")])).toEqual(["waiting"]);
  });

  // Opening the app on a finished session is not an event, and the tab list is
  // republished on every status change, so repeats must stay silent.
  it("stays quiet for a tab it has not seen before", () => {
    expect(chimesFor(new Map(), [tab("a", "idle"), tab("b", "blocked")])).toEqual([]);
  });

  it("stays quiet when nothing changed", () => {
    const before = statusMap([tab("a", "idle")]);
    expect(chimesFor(before, [tab("a", "idle")])).toEqual([]);
  });

  it("stays quiet when a prompt is answered rather than a run finishing", () => {
    expect(chimesFor(statusMap([tab("a", "blocked")]), [tab("a", "idle")])).toEqual([]);
  });

  it("reports one chime per tab that changed", () => {
    const before = statusMap([tab("a", "running"), tab("b", "running"), tab("c", "running")]);
    const after = [tab("a", "idle"), tab("b", "blocked"), tab("c", "running")];
    expect(chimesFor(before, after)).toEqual(["finished", "waiting"]);
  });
});

/** Enough of the Web Audio graph to record what a chime scheduled. */
function fakeContext(state: string, resume: () => Promise<void>) {
  const stops: number[] = [];
  const context = {
    state,
    currentTime: 0,
    destination: {},
    resume,
    createOscillator: () => ({
      type: "",
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start: () => {},
      stop: (at: number) => stops.push(at),
    }),
    createGain: () => ({
      gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: (node: unknown) => node,
    }),
    close: async () => {},
  };
  return { context, stops };
}

describe("chime player", () => {
  it("reports itself unavailable rather than throwing without Web Audio", async () => {
    const player = new ChimePlayer(undefined);
    expect(player.available).toBe(false);
    await expect(player.play("finished")).resolves.toBeUndefined();
  });

  it("swallows a browser that refuses to start audio", async () => {
    const player = new ChimePlayer(() => {
      throw new Error("not allowed");
    });
    expect(player.available).toBe(true);
    await expect(player.play("waiting")).resolves.toBeUndefined();
  });

  // Found in a real browser: resuming can reject, and swallowing that inside
  // the same try block skipped the notes entirely.
  it("still schedules the notes when the context refuses to resume", async () => {
    const { context, stops } = fakeContext("suspended", () => Promise.reject(new Error("cannot resume")));
    const player = new ChimePlayer(() => context as unknown as AudioContext);

    await player.play("waiting");

    expect(stops).toHaveLength(2);
  });

  it("resumes a suspended context and schedules both notes", async () => {
    let resumed = false;
    const { context, stops } = fakeContext("suspended", async () => {
      resumed = true;
    });

    const player = new ChimePlayer(() => context as unknown as AudioContext);
    await player.play("finished");

    expect(resumed).toBe(true);
    expect(stops).toHaveLength(2);
  });
});
