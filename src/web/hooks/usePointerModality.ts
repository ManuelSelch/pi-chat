import { useCallback, useEffect, useState, type PointerEvent } from "react";

/** Shared menu modality: mouse hover is meaningful only after real pointer movement. */
export function usePointerModality() {
  const [pointerActive, setPointerActive] = useState(false);
  const reset = useCallback(() => setPointerActive(false), []);

  useEffect(() => {
    document.addEventListener("keydown", reset, true);
    return () => document.removeEventListener("keydown", reset, true);
  }, [reset]);

  const onPointerMove = useCallback((event: PointerEvent, index: number, selectedIndex: number, select: (index: number) => void) => {
    if (event.pointerType && event.pointerType !== "mouse") return;
    setPointerActive(true);
    if (index !== selectedIndex) select(index);
  }, []);

  return { pointerActive, onPointerMove, reset };
}
