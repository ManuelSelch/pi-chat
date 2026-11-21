import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

/** Shared menu modality: mouse hover is meaningful only after real pointer movement. */
export function usePointerModality() {
  const [pointerActive, setPointerActive] = useState(false);
  const position = useRef<{ x: number; y: number } | null>(null);
  const keyboardPosition = useRef<{ x: number; y: number } | null>(null);
  const reset = useCallback(() => {
    keyboardPosition.current = position.current;
    setPointerActive(false);
  }, []);

  useEffect(() => {
    const trackPointer = (event: globalThis.PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      position.current = { x: event.clientX, y: event.clientY };
    };
    document.addEventListener("pointermove", trackPointer, true);
    document.addEventListener("keydown", reset, true);
    return () => {
      document.removeEventListener("pointermove", trackPointer, true);
      document.removeEventListener("keydown", reset, true);
    };
  }, [reset]);

  const onPointerMove = useCallback((event: PointerEvent, index: number, selectedIndex: number, select: (index: number) => void) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    if (keyboardPosition.current?.x === event.clientX && keyboardPosition.current.y === event.clientY) return;
    keyboardPosition.current = null;
    setPointerActive(true);
    if (index !== selectedIndex) select(index);
  }, []);

  return { pointerActive, onPointerMove, reset };
}
