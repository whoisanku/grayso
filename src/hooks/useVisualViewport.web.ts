import { useEffect, useState } from "react";

export function useVisualViewport() {
  const [viewport, setViewport] = useState(() => ({
    width: window.visualViewport?.width || window.innerWidth,
    height: window.visualViewport?.height || window.innerHeight,
    offsetTop: window.visualViewport?.offsetTop || 0,
  }));

  useEffect(() => {
    let rafId: number;

    const updateViewport = () => {
      if (rafId) cancelAnimationFrame(rafId);
      
      rafId = requestAnimationFrame(() => {
        const vv = window.visualViewport;
        const width = vv?.width || window.innerWidth;
        const height = vv?.height || window.innerHeight;
        const offsetTop = vv?.offsetTop || 0;

        setViewport({ width, height, offsetTop });

        // High-performance CSS variable sync
        document.documentElement.style.setProperty("--vvh", `${height}px`);
        document.documentElement.style.setProperty("--vvt", `${offsetTop}px`);
      });
    };

    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", updateViewport);
      vv.addEventListener("scroll", updateViewport);
    } else {
      window.addEventListener("resize", updateViewport);
    }

    updateViewport();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (vv) {
        vv.removeEventListener("resize", updateViewport);
        vv.removeEventListener("scroll", updateViewport);
      } else {
        window.removeEventListener("resize", updateViewport);
      }
    };
  }, []);

  return viewport;
}
