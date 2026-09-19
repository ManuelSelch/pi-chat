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

  // Deliberately changed: this used to stay quiet, on the grounds that
  // answering a dialog is the user's own doing. It also silenced a run that
  // genuinely ended while the browser's last sighting was the dialog, which is
  // the case worth hearing.
  it("chimes when a session settles straight out of a dialog", () => {
    expect(chimesFor(statusMap([tab("a", "blocked")]), [tab("a", "idle")])).toEqual(["finished"]);
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
  const starts: number[] = [];
  const context = {
    state,
    currentTime: 0,
    baseLatency: 0.01,
    destination: {},
    resume,
    createOscillator: () => ({
      type: "",
      frequency: { value: 0 },
      connect: (node: unknown) => node,
      start: (at: number) => starts.push(at),
      stop: (at: number) => stops.push(at),
    }),
    createGain: () => ({
      gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: (node: unknown) => node,
    }),
    close: async () => {},
  };
  return { context, stops, starts };
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

  // Found in a real browser: a context created for the chime reports
  // `currentTime === 0` while its output device is still starting, which on
  // Bluetooth output outlasts the phrase. Scheduling from that clock put both
  // notes in the past and they were dropped in silence.
  it("schedules the first note ahead of the clock, not on it", async () => {
    const { context, starts } = fakeContext("running", async () => {});
    const player = new ChimePlayer(() => context as unknown as AudioContext);

    await player.play("finished");

    expect(starts).toHaveLength(2);
    expect(starts[0]).toBeGreaterThan(context.currentTime + context.baseLatency);
  });

  // Safari only starts a context from inside a gesture, so switching the
  // setting on has to open it; otherwise the first chime is lost.
  it("opens and resumes the context when unlocked", async () => {
    let resumed = false;
    const { context } = fakeContext("suspended", async () => {
      resumed = true;
      context.state = "running";
    });
    const player = new ChimePlayer(() => context as unknown as AudioContext);

    await player.unlock();

    expect(resumed).toBe(true);
    expect(context.state).toBe("running");
  });

  it("reuses the unlocked context for the next chime", async () => {
    let created = 0;
    const { context, stops } = fakeContext("suspended", async () => {});
    const player = new ChimePlayer(() => {
      created++;
      return context as unknown as AudioContext;
    });

    await player.unlock();
    await player.play("finished");

    expect(created).toBe(1);
    expect(stops).toHaveLength(2);
  });

  // The unlock listener fires on every click and keystroke, so repeating it
  // must not cost a resume call or reopen anything.
  it("does nothing once the context already runs", async () => {
    let resumes = 0;
    const { context } = fakeContext("suspended", async () => {
      resumes++;
      context.state = "running";
    });
    const player = new ChimePlayer(() => context as unknown as AudioContext);

    await player.unlock();
    expect(player.running).toBe(true);
    await player.unlock();
    await player.unlock();

    expect(resumes).toBe(1);
  });

  it("reports itself as not running before anything opened a context", () => {
    expect(new ChimePlayer(() => fakeContext("running", async () => {}).context as unknown as AudioContext).running).toBe(false);
  });

  it("survives a browser that refuses to unlock", async () => {
    const player = new ChimePlayer(() => {
      throw new Error("not allowed");
    });
    await expect(player.unlock()).resolves.toBeUndefined();
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
