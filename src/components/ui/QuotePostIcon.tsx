import React from "react";
import Svg, { Path } from "react-native-svg";

type QuotePostIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function QuotePostIcon({
  size = 16,
  color = "currentColor",
  strokeWidth = 1.9,
}: QuotePostIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 4h4l-3 8H4z M8 12l-4 7 M16 4h4l-3 8H13z M17 12l-4 7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
