import { type ReactNode } from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  Platform,
} from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const IS_TOUCH = Platform.OS !== "web";
const DEFAULT_TARGET_SCALE = IS_TOUCH ? 0.95 : 1;

type PressableScaleProps = Omit<PressableProps, "style"> & {
  /** Scale factor when pressed (0-1). Default 0.95 on native, 1 on web. */
  targetScale?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function PressableScale({
  targetScale = DEFAULT_TARGET_SCALE,
  children,
  style,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
  }));

  return (
    <AnimatedPressable
      onPressIn={(e) => {
        onPressIn?.(e);
        cancelAnimation(scale);
        scale.set(withTiming(targetScale, { duration: 100 }));
      }}
      onPressOut={(e) => {
        onPressOut?.(e);
        cancelAnimation(scale);
        scale.set(withTiming(1, { duration: 100 }));
      }}
      style={[!reducedMotion && animatedStyle, style]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
