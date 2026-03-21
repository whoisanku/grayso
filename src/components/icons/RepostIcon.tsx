import React from "react";
import Svg, { Path, Polyline } from "react-native-svg";

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
      <Polyline
        points="17 1 21 5 17 9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 11V9a4 4 0 0 1 4-4h14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="7 23 3 19 7 15"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M21 13v2a4 4 0 0 1-4 4H3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
