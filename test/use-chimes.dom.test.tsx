// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import type { Tab, TabStatus } from "../src/shared/protocol.js";
import { CHIME_STORAGE_KEY, useChimes } from "../src/web/app/use-chimes.js";

const tab = (sessionId: string, status: TabStatus): Tab => ({
  sessionId,
  title: sessionId,
  projectPath: "/p",
  projectName: "p",
  status,
});

/** Records every note the hook actually schedules through Web Audio. */
function installAudio(initialState = "running"): { notes: number[]; resumes: number } {
  const notes: number[] = [];
  const counters = { notes, resumes: 0 };
  class FakeAudioContext {
    state = initialState;
    currentTime = 0;
    destination = {};
    async resume(): Promise<void> {
      counters.resumes++;
      this.state = "running";
    }
    async close(): Promise<void> {}
    createOscillator() {
      return {
        type: "",
        frequency: { value: 0 },
        connect: (node: unknown) => node,
        start: () => {},
        stop: (at: number) => notes.push(at),
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: (node: unknown) => node,
      };
    }
  }
  vi.stubGlobal("AudioContext", FakeAudioContext);
  return counters;
}

function Harness({ tabs }: { tabs: Tab[] }) {
  const chimes = useChimes(tabs);
  return (
    <button type="button" data-testid="toggle" onClick={() => chimes.setEnabled(!chimes.enabled)}>
      {String(chimes.enabled)}
    </button>
  );
}

describe("chimes while the app runs", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("plays when a run settles, once switched on", async () => {
    window.localStorage.setItem(CHIME_STORAGE_KEY, JSON.stringify(true));
    const audio = installAudio();

    // The tab list starts empty, exactly as it does before the server answers.
    const view = render(<Harness tabs={[]} />);
    await act(async () => {
      view.rerender(<Harness tabs={[tab("a", "idle")]} />);
    });
    expect(audio.notes).toHaveLength(0);

    await act(async () => {
      view.rerender(<Harness tabs={[tab("a", "running")]} />);
    });
    expect(audio.notes).toHaveLength(0);

    await act(async () => {
      view.rerender(<Harness tabs={[tab("a", "idle")]} />);
    });
    expect(audio.notes).toHaveLength(2);
  });

  it("plays when a session starts waiting on a dialog", async () => {
    window.localStorage.setItem(CHIME_STORAGE_KEY, JSON.stringify(true));
    const audio = installAudio();

    const view = render(<Harness tabs={[tab("a", "running")]} />);
    await act(async () => {
      view.rerender(<Harness tabs={[tab("a", "blocked")]} />);
    });

    expect(audio.notes).toHaveLength(2);
  });

  it("stays silent while switched off", async () => {
    const audio = installAudio();

    const view = render(<Harness tabs={[tab("a", "running")]} />);
    await act(async () => {
      view.rerender(<Harness tabs={[tab("a", "idle")]} />);
    });

    expect(audio.notes).toHaveLength(0);
  });
});

// Safari refuses to start an audio context outside a user gesture, which is
// why the very first chime was silent: the context was opened by the status
// change, not by a click. Switching the setting on has to open it.
describe("switching chimes on", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens a suspended context from the click and confirms with a chime", async () => {
    const audio = installAudio("suspended");
    const view = render(<Harness tabs={[tab("a", "idle")]} />);

    await act(async () => {
      view.getByTestId("toggle").click();
    });

    expect(audio.resumes).toBeGreaterThan(0);
    expect(audio.notes).toHaveLength(2);
  });

  it("makes the next finished run audible", async () => {
    const audio = installAudio("suspended");
    const view = render(<Harness tabs={[tab("a", "running")]} />);

    await act(async () => {
      view.getByTestId("toggle").click();
    });
    const afterPreview = audio.notes.length;

    await act(async () => {
      view.rerender(<Harness tabs={[tab("a", "idle")]} />);
    });

    expect(audio.notes.length).toBe(afterPreview + 2);
  });

  it("opens the context on the first interaction after a reload", async () => {
    // The setting is remembered, but the browser's autoplay permission is not:
    // a reload leaves the page locked again with nothing to unlock it, because
    // a run finishing is not a gesture. Every chime was then dropped until the
    // user happened to touch the settings toggle again.
    window.localStorage.setItem(CHIME_STORAGE_KEY, JSON.stringify(true));
    const audio = installAudio("suspended");

    const view = render(<Harness tabs={[tab("a", "running")]} />);
    expect(audio.resumes).toBe(0);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" }));
    });
    expect(audio.resumes).toBeGreaterThan(0);

    await act(async () => {
      view.rerender(<Harness tabs={[tab("a", "idle")]} />);
    });
    expect(audio.notes).toHaveLength(2);
  });

  it("leaves audio alone while chimes are switched off", async () => {
    const audio = installAudio("suspended");

    render(<Harness tabs={[tab("a", "running")]} />);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" }));
    });

    expect(audio.resumes).toBe(0);
  });

  it("does not chime when switching off", async () => {
    window.localStorage.setItem(CHIME_STORAGE_KEY, JSON.stringify(true));
    const audio = installAudio();
    const view = render(<Harness tabs={[tab("a", "idle")]} />);

    await act(async () => {
      view.getByTestId("toggle").click();
    });

    expect(audio.notes).toHaveLength(0);
  });
});
