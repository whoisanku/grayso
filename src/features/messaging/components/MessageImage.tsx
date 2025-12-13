import React, { useState } from "react";
import { View, TouchableOpacity, Platform, DimensionValue } from "react-native";
import { Image } from "expo-image";
import { ActivityIndicator } from "react-native";

export type MessageImageProps = {
  uri: string;
  width?: number; // Raw width from metadata
  height?: number; // Raw height from metadata
  maxWidth?: number;
  maxHeight?: number;
  borderRadius?: number;
  onPress?: () => void;
  className?: string;
  style?: any; // Allow explicit style overrides
  contentFit?: "cover" | "contain";
  forceSquare?: boolean;
};

const DEFAULT_ASPECT_RATIO = 1;
const MIN_ASPECT_RATIO = 0.5; // Don't let it get too tall
const MAX_ASPECT_RATIO = 3;   // Don't let it get too wide/short
const MIN_HEIGHT_RATIO = 0.55; // Keep thumbnails visually uniform

export const MessageImage = React.memo(({
  uri,
  width,
  height,
  maxWidth = 300,
  maxHeight = 300,
  borderRadius = 12,
  onPress,
  className,
  style,
  contentFit = "cover",
  forceSquare = false,
}: MessageImageProps) => {
  const [isLoading, setIsLoading] = useState(true);

  // Calculate optimized dimensions
  const aspectRatio = (width && height) 
    ? Math.min(MAX_ASPECT_RATIO, Math.max(MIN_ASPECT_RATIO, width / height))
    : DEFAULT_ASPECT_RATIO;

  // Use a fixed width thumbnail for chat alignment.
  const targetWidth = maxWidth;
  const minHeight = Math.min(maxHeight, maxWidth * MIN_HEIGHT_RATIO);
  const rawHeight = targetWidth / aspectRatio;

  const finalWidth = forceSquare ? targetWidth : targetWidth;
  const finalHeight = forceSquare
    ? Math.min(maxHeight, targetWidth)
    : Math.min(maxHeight, Math.max(minHeight, rawHeight));

  // If style has explicit width/height, use them?
  // Actually, we pass the calculated dimensions to the style. 
  // But if the parent passes a style, we merge it.
  
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={!onPress}
      style={[
        {
          width: finalWidth,
          height: finalHeight,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: '#e2e8f0', // placeholder color
        },
        style
      ]}
      className={className}
    >
      <Image
        source={{ uri }}
        style={{ width: '100%', height: '100%' }}
        contentFit={contentFit}
        transition={200}
        cachePolicy="memory-disk"
        onLoad={() => setIsLoading(false)}
      />
      
      {isLoading && (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="small" color="#94a3b8" />
        </View>
      )}
    </TouchableOpacity>
  );
});

MessageImage.displayName = "MessageImage";
