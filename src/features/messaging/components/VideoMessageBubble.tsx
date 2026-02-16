import React from "react";
import { View, Dimensions, Platform } from "react-native";
import { MessageVideo } from "./MessageVideo";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_VIDEO_WIDTH = Platform.OS === 'web'
  ? Math.min(SCREEN_WIDTH * 0.72, 320)
  : SCREEN_WIDTH * 0.72;
const MAX_VIDEO_HEIGHT = 280;

export type VideoMessageBubbleProps = {
  decryptedVideoURLs?: string;
  extraData?: Record<string, any> | null;
  isDark: boolean;
  compact?: boolean;
  borderRadius?: number;
  onPlayVideo?: (uri: string) => void;
};

type NormalizedVideoSource = {
  streamUrl: string;
  posterUrl?: string;
  id?: string;
};

const isNative = Platform.OS !== 'web';

/**
 * Build a playback URL from a video ID.
 * On native, use HLS .m3u8 manifest. On web, use iframe embed.
 */
function buildPlaybackUrl(videoId: string): string {
  if (isNative) {
    return `https://customer-wmy0lgubd5pjy0wz.cloudflarestream.com/${videoId}/manifest/video.m3u8`;
  }
  return `https://iframe.videodelivery.net/${videoId}`;
}

const normalizeVideoSource = (url: string): NormalizedVideoSource => {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === "iframe.videodelivery.net") {
      const videoId = parsed.pathname.replace(/^\//, "");

      if (videoId) {
        return {
          streamUrl: buildPlaybackUrl(videoId),
          posterUrl: `https://videodelivery.net/${videoId}/thumbnails/thumbnail.jpg?time=1s`,
          id: videoId
        };
      }
    }

    if (parsed.hostname === "videodelivery.net") {
      const videoIdMatch = url.match(/videodelivery\.net\/([^\/]+)\//);
      if (videoIdMatch && videoIdMatch[1]) {
        const videoId = videoIdMatch[1];

        return {
          streamUrl: isNative ? buildPlaybackUrl(videoId) : url,
          posterUrl: `https://videodelivery.net/${videoId}/thumbnails/thumbnail.jpg?time=1s`,
          id: videoId
        };
      }
    }

    // cloudflarestream.com URLs
    if (parsed.hostname.includes('cloudflarestream.com')) {
      const pathParts = parsed.pathname.replace(/^\/+/, '').split('/');
      const videoId = pathParts[0];
      if (videoId && /^[A-Za-z0-9_-]{8,}$/.test(videoId)) {
        return {
          streamUrl: isNative ? buildPlaybackUrl(videoId) : url,
          posterUrl: `https://videodelivery.net/${videoId}/thumbnails/thumbnail.jpg?time=1s`,
          id: videoId
        };
      }
    }
  } catch {
    // If URL parsing fails, fall back to the original value
  }

  return { streamUrl: url, id: url };
};

const buildStreamUrlFromClientId = (clientId?: string): NormalizedVideoSource | null => {
  if (!clientId) return null;

  const sanitized = clientId.split("?")[0];
  if (!sanitized) return null;

  return {
    streamUrl: buildPlaybackUrl(sanitized),
    posterUrl: `https://videodelivery.net/${sanitized}/thumbnails/thumbnail.jpg?time=1s`,
    id: sanitized
  };
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

export const VideoMessageBubble = React.memo(({
  decryptedVideoURLs,
  extraData,
  isDark,
  compact = false,
  borderRadius = 12,
  onPlayVideo,
}: VideoMessageBubbleProps) => {
  let videoUrls = parseVideoUrls(decryptedVideoURLs);
  const metadata: Record<string, any> = extraData ?? {};

  // Fallback: Check for videos in extraData if no decrypted URLs found
  if ((!videoUrls || videoUrls.length === 0) && typeof extraData?.decryptedVideoURLs === "string") {
    videoUrls = parseVideoUrls(extraData.decryptedVideoURLs as string);
  }

  if ((!videoUrls || videoUrls.length === 0) && extraData) {
    let index = 0;
    while (true) {
      const clientIdKey = `video.${index}.clientId`;
      const clientId = metadata[clientIdKey];

      if (!clientId) break;

      // Construct URL using the known video delivery base URL
      videoUrls.push(`https://iframe.videodelivery.net/${clientId}`);
      index++;
    }
  }

  if (videoUrls.length === 0) {
    return null;
  }

  const effectiveMaxWidth = Math.max(
    0,
    MAX_VIDEO_WIDTH - (compact ? 0 : 32)
  ); // account for parent bubble horizontal padding

  return (
    <View>
      {videoUrls.map((url, index) => {
        const normalized = normalizeVideoSource(url);
        console.log('[VideoMessageBubble] Decrypted video URL:', {
          originalUrl: url,
          normalizedStreamUrl: normalized.streamUrl,
          posterUrl: normalized.posterUrl,
          videoId: normalized.id,
        });

        const widthKey = `video.${index}.width`;
        const heightKey = `video.${index}.height`;
        const rawWidth = metadata[widthKey];
        const rawHeight = metadata[heightKey];
        const videoWidth = rawWidth ? parseInt(String(rawWidth), 10) : undefined;
        const videoHeight = rawHeight ? parseInt(String(rawHeight), 10) : undefined;

        // Fallback for cloudflare parsing
        if (!normalized.streamUrl) {
          const clientIdKey = `video.${index}.clientId`;
          const fallback = buildStreamUrlFromClientId(metadata[clientIdKey] as string | undefined);
          if (!fallback?.streamUrl) {
            return null;
          }

          return (
            <MessageVideo
              key={fallback.id || `${index}`}
              uri={fallback.streamUrl}
              posterUri={fallback.posterUrl}
              width={videoWidth}
              height={videoHeight}
              maxWidth={effectiveMaxWidth}
              maxHeight={MAX_VIDEO_HEIGHT}
              borderRadius={compact ? 0 : borderRadius}
              isDark={isDark}
              className={
                index < videoUrls.length - 1
                  ? compact
                    ? "mb-1"
                    : "mb-3"
                  : ""
              }
              onPlay={onPlayVideo ? () => onPlayVideo(fallback.streamUrl) : undefined}
            />
          );
        }

        return (
          <MessageVideo
            key={normalized.id || url}
            uri={normalized.streamUrl}
            posterUri={normalized.posterUrl}
            width={videoWidth}
            height={videoHeight}
            maxWidth={effectiveMaxWidth}
            maxHeight={MAX_VIDEO_HEIGHT}
            borderRadius={compact ? 0 : borderRadius}
            isDark={isDark}
            className={
              index < videoUrls.length - 1
                ? compact
                  ? "mb-1"
                  : "mb-3"
                : ""
            }
            onPlay={onPlayVideo ? () => onPlayVideo(normalized.streamUrl) : undefined}
          />
        );
      })}
    </View>
  );
});

VideoMessageBubble.displayName = "VideoMessageBubble";
