import React from "react";
import Svg, { Path } from "react-native-svg";

import { ACTION_ICON_STROKE_WIDTH } from "@/components/icons/actionIcon";

type WalletIconProps = {
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
};

export function WalletIcon({
  size = 20,
  width,
  height,
  color = "currentColor",
  stroke,
  fill,
  strokeWidth = ACTION_ICON_STROKE_WIDTH,
}: WalletIconProps) {
  const iconWidth = width ?? size;
  const iconHeight = height ?? size;
  const iconColor = stroke ?? fill ?? color;

  return (
    <Svg width={iconWidth} height={iconHeight} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type WalletIconFilledProps = {
  size?: number;
  width?: number;
  height?: number;
  color?: string;
  fill?: string;
};

export function WalletIconFilled({
  size = 20,
  width,
  height,
  color = "currentColor",
  fill,
}: WalletIconFilledProps) {
  const iconWidth = width ?? size;
  const iconHeight = height ?? size;
  const iconColor = fill ?? color;

  return (
    <Svg width={iconWidth} height={iconHeight} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM2.273 8.625A4.483 4.483 0 0 1 5.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 6H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z"
        fill={iconColor}
      />
    </Svg>
  );
}
