import React from "react";
import Svg, { Path } from "react-native-svg";

import { ACTION_ICON_STROKE_WIDTH } from "@/components/icons/actionIcon";

type RepostIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function RepostIcon({
  size = 20,
  color = "currentColor",
  strokeWidth = ACTION_ICON_STROKE_WIDTH,
}: RepostIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
