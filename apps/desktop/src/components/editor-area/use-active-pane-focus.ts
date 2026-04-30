import { useEffect, type RefObject } from "react";

export function useActivePaneFocus(
  containerRef: RefObject<HTMLDivElement | null>,
  isActive: boolean,
) {
  useEffect(() => {
    if (!isActive) return;
    const container = containerRef.current;
    if (!container) return;

    const frame = requestAnimationFrame(() => {
      if (containerRef.current !== container) return;
      container.querySelector<HTMLElement>(".cm-content")?.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [containerRef, isActive]);
}
