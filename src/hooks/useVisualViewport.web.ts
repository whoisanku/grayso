import { useEffect, useState } from "react";

export function useVisualViewport() {
  const [viewport, setViewport] = useState(() => ({
    width: window.visualViewport?.width || window.innerWidth,
    height: window.visualViewport?.height || window.innerHeight,
    offsetTop: window.visualViewport?.offsetTop || 0,
  }));

  useEffect(() => {
    const updateViewport = () => {
      const newViewport = {
        width: window.visualViewport?.width || window.innerWidth,
        height: window.visualViewport?.height || window.innerHeight,
        offsetTop: window.visualViewport?.offsetTop || 0,
      };
      setViewport(newViewport);

      // Update CSS variables
      document.documentElement.style.setProperty(
        "--svh",
        `${newViewport.height}px`
      );
      document.documentElement.style.setProperty(
        "--svw",
        `${newViewport.width}px`
      );
      document.documentElement.style.setProperty(
        "--svo",
        `${newViewport.offsetTop}px`
      );
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
