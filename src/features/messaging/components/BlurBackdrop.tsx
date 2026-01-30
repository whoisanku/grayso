import React from "react";
import { Platform, StyleSheet } from "react-native";
import Reanimated, { useAnimatedStyle, SharedValue } from "react-native-reanimated";
import { BlurView } from "expo-blur";

type BlurBackdropProps = {
  isDark: boolean;
  opacity: SharedValue<number>;
};

/**
 * Cross-platform blur backdrop for message action modal
 * - iOS/Android: Uses expo-blur BlurView
 * - Web: Uses CSS backdrop-filter with semi-transparent overlay
 */
export function BlurBackdrop({ isDark, opacity }: BlurBackdropProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (Platform.OS === "web") {
    // Web: Use CSS backdrop-filter for blur effect
    return (
      <Reanimated.View
        style={[
          StyleSheet.absoluteFill,
          {
            // @ts-ignore - Web-specific CSS properties
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)", // Safari support
            backgroundColor: isDark
              ? "rgba(10, 15, 26, 0.75)"
              : "rgba(255, 255, 255, 0.75)",
          },
          animatedStyle,
        ]}
      />
    );
  }

  // Native: Use expo-blur BlurView
  return (
    <Reanimated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
      <BlurView
        intensity={90}
        tint={isDark ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
    </Reanimated.View>
  );
}
