import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { Feather } from "@expo/vector-icons";

// ---------------------------------------------------------------------------
// URL normalisation helpers
// ---------------------------------------------------------------------------

import {
  normalizeVideoSource,
  resolveLivepeerPlayback,
  buildWebIframeUrl,
} from "@/lib/mediaUrl";
import { ConstrainedMediaFrame } from "@/features/feed/components/ConstrainedMediaFrame";
import { useRemoteAspectRatio } from "@/features/feed/hooks/useRemoteAspectRatio";

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

type FeedVideoProps = {
  url: string;
  isActive: boolean;
  isDark: boolean;
  borderRadius?: number;
};

const DEFAULT_VIDEO_ASPECT_RATIO = 16 / 9;
const BLUESKY_VIDEO_MAX_HEIGHT_RATIO = 14 / 9;
const BLUESKY_MIN_MEDIA_ASPECT_RATIO = 1 / 2;

function InactiveVideoPreview({
  posterUrl,
  fallbackVideoUrl,
  isDark,
  borderRadius,
  aspectRatio,
  maxHeight,
}: {
  posterUrl?: string;
  fallbackVideoUrl?: string;
  isDark: boolean;
  borderRadius: number;
  aspectRatio: number;
  maxHeight: number;
}) {
  return (
    <ConstrainedMediaFrame
      aspectRatio={aspectRatio}
      minAspectRatio={BLUESKY_MIN_MEDIA_ASPECT_RATIO}
      maxHeightRatio={BLUESKY_VIDEO_MAX_HEIGHT_RATIO}
      maxHeight={maxHeight}
      borderRadius={borderRadius}
    >
      <View
        style={[
          styles.frame,
          {
            borderRadius,
            backgroundColor: isDark ? "#0f172a" : "#0b1220",
          },
        ]}
      >
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            placeholder={{ blurhash: DEFAULT_VIDEO_BLURHASH }}
            transition={350}
          />
        ) : Platform.OS === "web" && fallbackVideoUrl ? (
          <video
            src={fallbackVideoUrl}
            style={styles.htmlPreviewVideo}
            autoPlay
            muted
            playsInline
            preload="auto"
            onLoadedData={(event) => {
              event.currentTarget.pause();
            }}
          />
        ) : null}
        <View style={styles.previewOverlay}>
          <View style={styles.previewChip}>
            <Feather name="video" size={13} color="#ffffff" />
            <Text style={styles.previewText}>Video</Text>
          </View>
        </View>
      </View>
    </ConstrainedMediaFrame>
  );
}

const DEFAULT_VIDEO_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

function ActivePlayer({
  source,
  posterUrl,
  isHls,
  isDark,
  borderRadius,
  playbackId,
  aspectRatio,
  maxHeight,
}: {
  source: string;
  posterUrl?: string;
  isHls: boolean;
  isDark: boolean;
  borderRadius: number;
  playbackId?: string;
  aspectRatio: number;
  maxHeight: number;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [resolvedSource, setResolvedSource] = useState<{
    playbackId: string;
    uri: string;
  } | null>(null);

  // If we have a playbackId, we must resolve the real URL first
  useEffect(() => {
    if (!playbackId) {
      return;
    }

    let isCancelled = false;

    resolveLivepeerPlayback(playbackId).then((url) => {
      if (isCancelled) {
        return;
      }

      if (url) {
        setResolvedSource({
          playbackId,
          uri: url,
        });
      } else {
        setHasError(true);
        setIsLoading(false);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [playbackId]);

  // Determine effective source and HLS status
  const resolvedPlaybackUrl =
    playbackId && resolvedSource?.playbackId === playbackId
      ? resolvedSource.uri
      : null;
  const effectiveSource = playbackId ? (resolvedPlaybackUrl ?? source) : source;
  const effectiveIsHls = playbackId
    ? (resolvedPlaybackUrl?.includes(".m3u8") ?? false)
    : isHls;

  // Build a proper VideoSource object so iOS AVPlayer knows the content type
  const videoSource = useMemo<VideoSource | null>(() => {
    if (!effectiveSource || (playbackId && !resolvedPlaybackUrl)) return null;

    const src: VideoSource = { uri: effectiveSource };
    if (effectiveIsHls) {
      (src as Record<string, unknown>).contentType = "hls";
    }
    return src;
  }, [effectiveSource, effectiveIsHls, playbackId, resolvedPlaybackUrl]);

  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = true;
    instance.muted = true;

    try {
      instance.play();
    } catch {
      setIsLoading(false);
      setHasError(true);
    }
  });

  useEffect(() => {
    const statusSub = player.addListener("statusChange", (status) => {
      if (status.error) {
        setIsLoading(false);
        setHasError(true);
      }
    });

    const playingSub = player.addListener("playingChange", (isPlaying) => {
      if (isPlaying) {
        setIsLoading(false);
        setHasError(false);
      }
    });

    return () => {
      statusSub.remove();
      playingSub.remove();
      try {
        player.pause();
      } catch {
        // no-op
      }
    };
  }, [player]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    try {
      player.replace(videoSource);
      player.play();
    } catch {
      setHasError(true);
      setIsLoading(false);
    }
  }, [player, videoSource]);

  return (
    <ConstrainedMediaFrame
      aspectRatio={aspectRatio}
      minAspectRatio={BLUESKY_MIN_MEDIA_ASPECT_RATIO}
      maxHeightRatio={BLUESKY_VIDEO_MAX_HEIGHT_RATIO}
      maxHeight={maxHeight}
      borderRadius={borderRadius}
    >
      <View
        style={[
          styles.frame,
          {
            borderRadius,
            backgroundColor: isDark ? "#0f172a" : "#0b1220",
          },
        ]}
      >
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={[
              StyleSheet.absoluteFillObject,
              { opacity: isLoading ? 1 : 0 },
            ]}
            contentFit="cover"
            placeholder={{ blurhash: DEFAULT_VIDEO_BLURHASH }}
            transition={250}
          />
        ) : null}

        <VideoView
          style={StyleSheet.absoluteFillObject}
          player={player}
          nativeControls
          allowsFullscreen
          allowsPictureInPicture
        />

        {isLoading && !hasError ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#ffffff" />
          </View>
        ) : null}

        {hasError ? (
          <View style={styles.errorOverlay}>
            <Pressable style={styles.retryButton} onPress={handleRetry}>
              <Feather name="refresh-cw" size={16} color="#ffffff" />
              <Text style={styles.retryText}>Tap to retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ConstrainedMediaFrame>
  );
}

function ActiveIframeVideo({
  source,
  posterUrl,
  isDark,
  borderRadius,
  aspectRatio,
  maxHeight,
}: {
  source: string;
  posterUrl?: string;
  isDark: boolean;
  borderRadius: number;
  aspectRatio: number;
  maxHeight: number;
}) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <ConstrainedMediaFrame
      aspectRatio={aspectRatio}
      minAspectRatio={BLUESKY_MIN_MEDIA_ASPECT_RATIO}
      maxHeightRatio={BLUESKY_VIDEO_MAX_HEIGHT_RATIO}
      maxHeight={maxHeight}
      borderRadius={borderRadius}
    >
      <View
        style={[
          styles.frame,
          {
            borderRadius,
            overflow: "hidden",
            backgroundColor: isDark ? "#0f172a" : "#0b1220",
          },
        ]}
      >
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={[
              StyleSheet.absoluteFillObject,
              { opacity: isLoading ? 1 : 0 },
            ]}
            contentFit="cover"
            placeholder={{ blurhash: DEFAULT_VIDEO_BLURHASH }}
            transition={250}
          />
        ) : null}

        <iframe
          src={source}
          style={styles.iframe}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          onLoad={() => setIsLoading(false)}
        />

        {isLoading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#ffffff" />
          </View>
        ) : null}
      </View>
    </ConstrainedMediaFrame>
  );
}

function ActiveWebVideo({
  source,
  posterUrl,
  isDark,
  borderRadius,
  aspectRatio,
  maxHeight,
}: {
  source: string;
  posterUrl?: string;
  isDark: boolean;
  borderRadius: number;
  aspectRatio: number;
  maxHeight: number;
}) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <ConstrainedMediaFrame
      aspectRatio={aspectRatio}
      minAspectRatio={BLUESKY_MIN_MEDIA_ASPECT_RATIO}
      maxHeightRatio={BLUESKY_VIDEO_MAX_HEIGHT_RATIO}
      maxHeight={maxHeight}
      borderRadius={borderRadius}
    >
      <View
        style={[
          styles.frame,
          {
            borderRadius,
            overflow: "hidden",
            backgroundColor: isDark ? "#0f172a" : "#0b1220",
          },
        ]}
      >
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={[
              StyleSheet.absoluteFillObject,
              { opacity: isLoading ? 1 : 0 },
            ]}
            contentFit="cover"
            placeholder={{ blurhash: DEFAULT_VIDEO_BLURHASH }}
            transition={250}
          />
        ) : null}

        <video
          src={source}
          poster={posterUrl}
          style={styles.htmlVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          controls
          onCanPlay={() => setIsLoading(false)}
          onPlaying={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />

        {isLoading ? (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#ffffff" />
          </View>
        ) : null}
      </View>
    </ConstrainedMediaFrame>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function FeedVideo({
  url,
  isActive,
  isDark,
  borderRadius = 16,
}: FeedVideoProps) {
  const { height: viewportHeight } = useWindowDimensions();
  const normalized = useMemo(() => normalizeVideoSource(url), [url]);
  const posterAspectRatio = useRemoteAspectRatio(normalized.posterUrl);
  const mediaAspectRatio = posterAspectRatio ?? DEFAULT_VIDEO_ASPECT_RATIO;
  const maxMediaHeight = Math.min(420, Math.max(260, viewportHeight * 0.52));

  if (!isActive) {
    return (
      <InactiveVideoPreview
        posterUrl={normalized.posterUrl}
        fallbackVideoUrl={
          Platform.OS === "web" && !normalized.posterUrl && !normalized.iframeUrl
            ? normalized.playableUrl
            : undefined
        }
        isDark={isDark}
        borderRadius={borderRadius}
        aspectRatio={mediaAspectRatio}
        maxHeight={maxMediaHeight}
      />
    );
  }

  // Web: prefer iframe for Cloudflare / Livepeer embeds
  if (Platform.OS === "web" && normalized.iframeUrl) {
    const src = buildWebIframeUrl(normalized.iframeUrl);

    return (
      <ActiveIframeVideo
        source={src}
        posterUrl={normalized.posterUrl}
        isDark={isDark}
        borderRadius={borderRadius}
        aspectRatio={mediaAspectRatio}
        maxHeight={maxMediaHeight}
      />
    );
  }

  // Web: direct HTML5 <video>
  if (Platform.OS === "web") {
    return (
      <ActiveWebVideo
        source={normalized.playableUrl}
        posterUrl={normalized.posterUrl}
        isDark={isDark}
        borderRadius={borderRadius}
        aspectRatio={mediaAspectRatio}
        maxHeight={maxMediaHeight}
      />
    );
  }

  // Native (iOS / Android): expo-video with VideoSource object
  return (
    <ActivePlayer
      source={normalized.playableUrl}
      posterUrl={normalized.posterUrl}
      isHls={normalized.isHls}
      isDark={isDark}
      borderRadius={borderRadius}
      playbackId={normalized.playbackId}
      aspectRatio={mediaAspectRatio}
      maxHeight={maxMediaHeight}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
    position: "relative",
  },
  iframe: {
    width: "100%",
    height: "100%",
    border: "none",
  } as any,
  htmlVideo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    backgroundColor: "black",
  } as any,
  htmlPreviewVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    backgroundColor: "black",
    pointerEvents: "none",
  } as any,
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2, 6, 23, 0.45)",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(2, 6, 23, 0.7)",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  previewChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "rgba(2, 6, 23, 0.75)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  previewText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
});
