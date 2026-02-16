import React, { useEffect } from "react";
import {
  Platform,
  type StyleProp,
  type ViewStyle,
  type DimensionValue,
  View,
} from "react-native";
import { useColorScheme } from "nativewind";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

// ─── Types ──────────────────────────────────────────
type ShimmerProps = {
  /** Width of the skeleton. Number (px) or DimensionValue ('100%'). Default '100%' */
  width?: DimensionValue;
  /** Height of the skeleton. Number (px). Default 16 */
  height?: number;
  /** Border radius. Default 8 */
  borderRadius?: number;
  /** NativeWind className for extra styling */
  className?: string;
  /** Inline style overrides */
  style?: StyleProp<ViewStyle>;
};

// ─── Web shimmer (CSS keyframes injected once) ──────
const SHIMMER_CSS_INJECTED = { done: false };

function injectShimmerCSS() {
  if (SHIMMER_CSS_INJECTED.done) return;
  SHIMMER_CSS_INJECTED.done = true;

  const css = `
@keyframes shimmer-slide {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

function WebShimmer({
  width = "100%",
  height = 16,
  borderRadius = 8,
  className,
  style,
}: ShimmerProps) {
  useEffect(() => {
    injectShimmerCSS();
  }, []);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const baseColor = isDark ? "rgba(51, 65, 85, 0.5)" : "rgba(226, 232, 240, 0.7)";
  const highlightColor = isDark ? "rgba(71, 85, 105, 0.6)" : "rgba(241, 245, 249, 0.9)";

  return (
    <View
      className={className}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundImage: `linear-gradient(90deg, ${baseColor} 0%, ${highlightColor} 50%, ${baseColor} 100%)`,
          backgroundSize: "800px 100%",
          animationName: "shimmer-slide",
          animationDuration: "1.5s",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
        } as any,
        style,
      ]}
    />
  );
}

// ─── Native shimmer (Reanimated opacity pulse) ──────
function NativeShimmer({
  width = "100%",
  height = 16,
  borderRadius = 8,
  className,
  style,
}: ShimmerProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.set(
      withRepeat(
        withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
  }));

  return (
    <View
      className={className}
      style={[
        {
          width,
          height,
          borderRadius,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            flex: 1,
            backgroundColor: isDark ? "rgba(51, 65, 85, 0.6)" : "rgba(203, 213, 225, 0.6)",
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

// ─── Export ──────────────────────────────────────────
export function Shimmer(props: ShimmerProps) {
  if (Platform.OS === "web") {
    return <WebShimmer {...props} />;
  }
  return <NativeShimmer {...props} />;
}
