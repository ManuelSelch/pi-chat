import { useEffect, useLayoutEffect, useRef } from "react";

const BOTTOM_THRESHOLD_PX = 96;

function isNearBottom(): boolean {
  const { documentElement } = document;
  const remaining = documentElement.scrollHeight - window.scrollY - window.innerHeight;
  return remaining <= BOTTOM_THRESHOLD_PX;
}

export function useAutoScroll({ sessionId, followKey }: { sessionId: string; followKey: string }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const shouldFollowRef = useRef(true);
  const previousSessionIdRef = useRef(sessionId);

  function scrollToBottom(behavior: ScrollBehavior = "auto"): void {
    bottomRef.current?.scrollIntoView({ block: "end", behavior });
  }

  useEffect(() => {
    function updateShouldFollow(): void {
      shouldFollowRef.current = isNearBottom();
    }

    updateShouldFollow();
    window.addEventListener("scroll", updateShouldFollow, { passive: true });
    window.addEventListener("resize", updateShouldFollow);
    return () => {
      window.removeEventListener("scroll", updateShouldFollow);
      window.removeEventListener("resize", updateShouldFollow);
    };
  }, []);

  useLayoutEffect(() => {
    if (previousSessionIdRef.current !== sessionId) {
      previousSessionIdRef.current = sessionId;
      shouldFollowRef.current = true;
      requestAnimationFrame(() => scrollToBottom());
      return;
    }

    if (shouldFollowRef.current) {
      requestAnimationFrame(() => scrollToBottom());
    }
  }, [sessionId, followKey]);

  return bottomRef;
}
