import type { Tab, TabStatus } from "../../shared/protocol.js";

/**
 * Two beeps do not justify a dependency. Howler and friends exist to schedule
 * and mix audio files; these tones are synthesised, so there is nothing to
 * fetch, nothing to bundle, and the app keeps working offline.
 */
export type Chime = "finished" | "waiting";

/** A rising pair reads as "done", a lower insistent pair as "your turn". */
const TONES: Record<Chime, { frequency: number; delay: number }[]> = {
  finished: [
    { frequency: 660, delay: 0 },
    { frequency: 880, delay: 0.12 },
  ],
  waiting: [
    { frequency: 520, delay: 0 },
    { frequency: 415, delay: 0.16 },
  ],
};

const NOTE_SECONDS = 0.14;

type ContextFactory = () => AudioContext;

/** Safari needed the prefix until 14.1, and still exposes it. */
function defaultContextFactory(): ContextFactory | undefined {
  const candidate =
    typeof globalThis.AudioContext === "function"
      ? globalThis.AudioContext
      : (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return typeof candidate === "function" ? () => new candidate() : undefined;
}

/**
 * Browsers refuse to start audio before the page has been interacted with, and
 * a context created too early is left suspended.
 *
 * Safari is the strict case: it only lets a context start from inside a user
 * gesture, and resuming one later has no effect. A chime therefore announces
 * something that happens on its own, which is never a gesture, so the context
 * has to be opened by `unlock()` while the user is switching the setting on.
 */
export class ChimePlayer {
  private context?: AudioContext;

  constructor(private readonly createContext: ContextFactory | undefined = defaultContextFactory()) {}

  get available(): boolean {
    return this.createContext !== undefined;
  }

  /** Whether a chime would be heard right now, rather than queued or dropped. */
  get running(): boolean {
    return this.context?.state === "running";
  }

  /**
   * Call from a click handler. Opening the context here is what makes the very
   * first chime audible; without it Safari drops it and only later ones, after
   * some unrelated click, come through.
   *
   * Safe to call on every gesture: once the context runs this costs nothing, so
   * the caller can keep it armed instead of guessing which gesture counts.
   */
  async unlock(): Promise<void> {
    if (!this.createContext || this.running) return;
    try {
      this.context ??= this.createContext();
      if (this.context.state !== "running") await this.context.resume();
    } catch {
      // Nothing to do: the next chime simply stays silent.
    }
  }

  async play(chime: Chime): Promise<void> {
    if (!this.createContext) return;
    try {
      this.context ??= this.createContext();
      const context = this.context;
      // Resuming is best-effort and deliberately separate: a context that
      // refuses to start must not stop the notes being scheduled, or a browser
      // still waiting for its first gesture would silently drop every chime.
      if (context.state === "suspended") await context.resume().catch(() => {});
      const start = context.currentTime;
      for (const note of TONES[chime]) this.note(context, note.frequency, start + note.delay);
    } catch {
      // A blocked or unavailable audio device must never break the transcript.
    }
  }

  /** Released with a short ramp, because a square-edged gain change clicks. */
  private note(context: AudioContext, frequency: number, at: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.12, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + NOTE_SECONDS);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + NOTE_SECONDS);
  }

  close(): void {
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }
}

/**
 * Which chimes a tab-list update deserves. Kept separate from the audio so the
 * interesting half is testable without a browser: only real transitions count,
 * so a tab that was already idle on load stays quiet, and a repeated tab list
 * cannot chime twice.
 */
export function chimesFor(previous: Map<string, TabStatus>, tabs: Tab[]): Chime[] {
  const chimes: Chime[] = [];
  for (const tab of tabs) {
    const before = previous.get(tab.sessionId);
    // A tab seen for the first time reports no transition: opening the app with
    // a finished session is not an event.
    if (before === undefined || before === tab.status) continue;
    if (tab.status === "blocked") chimes.push("waiting");
    // Any settled session counts as finished, including one that goes straight
    // from a dialog to idle. Requiring the predecessor to be "running" dropped
    // the chime whenever the browser never saw a status between the two, which
    // is easy: the tab list is republished per event, and two of them arriving
    // together are one render. Missing the end of a run is worse than the odd
    // sound after a dialog is dismissed.
    else if (tab.status === "idle") chimes.push("finished");
  }
  return chimes;
}

export function statusMap(tabs: Tab[]): Map<string, TabStatus> {
  return new Map(tabs.map((tab) => [tab.sessionId, tab.status]));
}
