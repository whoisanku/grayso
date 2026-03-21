import React from "react";
import Svg, { Path } from "react-native-svg";

type ArrowsRightLeftIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

// Matches Palus web icon: @heroicons/react/24/outline ArrowsRightLeftIcon.
export function ArrowsRightLeftIcon({
  size = 20,
  color = "#64748b",
  strokeWidth = 1.5,
}: ArrowsRightLeftIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
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
