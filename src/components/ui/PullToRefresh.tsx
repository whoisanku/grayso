import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  View,
} from "react-native";
import { useAccentColor } from "@/state/theme/useAccentColor";

const PULL_THRESHOLD = 80;
const MAX_PULL_DISTANCE = 140;
const INDICATOR_SIZE = 36;

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<unknown>;
  isRefreshing: boolean;
  /** Whether the pull-to-refresh gesture is enabled. Defaults to true. */
  enabled?: boolean;
}

/**
 * Pull-to-refresh wrapper for web / PWA.
 *
 * On native (iOS/Android) this is a transparent pass-through because
 * `RefreshControl` on `FlashList` already handles it.
 *
 * On web it intercepts touch / pointer events and shows a
 * pull-down indicator + spinner when the inner scroll container is
 * at the top.
 */
export function PullToRefresh({
  children,
  onRefresh,
  isRefreshing,
  enabled = true,
}: PullToRefreshProps) {
  /* ── Native: just render children ── */
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <WebPullToRefresh
      onRefresh={onRefresh}
      isRefreshing={isRefreshing}
      enabled={enabled}
    >
      {children}
    </WebPullToRefresh>
  );
}

/* ────────────────────────────────────────────────────────── */
/* Web-only implementation using native DOM event listeners   */
/* ────────────────────────────────────────────────────────── */

function WebPullToRefresh({
  children,
  onRefresh,
  isRefreshing,
  enabled,
}: PullToRefreshProps) {
  const { isDark } = useAccentColor();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const refreshingLockRef = useRef(false);
  const pullDistanceRef = useRef(0);

  const [pullDistance, setPullDistance] = useState(0);
  const [spinAnim] = useState(() => new Animated.Value(0));
  const [isRefreshingLocal, setIsRefreshingLocal] = useState(false);

  const showRefreshing = isRefreshing || isRefreshingLocal;

  // Keep onRefresh in a ref so the event listener closure always sees the latest
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  /* Spin the indicator while refreshing */
  useEffect(() => {
    if (showRefreshing) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [showRefreshing, spinAnim]);

  /* Check if any element from target up to boundary is scrolled down */
  const checkIsAtTop = useCallback(
    (target: HTMLElement | null, boundary: HTMLElement): boolean => {
      let current = target;
      while (current && current !== boundary.parentElement) {
        if (current.scrollTop > 0) {
          return false;
        }
        current = current.parentElement;
      }
      return true;
    },
    [],
  );

  /* Attach native DOM listeners (avoids RN type conflicts) */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (refreshingLockRef.current) return;

      if (checkIsAtTop(e.target as HTMLElement, container)) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || refreshingLockRef.current) return;

      const clientY = e.touches[0].clientY;
      const delta = clientY - startYRef.current;

      // Fast exit if dragging up (scrolling down the list) and not currently pulling
      if (delta <= 0 && !isPullingRef.current) return;

      const isAtTop = checkIsAtTop(e.target as HTMLElement, container);

      if (delta > 0 && isAtTop) {
        // Apply resistance curve
        const dampened = Math.min(MAX_PULL_DISTANCE, delta * 0.45);
        isPullingRef.current = true;
        pullDistanceRef.current = dampened;
        setPullDistance(dampened);

        // Prevent native scroll while pulling
        if (dampened > 10 && e.cancelable) {
          e.preventDefault();
        }
      } else if (isPullingRef.current && (delta <= 0 || !isAtTop)) {
        pullDistanceRef.current = 0;
        setPullDistance(0);
        isPullingRef.current = false;
        startYRef.current = null;
      }
    };

    const handleTouchEnd = () => {
      const distance = pullDistanceRef.current;

      if (distance >= PULL_THRESHOLD && !refreshingLockRef.current) {
        // Trigger refresh
        refreshingLockRef.current = true;
        setIsRefreshingLocal(true);
        pullDistanceRef.current = PULL_THRESHOLD * 0.6;
        setPullDistance(PULL_THRESHOLD * 0.6);

        onRefreshRef.current().finally(() => {
          refreshingLockRef.current = false;
          setIsRefreshingLocal(false);
          pullDistanceRef.current = 0;
          setPullDistance(0);
        });
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }

      startYRef.current = null;
      isPullingRef.current = false;
    };

    // Use { passive: false } on touchmove so we can call preventDefault
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, checkIsAtTop]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const spinnerColor = isDark ? "#e2e8f0" : "#475569";

  const spinRotation = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View
      // @ts-ignore – we need a ref to the underlying DOM node on web
      ref={containerRef}
      className="flex-1"
    >
      {/* Pull indicator */}
      {(pullDistance > 0 || showRefreshing) && (
        <View
          style={{
            height: pullDistance > 0 ? pullDistance : PULL_THRESHOLD * 0.6,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {showRefreshing ? (
            <Animated.View
              style={{
                transform: [{ rotate: spinRotation }],
              }}
            >
              <ActivityIndicator size="small" color={spinnerColor} />
            </Animated.View>
          ) : (
            <View
              style={{
                width: INDICATOR_SIZE,
                height: INDICATOR_SIZE,
                borderRadius: INDICATOR_SIZE / 2,
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(0,0,0,0.05)",
                alignItems: "center",
                justifyContent: "center",
                opacity: progress,
                transform: [{ rotate: `${progress * 180}deg` }],
              }}
            >
              <ArrowIcon color={spinnerColor} />
            </View>
          )}
        </View>
      )}

      {children}
    </View>
  );
}

/* ── Tiny arrow icon using View borders ── */

function ArrowIcon({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderTopColor: color,
      }}
    />
  );
}
