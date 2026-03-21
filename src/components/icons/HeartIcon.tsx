import React from "react";
import Svg, { Path } from "react-native-svg";

import { ACTION_ICON_STROKE_WIDTH } from "@/components/icons/actionIcon";

type HeartIconProps = {
  size?: number;
  color?: string;
  filled?: boolean;
  strokeWidth?: number;
};

const HEART_PATH =
  "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z";

export function HeartIcon({
  size = 20,
  color = "currentColor",
  filled = false,
  strokeWidth = ACTION_ICON_STROKE_WIDTH,
}: HeartIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={HEART_PATH}
        fill={filled ? color : "none"}
        stroke={color}
        strokeWidth={filled ? 0.8 : strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
