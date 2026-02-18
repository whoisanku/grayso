import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const MOBILE_WEB_BREAKPOINT = 1024;
const KEYBOARD_INSET_THRESHOLD = 80;
const ORIENTATION_RESET_DELAY_MS = 220;

function getViewportHeight(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  return window.visualViewport?.height ?? window.innerHeight;
}

function isLikelyMobileWebDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const coarsePointer =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(pointer: coarse)").matches
      : false;

  return coarsePointer || window.innerWidth < MOBILE_WEB_BREAKPOINT;
}

export function useMobileWebKeyboardInset() {
  const [isMobileWeb, setIsMobileWeb] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const baselineViewportHeightRef = useRef(0);
  const orientationResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return;
    }

    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)")
        : null;

    const updateDeviceType = () => {
      setIsMobileWeb(isLikelyMobileWebDevice());
    };

    updateDeviceType();

    if (mediaQuery) {
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", updateDeviceType);
      } else if (typeof mediaQuery.addListener === "function") {
        mediaQuery.addListener(updateDeviceType);
      }
    }

    window.addEventListener("resize", updateDeviceType);

    return () => {
      if (mediaQuery) {
        if (typeof mediaQuery.removeEventListener === "function") {
          mediaQuery.removeEventListener("change", updateDeviceType);
        } else if (typeof mediaQuery.removeListener === "function") {
          mediaQuery.removeListener(updateDeviceType);
        }
      }

      window.removeEventListener("resize", updateDeviceType);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !isMobileWeb) {
      baselineViewportHeightRef.current = 0;
      const resetTimer = setTimeout(() => {
        setKeyboardInset(0);
      }, 0);

      return () => {
        clearTimeout(resetTimer);
      };
    }

    const visualViewport = window.visualViewport;

    const updateKeyboardInset = () => {
      const viewportHeight = getViewportHeight();

      if (viewportHeight <= 0) {
        return;
      }

      if (
        baselineViewportHeightRef.current <= 0 ||
        viewportHeight > baselineViewportHeightRef.current
      ) {
        baselineViewportHeightRef.current = viewportHeight;
      }

      const rawInset = baselineViewportHeightRef.current - viewportHeight;
      const nextInset =
        rawInset > KEYBOARD_INSET_THRESHOLD ? Math.round(rawInset) : 0;

      setKeyboardInset((currentInset) =>
        Math.abs(currentInset - nextInset) > 1 ? nextInset : currentInset,
      );
    };

    const resetBaselineAndSync = () => {
      baselineViewportHeightRef.current = getViewportHeight();
      updateKeyboardInset();
    };

    const handleOrientationChange = () => {
      if (orientationResetTimerRef.current) {
        clearTimeout(orientationResetTimerRef.current);
      }

      orientationResetTimerRef.current = setTimeout(() => {
        resetBaselineAndSync();
      }, ORIENTATION_RESET_DELAY_MS);
    };

    resetBaselineAndSync();

    visualViewport?.addEventListener("resize", updateKeyboardInset);
    visualViewport?.addEventListener("scroll", updateKeyboardInset);
    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("focusin", updateKeyboardInset);
    window.addEventListener("focusout", updateKeyboardInset);

    return () => {
      if (orientationResetTimerRef.current) {
        clearTimeout(orientationResetTimerRef.current);
        orientationResetTimerRef.current = null;
      }

      visualViewport?.removeEventListener("resize", updateKeyboardInset);
      visualViewport?.removeEventListener("scroll", updateKeyboardInset);
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("focusin", updateKeyboardInset);
      window.removeEventListener("focusout", updateKeyboardInset);
    };
  }, [isMobileWeb]);

  return {
    keyboardInset,
    isKeyboardVisible: keyboardInset > 0,
    isMobileWeb,
  };
}
