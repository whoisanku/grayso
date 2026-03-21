import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

import { ACTION_ICON_STROKE_WIDTH } from "@/components/icons/actionIcon";

type ProfileIconProps = {
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
};

export function ProfileIcon({
  size = 20,
  width,
  height,
  color = "currentColor",
  stroke,
  fill,
  strokeWidth = ACTION_ICON_STROKE_WIDTH,
}: ProfileIconProps) {
  const iconWidth = width ?? size;
  const iconHeight = height ?? size;
  const iconColor = stroke ?? fill ?? color;

  return (
    <Svg width={iconWidth} height={iconHeight} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="8"
        r="5"
        stroke={iconColor}
        strokeWidth={strokeWidth}
      />
      <Path
        d="M20 21a8 8 0 0 0-16 0"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type ProfileIconFilledProps = {
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
};

export function ProfileIconFilled({
  size = 20,
  width,
  height,
  color = "currentColor",
  fill,
}: ProfileIconFilledProps) {
  const iconWidth = width ?? size;
  const iconHeight = height ?? size;
  const iconColor = fill ?? color;

  return (
    <Svg width={iconWidth} height={iconHeight} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="8"
        r="5"
        fill={iconColor}
        stroke={iconColor}
        strokeWidth={1.5}
      />
      <Path
        d="M20 21a8 8 0 0 0-16 0Z"
        fill={iconColor}
        stroke={iconColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
