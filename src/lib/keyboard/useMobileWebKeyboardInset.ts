import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

const MOBILE_WEB_BREAKPOINT = 1024;
const KEYBOARD_INSET_THRESHOLD = 8;
const KEYBOARD_SYNC_DELAY_MS = 0;

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
  const maxInset = Math.round(viewportHeight * 0.65);
  return Math.max(0, Math.min(Math.round(rawInset), maxInset));
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
  const focusOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baselineViewportBottomRef = useRef(0);

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
      }, 0);

      return () => {
        clearTimeout(resetTimer);
      };
    }

    const visualViewport = window.visualViewport;

    const updateKeyboardInset = () => {
      const viewportHeight = getViewportHeight();
      const viewportBottom = getViewportBottom();

      if (viewportHeight <= 0 || viewportBottom <= 0) {
        return;
      }

      if (!hasFocusedEditableElement()) {
        baselineViewportBottomRef.current = viewportBottom;
        setKeyboardInset((currentInset) => (currentInset === 0 ? currentInset : 0));
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

      if (nextInset === 0) {
        baselineViewportBottomRef.current = viewportBottom;
      }

      setKeyboardInset((currentInset) =>
        Math.abs(currentInset - nextInset) > 1 ? nextInset : currentInset,
      );
    };

    const queueKeyboardSync = () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }

      if (KEYBOARD_SYNC_DELAY_MS === 0) {
        updateKeyboardInset();
        return;
      }

      syncTimerRef.current = setTimeout(updateKeyboardInset, KEYBOARD_SYNC_DELAY_MS);
    };

    const handleFocusIn = () => {
      queueKeyboardSync();
    };

    const handleFocusOut = () => {
      if (focusOutTimerRef.current) {
        clearTimeout(focusOutTimerRef.current);
      }

      focusOutTimerRef.current = setTimeout(() => {
        updateKeyboardInset();
      }, 0);
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

      if (focusOutTimerRef.current) {
        clearTimeout(focusOutTimerRef.current);
        focusOutTimerRef.current = null;
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
