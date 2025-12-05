import React from "react";
import { View } from "react-native";
import { Video, ResizeMode } from "expo-av";

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
          <Video
            key={url}
            source={{ uri: streamUrl }}
            style={{
              width: "100%",
              aspectRatio,
              borderRadius: 12,
              backgroundColor: isDark ? "#1f2937" : "#e2e8f0",
              marginBottom: index < videoUrls.length - 1 ? 12 : 0,
            }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            usePoster={Boolean(posterUrl)}
            posterSource={posterUrl ? { uri: posterUrl } : undefined}
            isLooping={false}
            shouldPlay={index === 0}
          />
        );
      })}
    </View>
  );
});

VideoMessageBubble.displayName = "VideoMessageBubble";
