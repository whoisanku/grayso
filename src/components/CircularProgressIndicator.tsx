import React from "react";
import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  withTiming,
  useDerivedValue,
  interpolateColor,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type CircularProgressProps = {
  current: number;
  max: number;
  size?: number;
  strokeWidth?: number;
};

export default function CircularProgressIndicator({
  current,
  max,
  size = 32,
  strokeWidth = 3,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(current / max, 1);
  const remaining = max - current;

  // Determine color based on progress
  const getColor = () => {
    if (progress >= 1) return "#ef4444"; // Red when at/over limit
    if (progress >= 0.9) return "#f97316"; // Orange when 90%+
    if (progress >= 0.8) return "#eab308"; // Yellow when 80%+
    return "#0085ff"; // Blue otherwise
  };

  const strokeDashoffset = circumference - progress * circumference;
  const color = getColor();

  // Show remaining count only when getting close to limit
  const showCount = progress >= 0.8;

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        {/* Background circle */}
        <Circle
          stroke="rgba(148, 163, 184, 0.3)"
          fill="none"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress circle */}
        <Circle
          stroke={color}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </Svg>
      {showCount && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: remaining < 0 ? 8 : 10,
              fontWeight: "600",
              color: color,
            }}
          >
            {remaining}
          </Text>
        </View>
      )}
    </View>
  );
}
