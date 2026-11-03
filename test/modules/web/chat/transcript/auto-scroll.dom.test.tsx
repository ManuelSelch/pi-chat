/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAutoScroll } from "../../../../../src/web/chat/transcript/use-auto-scroll.js";

afterEach(cleanup);

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

function Harness({ followKey }: { followKey: string }) {
  const bottomRef = useAutoScroll({ sessionId: "session", followKey });
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

  beforeEach(() => {
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

  it("does not follow a restored session that is not at the bottom", async () => {
    viewport.scrollY -= 300;
    render(<Harness followKey="1" />);
    await flushFrame();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
