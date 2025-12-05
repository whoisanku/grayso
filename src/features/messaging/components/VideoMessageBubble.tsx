import React, { useState, useRef, useCallback } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Feather } from "@expo/vector-icons";

export type VideoMessageBubbleProps = {
  decryptedVideoURLs?: string;
  extraData: Record<string, any>;
  isDark: boolean;
};

type NormalizedVideoSource = {
  streamUrl: string;
  posterUrl?: string;
};

const normalizeVideoSource = (url: string): NormalizedVideoSource => {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === "iframe.videodelivery.net") {
      const videoId = parsed.pathname.replace(/^\//, "");

      if (videoId) {
        return {
          streamUrl: `https://videodelivery.net/${videoId}/manifest/video.m3u8`,
          posterUrl: `https://videodelivery.net/${videoId}/thumbnails/thumbnail.jpg?time=1s`,
        };
      }
    }
  } catch {
    // If URL parsing fails, fall back to the original value
  }

  return { streamUrl: url };
};

const parseVideoUrls = (value?: string): string[] => {
  if (!value || typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((url): url is string => typeof url === "string" && url.length > 0);
    }
  } catch {
    if (value.startsWith("http")) {
      return [value];
    }
  }

  return [];
};

type VideoPlayerProps = {
  streamUrl: string;
  posterUrl?: string;
  aspectRatio: number;
  isDark: boolean;
  isLast: boolean;
};

const VideoPlayer = React.memo(({ streamUrl, posterUrl, aspectRatio, isDark, isLast }: VideoPlayerProps) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
  }, []);

  const handleTogglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    
    try {
      const status = await videoRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await videoRef.current.pauseAsync();
        } else {
          await videoRef.current.playAsync();
        }
      }
    } catch (error) {
      console.warn("Video playback error:", error);
    }
  }, []);

  return (
    <Pressable
      onPress={handleTogglePlay}
      style={{
        width: "100%",
        aspectRatio,
        borderRadius: 12,
        backgroundColor: isDark ? "#1f2937" : "#e2e8f0",
        marginBottom: isLast ? 0 : 12,
        overflow: "hidden",
      }}
    >
      <Video
        ref={videoRef}
        source={{ uri: streamUrl }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.CONTAIN}
        usePoster={Boolean(posterUrl)}
        posterSource={posterUrl ? { uri: posterUrl } : undefined}
        isLooping={false}
        shouldPlay={false}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
      />
      
      {/* Play/Pause overlay - only show when paused */}
      {!isPlaying && (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
          pointerEvents="none"
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: "rgba(255,255,255,0.9)",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Feather
              name="play"
              size={28}
              color="#000"
              style={{ marginLeft: 4 }}
            />
          </View>
        </View>
      )}
    </Pressable>
  );
});

VideoPlayer.displayName = "VideoPlayer";

export const VideoMessageBubble = React.memo(({ decryptedVideoURLs, extraData, isDark }: VideoMessageBubbleProps) => {
  const videoUrls = parseVideoUrls(decryptedVideoURLs);

  if (videoUrls.length === 0) {
    return null;
  }

  return (
    <View className="mb-2">
      {videoUrls.map((url, index) => {
        const { streamUrl, posterUrl } = normalizeVideoSource(url);
        const widthKey = `video.${index}.width`;
        const heightKey = `video.${index}.height`;
        const videoWidth = extraData[widthKey] ? parseInt(extraData[widthKey] as string, 10) : undefined;
        const videoHeight = extraData[heightKey] ? parseInt(extraData[heightKey] as string, 10) : undefined;
        const aspectRatio = videoWidth && videoHeight && videoHeight !== 0 ? videoWidth / videoHeight : 9 / 16;

        return (
          <VideoPlayer
            key={url}
            streamUrl={streamUrl}
            posterUrl={posterUrl}
            aspectRatio={aspectRatio}
            isDark={isDark}
            isLast={index === videoUrls.length - 1}
          />
        );
      })}
    </View>
  );
});

VideoMessageBubble.displayName = "VideoMessageBubble";
