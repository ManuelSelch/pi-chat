import { useEffect, useLayoutEffect, useRef } from "react";

// Slack while following; re-pinning after the reader takes over requires
// actually reaching the bottom, so a small nudge up is not undone by the next
// event.
const FOLLOW_THRESHOLD_PX = 96;
const REPIN_THRESHOLD_PX = 4;

function distanceFromBottom(): number {
  const { documentElement } = document;
  return documentElement.scrollHeight - window.scrollY - window.innerHeight;
}

export function useAutoScroll({ sessionId, followKey }: { sessionId: string; followKey: string }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const shouldFollowRef = useRef(true);
  const previousSessionIdRef = useRef(sessionId);
  const frameRef = useRef<number | null>(null);

  function scrollToBottom(): void {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
  }

  useLayoutEffect(() => {
    function schedule(): void {
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        // The reader may have scrolled away between the effect and the frame;
        // without this re-check a compact burst yanks them back repeatedly.
        if (shouldFollowRef.current) scrollToBottom();
      });
    }

    if (previousSessionIdRef.current !== sessionId) {
      previousSessionIdRef.current = sessionId;
      shouldFollowRef.current = true;
      schedule();
      return;
    }

    if (shouldFollowRef.current) schedule();
  }, [sessionId, followKey]);

  useEffect(() => {
    // Position alone cannot end following in compact mode: a burst of collapsed
    // tool calls barely grows the page, so the reader stays inside the follow
    // slack and every update pulls them back. Real input intent ends it instead.
    function release(): void {
      shouldFollowRef.current = false;
    }
    function handleScroll(): void {
      const distance = distanceFromBottom();
      if (distance <= REPIN_THRESHOLD_PX) shouldFollowRef.current = true;
      else if (distance > FOLLOW_THRESHOLD_PX) shouldFollowRef.current = false;
    }
    function handleWheel(event: WheelEvent): void {
      if (event.deltaY < 0) release();
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home") release();
    }
    let lastTouchY: number | null = null;
    function handleTouchStart(event: TouchEvent): void {
      lastTouchY = event.touches[0]?.clientY ?? null;
    }
    function handleTouchMove(event: TouchEvent): void {
      const y = event.touches[0]?.clientY ?? null;
      if (y !== null && lastTouchY !== null && y > lastTouchY) release();
      lastTouchY = y;
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  return bottomRef;
}
