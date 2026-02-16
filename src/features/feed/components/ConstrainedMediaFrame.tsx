import React, { useCallback, useState } from "react";
import { View, type LayoutChangeEvent, type ViewStyle } from "react-native";

const DEFAULT_MEDIA_ASPECT_RATIO = 1;

function isValidAspectRatio(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function clampMediaAspectRatio(
  value: number | null | undefined,
  minAspectRatio: number,
): number {
  if (!isValidAspectRatio(value)) {
    return DEFAULT_MEDIA_ASPECT_RATIO;
  }

  return Math.max(value, minAspectRatio);
}

export function ConstrainedMediaFrame({
  aspectRatio,
  maxHeightRatio,
  minAspectRatio,
  borderRadius = 16,
  maxHeight,
  fullBleed = false,
  children,
}: {
  aspectRatio: number | null | undefined;
  maxHeightRatio: number;
  minAspectRatio: number;
  borderRadius?: number;
  maxHeight?: number;
  fullBleed?: boolean;
  children: React.ReactNode;
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const constrainedAspectRatio = clampMediaAspectRatio(aspectRatio, minAspectRatio);
  const heightToWidthRatio = Math.min(1 / constrainedAspectRatio, maxHeightRatio);
  const maxHeightRatioFromWidth =
    maxHeight && containerWidth > 0 ? maxHeight / containerWidth : null;
  const resolvedHeightToWidthRatio =
    maxHeightRatioFromWidth == null
      ? heightToWidthRatio
      : Math.min(heightToWidthRatio, maxHeightRatioFromWidth);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (!Number.isFinite(nextWidth) || nextWidth <= 0) {
      return;
    }
    setContainerWidth((previousWidth) =>
      Math.abs(previousWidth - nextWidth) < 0.5 ? previousWidth : nextWidth,
    );
  }, []);

  return (
    <View
      className="w-full overflow-hidden"
      style={maxHeight ? { maxHeight } : undefined}
      onLayout={handleLayout}
    >
      <View
        className="w-full overflow-hidden"
        style={{ paddingTop: `${resolvedHeightToWidthRatio * 100}%` }}
      >
        <View
          className="absolute inset-0 flex-row justify-start"
          style={{ pointerEvents: "box-none" }}
        >
          <View
            className="h-full overflow-hidden"
            style={[
              {
                aspectRatio: constrainedAspectRatio,
                borderRadius,
              },
              fullBleed ? ({ width: "100%" } as ViewStyle) : null,
            ]}
          >
            {children}
          </View>
        </View>
      </View>
    </View>
  );
}
