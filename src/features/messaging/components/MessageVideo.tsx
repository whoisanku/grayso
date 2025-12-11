import React, { useState, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Feather } from "@expo/vector-icons";

export type MessageVideoProps = {
  uri: string;
  posterUri?: string;
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
  borderRadius?: number;
  className?: string;
  isDark?: boolean;
};

const DEFAULT_ASPECT_RATIO = 16 / 9;

// Sub-component that actually loads the player
// Only mounted when user klicks play
function ActiveVideoPlayer({ uri, isDark }: { uri: string; isDark?: boolean }) {
  const player = useVideoPlayer(uri, (player) => {
    player.loop = false;
    player.play();
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        allowsFullscreen
        allowsPictureInPicture
        nativeControls={true} // Use native controls for better UX
      />
    </View>
  );
}

export const MessageVideo = React.memo(({
  uri,
  posterUri,
  width,
  height,
  maxWidth = 300,
  maxHeight = 300,
  borderRadius = 12,
  className,
  isDark = false,
}: MessageVideoProps) => {
  const [isActive, setIsActive] = useState(false);

  // Smart Aspect Ratio Logic (same as MessageImage)
  const aspectRatio = (width && height) 
    ? width / height 
    : DEFAULT_ASPECT_RATIO;

  let finalWidth: number;
  let finalHeight: number;

  if (aspectRatio > 1) {
    // Landscape
    finalWidth = maxWidth;
    finalHeight = maxWidth / aspectRatio;
  } else {
    // Portrait
    finalHeight = Math.min(maxHeight, maxWidth / aspectRatio);
    finalWidth = Math.min(maxWidth, finalHeight * aspectRatio);
  }

  // Double check bounds
  if (finalWidth > maxWidth) {
    finalWidth = maxWidth;
    finalHeight = finalWidth / aspectRatio;
  }

  return (
    <View
      style={{
        width: finalWidth,
        height: finalHeight,
        borderRadius,
        overflow: 'hidden',
        backgroundColor: isDark ? '#1e293b' : '#000000', // Black bg for video
        position: 'relative',
      }}
      className={className}
    >
      {isActive ? (
        <ActiveVideoPlayer uri={uri} isDark={isDark} />
      ) : (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setIsActive(true)}
          style={StyleSheet.absoluteFill}
        >
          {/* Thumbnail */}
          <Image
            source={{ uri: posterUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
          />

          {/* Overlay: Play Button */}
          <View className="absolute inset-0 items-center justify-center bg-black/20">
             <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "rgba(0,0,0,0.6)",
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.8)",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Feather
                name="play"
                size={22}
                color="#fff"
                style={{ marginLeft: 3 }}
              />
            </View>
          </View>
          
          {/* Duration/Type Badge (optional enhancement) */}
          <View className="absolute top-2 left-2 bg-black/60 rounded px-1.5 py-0.5 flex-row items-center">
             <Feather name="video" size={10} color="white" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
});

MessageVideo.displayName = "MessageVideo";
