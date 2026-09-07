import { useEffect, useRef, useState } from "react";

export function useBoardWidth(active: boolean, max = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(Math.min(560, max));

  useEffect(() => {
    if (!active) {
      return;
    }
    let observer: ResizeObserver | undefined;
    const frame = window.requestAnimationFrame(() => {
      const node = ref.current;
      if (!node) {
        return;
      }
      const update = () => {
        setWidth(Math.max(280, Math.min(node.clientWidth, max)));
      };
      update();
      observer = new ResizeObserver(update);
      observer.observe(node);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [active, max]);

  return { ref, width };
}
