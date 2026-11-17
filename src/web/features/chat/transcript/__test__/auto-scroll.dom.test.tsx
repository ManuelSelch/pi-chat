/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoScroll } from "../hooks/use-auto-scroll.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * jsdom has no layout, so the hook's window measurements are backed by a
 * mutable viewport. Distance from the bottom is
 * `scrollHeight - scrollY - innerHeight`.
 */
const viewport = { scrollY: 0, scrollHeight: 2000, innerHeight: 1000 };

function installViewport(): void {
  Object.defineProperty(window, "innerHeight", { configurable: true, get: () => viewport.innerHeight });
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => viewport.scrollY });
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, get: () => viewport.scrollHeight });
}

function atBottom(): void {
  viewport.scrollY = viewport.scrollHeight - viewport.innerHeight;
}

function distanceFromBottom(): number {
  return viewport.scrollHeight - viewport.scrollY - viewport.innerHeight;
}

function Harness({ followKey, sessionId = "session" }: { followKey: string; sessionId?: string }) {
  const bottomRef = useAutoScroll({ sessionId, followKey });
  return <div ref={bottomRef} data-testid="bottom" />;
}

/** Let the hook's coalesced animation frame run. */
async function flushFrame(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

describe("useAutoScroll", () => {
  let scrollIntoView: ReturnType<typeof vi.spyOn>;
  let resizeTranscript: () => void;

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) {
        resizeTranscript = () => callback([], this as unknown as ResizeObserver);
      }
      observe() {}
      disconnect() {}
    });
    viewport.scrollHeight = 2000;
    viewport.innerHeight = 1000;
    installViewport();
    atBottom();
    scrollIntoView = vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(() => {});
  });

  it("follows while pinned and keeps following on updates", async () => {
    const { rerender } = render(<Harness followKey="1" />);
    await flushFrame();
    expect(scrollIntoView).toHaveBeenCalled();

    scrollIntoView.mockClear();
    rerender(<Harness followKey="2" />);
    await flushFrame();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("stops following on an upward wheel inside the bottom slack, where position alone stays near the bottom", async () => {
    const { rerender } = render(<Harness followKey="1" />);
    await flushFrame();

    // Inside the 96px follow slack, but higher than the 4px re-pin point. In
    // compact mode a burst of collapsed tool calls leaves the reader exactly
    // here, so position alone would keep pulling them down.
    viewport.scrollY -= 50;
    expect(distanceFromBottom()).toBe(50);
    fireEvent.wheel(window, { deltaY: -20 });

    scrollIntoView.mockClear();
    rerender(<Harness followKey="2" />);
    await flushFrame();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("stops following when the reader uses the keyboard to scroll up", async () => {
    const { rerender } = render(<Harness followKey="1" />);
    await flushFrame();

    viewport.scrollY -= 20;
    fireEvent.keyDown(window, { key: "ArrowUp" });

    scrollIntoView.mockClear();
    rerender(<Harness followKey="2" />);
    await flushFrame();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("re-checks follow intent in the animation frame so a scroll away before it runs wins", async () => {
    const { rerender } = render(<Harness followKey="1" />);
    await flushFrame();

    scrollIntoView.mockClear();
    rerender(<Harness followKey="2" />);
    // The frame is scheduled but has not run yet; the reader now scrolls up.
    viewport.scrollY -= 60;
    fireEvent.wheel(window, { deltaY: -20 });
    await flushFrame();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("resumes following once the reader returns to the bottom", async () => {
    const { rerender } = render(<Harness followKey="1" />);
    await flushFrame();

    viewport.scrollY -= 50;
    fireEvent.wheel(window, { deltaY: -20 });
    scrollIntoView.mockClear();
    rerender(<Harness followKey="2" />);
    await flushFrame();
    expect(scrollIntoView).not.toHaveBeenCalled();

    atBottom();
    fireEvent.scroll(window);
    rerender(<Harness followKey="3" />);
    await flushFrame();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("follows delayed transcript layout growth without another message update", async () => {
    render(<Harness followKey="1" />);
    await flushFrame();
    scrollIntoView.mockClear();

    viewport.scrollHeight += 600;
    act(() => resizeTranscript());

    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("does not follow delayed layout growth after the reader scrolls up", async () => {
    render(<Harness followKey="1" />);
    await flushFrame();
    viewport.scrollY -= 50;
    fireEvent.wheel(window, { deltaY: -20 });
    scrollIntoView.mockClear();

    viewport.scrollHeight += 600;
    act(() => resizeTranscript());

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("opens a long session at the bottom without requiring prior scroll position", async () => {
    viewport.scrollY = 0;
    render(<Harness followKey="1" />);
    await flushFrame();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("pins a newly selected session after the reader scrolled up in the previous one", async () => {
    const { rerender } = render(<Harness followKey="1" />);
    await flushFrame();
    viewport.scrollY -= 300;
    fireEvent.wheel(window, { deltaY: -300 });
    scrollIntoView.mockClear();

    rerender(<Harness sessionId="another-session" followKey="1" />);
    await flushFrame();

    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("keeps following updates after StrictMode replays mount effects", async () => {
    const { rerender } = render(<StrictMode><Harness followKey="1" /></StrictMode>);
    await flushFrame();
    scrollIntoView.mockClear();

    rerender(<StrictMode><Harness followKey="2" /></StrictMode>);
    await flushFrame();

    expect(scrollIntoView).toHaveBeenCalled();
  });
});
