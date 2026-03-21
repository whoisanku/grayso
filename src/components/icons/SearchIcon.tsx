import React from "react";
import Svg, { Path } from "react-native-svg";

import { ACTION_ICON_STROKE_WIDTH } from "@/components/icons/actionIcon";

type SearchIconProps = {
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
};

export function SearchIcon({
  size = 20,
  width,
  height,
  color = "currentColor",
  stroke,
  fill,
  strokeWidth = ACTION_ICON_STROKE_WIDTH,
}: SearchIconProps) {
  const iconWidth = width ?? size;
  const iconHeight = height ?? size;
  const iconColor = stroke ?? fill ?? color;

  return (
    <Svg width={iconWidth} height={iconHeight} viewBox="0 0 24 24" fill="none">
      <Path
        d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
