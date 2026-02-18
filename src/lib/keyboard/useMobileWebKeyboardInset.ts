import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const MOBILE_WEB_BREAKPOINT = 1024;
const KEYBOARD_INSET_THRESHOLD = 4;
const KEYBOARD_SYNC_DELAY_MS = 0;
const FOCUS_INSET_PRIME_RATIO = 0.45;
const FOCUS_INSET_PRIME_MAX = 72;
const FOCUS_OUT_TRACKING_MS = 280;

function isEditableElement(element: Element | null): boolean {
  if (!element) {
    return false;
  }

  const htmlElement = element as HTMLElement;
  const tagName = htmlElement.tagName;

  if (htmlElement.isContentEditable) {
    return true;
  }

  if (tagName !== "INPUT" && tagName !== "TEXTAREA") {
    return false;
  }

  const input = htmlElement as HTMLInputElement;
  const type = input.type?.toLowerCase() ?? "text";

  return type !== "button" && type !== "checkbox" && type !== "radio";
}

function hasFocusedEditableElement(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return isEditableElement(document.activeElement);
}

function clampKeyboardInset(rawInset: number, viewportHeight: number): number {
  const maxInset = viewportHeight * 0.65;
  return Math.max(0, Math.min(rawInset, maxInset));
}

function getViewportHeight(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  return window.visualViewport?.height ?? window.innerHeight;
}

function getViewportBottom(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const visualViewport = window.visualViewport;
  if (visualViewport) {
    return visualViewport.offsetTop + visualViewport.height;
  }

  return window.innerHeight;
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
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineViewportBottomRef = useRef(0);
  const lastKnownKeyboardInsetRef = useRef(0);
  const keyboardInsetRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const trackUntilRef = useRef(0);

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
      baselineViewportBottomRef.current = 0;
      const resetTimer = setTimeout(() => {
        setKeyboardInset(0);
        keyboardInsetRef.current = 0;
      }, 0);

      return () => {
        clearTimeout(resetTimer);
      };
    }

    const visualViewport = window.visualViewport;

    const setKeyboardInsetValue = (nextInset: number) => {
      keyboardInsetRef.current = nextInset;
      setKeyboardInset((currentInset) =>
        Math.abs(currentInset - nextInset) > 0.25 ? nextInset : currentInset,
      );
    };

    const updateKeyboardInset = () => {
      const viewportHeight = getViewportHeight();
      const viewportBottom = getViewportBottom();

      if (viewportHeight <= 0 || viewportBottom <= 0) {
        return;
      }

      if (!hasFocusedEditableElement()) {
        baselineViewportBottomRef.current = viewportBottom;
        setKeyboardInsetValue(0);
        return;
      }

      if (baselineViewportBottomRef.current <= 0) {
        baselineViewportBottomRef.current = viewportBottom;
      }

      if (viewportBottom > baselineViewportBottomRef.current) {
        baselineViewportBottomRef.current = viewportBottom;
      }

      const rawInset = baselineViewportBottomRef.current - viewportBottom;
      const nextInset =
        rawInset > KEYBOARD_INSET_THRESHOLD
          ? clampKeyboardInset(rawInset, viewportHeight)
          : 0;

      if (nextInset > 0) {
        lastKnownKeyboardInsetRef.current = nextInset;
      }

      if (nextInset === 0) {
        baselineViewportBottomRef.current = viewportBottom;
      }

      setKeyboardInsetValue(nextInset);
    };

    const shouldKeepRafTracking = () => {
      const now = Date.now();
      return (
        hasFocusedEditableElement() ||
        keyboardInsetRef.current > 0 ||
        now < trackUntilRef.current
      );
    };

    const runRafFrame = () => {
      rafIdRef.current = null;
      updateKeyboardInset();

      if (!shouldKeepRafTracking()) {
        return;
      }

      rafIdRef.current = window.requestAnimationFrame(runRafFrame);
    };

    const startRafTracking = () => {
      if (rafIdRef.current !== null) {
        return;
      }

      rafIdRef.current = window.requestAnimationFrame(runRafFrame);
    };

    const queueKeyboardSync = () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }

      if (KEYBOARD_SYNC_DELAY_MS === 0) {
        updateKeyboardInset();
        startRafTracking();
        return;
      }

      syncTimerRef.current = setTimeout(() => {
        updateKeyboardInset();
        startRafTracking();
      }, KEYBOARD_SYNC_DELAY_MS);
    };

    const handleFocusIn = () => {
      if (hasFocusedEditableElement() && lastKnownKeyboardInsetRef.current > 0) {
        const primedInset = Math.min(
          FOCUS_INSET_PRIME_MAX,
          lastKnownKeyboardInsetRef.current * FOCUS_INSET_PRIME_RATIO,
        );
        setKeyboardInset((currentInset) => {
          if (currentInset > 0) {
            return currentInset;
          }

          keyboardInsetRef.current = primedInset;
          return primedInset;
        });
      }

      queueKeyboardSync();
    };

    const handleFocusOut = () => {
      trackUntilRef.current = Date.now() + FOCUS_OUT_TRACKING_MS;
      queueKeyboardSync();
    };

    queueKeyboardSync();

    visualViewport?.addEventListener("resize", queueKeyboardSync);
    visualViewport?.addEventListener("scroll", queueKeyboardSync);
    window.addEventListener("resize", queueKeyboardSync);
    window.addEventListener("orientationchange", queueKeyboardSync);
    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);

    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }

      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      visualViewport?.removeEventListener("resize", queueKeyboardSync);
      visualViewport?.removeEventListener("scroll", queueKeyboardSync);
      window.removeEventListener("resize", queueKeyboardSync);
      window.removeEventListener("orientationchange", queueKeyboardSync);
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, [isMobileWeb]);

  return {
    keyboardInset,
    isKeyboardVisible: keyboardInset > 0,
    isMobileWeb,
  };
}
