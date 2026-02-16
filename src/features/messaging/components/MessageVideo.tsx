import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Text, Platform } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView, type VideoSource } from "expo-video";
import { Feather } from "@expo/vector-icons";
import { normalizeVideoSource, resolveLivepeerPlayback } from "@/lib/mediaUrl";

/**
 * Convert an iframe/cloudflare video URL to an HLS stream URL for native playback.
 * On web, iframe URLs work fine. On native iOS/Android, we need the .m3u8 manifest.
 */


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
// Only mounted when user clicks play
function ActiveVideoPlayer({ uri, isDark }: { uri: string; isDark?: boolean }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [resolvedSource, setResolvedSource] = useState<string | null>(null);
  
  // Use normalized source to get playbackId and robust URLs
  const normalized = React.useMemo(() => normalizeVideoSource(uri), [uri]);
  const playbackId = normalized.playbackId;
  const initialPlayableUrl = normalized.playableUrl;

  // Resolve Livepeer URL if needed
  useEffect(() => {
    if (playbackId) {
      resolveLivepeerPlayback(playbackId).then((url) => {
        if (url) {
          setResolvedSource(url);
        } else {
          setHasError(true);
          setIsLoading(false);
          setErrorMessage("Failed to resolve Livepeer video");
        }
      });
    } else {
      setResolvedSource(initialPlayableUrl);
    }
  }, [playbackId, initialPlayableUrl]);

  const effectiveSource = resolvedSource ?? initialPlayableUrl;
  const isHls = playbackId ? (resolvedSource?.includes('.m3u8') ?? false) : normalized.isHls;

  // Build proper VideoSource object so iOS AVPlayer knows the content type
  const videoSource = React.useMemo<VideoSource | null>(() => {
    if (!effectiveSource || (playbackId && !resolvedSource)) return null;

    const src: VideoSource = { uri: effectiveSource };
    if (isHls) {
      (src as Record<string, unknown>).contentType = 'hls';
    }
    return src;
  }, [effectiveSource, isHls, playbackId, resolvedSource]);

  const player = useVideoPlayer(videoSource, (player) => {
    console.log('[MessageVideo] Initializing player with URI:', effectiveSource, '(original:', uri, ')');
    console.log('[MessageVideo] Platform:', Platform.OS, 'isHls:', isHls);
    player.loop = false;

    // Add error handling
    player.addListener('statusChange', (status) => {
      console.log('[MessageVideo] Player status:', status, 'URI:', effectiveSource);
      if (status.error) {
        const errMsg = status.error.message || 'Unknown playback error';
        console.error('[MessageVideo] Player error:', status.error);
        setErrorMessage(errMsg);
        setHasError(true);
        setIsLoading(false);
      }
    });

    player.addListener('playingChange', (isPlaying) => {
      console.log('[MessageVideo] Playing state changed:', isPlaying);
      if (isPlaying) {
        setIsLoading(false);
      }
    });

    // Start playback - play() doesn't return a Promise
    try {
      player.play();
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Failed to start playback';
      console.error('[MessageVideo] Failed to start playback:', error);
      setErrorMessage(errMsg);
      setHasError(true);
      setIsLoading(false);
    }
  });

  if (hasError) {
    return (
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#000000', padding: 16 }]}>
        <Feather name="alert-circle" size={32} color="#ef4444" />
        <Text style={{ color: '#ef4444', marginTop: 8, fontSize: 12, textAlign: 'center' }}>
          Failed to load video
        </Text>
        {errorMessage && (
          <Text style={{ color: '#94a3b8', marginTop: 4, fontSize: 10, textAlign: 'center' }}>
            {errorMessage}
          </Text>
        )}
        <Text style={{ color: '#64748b', marginTop: 8, fontSize: 10, textAlign: 'center' }}>
          {Platform.OS === 'web' ? 'Try a different browser' : 'Video format may not be supported'}
        </Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {isLoading && (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#000000' }]}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
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
  onPlay,
}: MessageVideoProps & { onPlay?: () => void }) => {
  const [isActive, setIsActive] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  // Validate URI
  useEffect(() => {
    /* console.log('[MessageVideo] Component mounted with:', {
      uri,
      posterUri,
      width,
      height,
      isValidUri: uri && uri.length > 0,
    }); */
  }, [uri, posterUri, width, height]);

  // Don't render if URI is invalid
  if (!uri || uri.trim().length === 0) {
    console.error('[MessageVideo] Invalid URI provided:', uri);
    return null;
  }

  // Determine dimensions: use props if available, otherwise use natural image size, otherwise default
  const effectiveWidth = width || naturalSize?.width;
  const effectiveHeight = height || naturalSize?.height;

  // Smart Aspect Ratio Logic
  const aspectRatio = (effectiveWidth && effectiveHeight)
    ? effectiveWidth / effectiveHeight
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

  // For web + iframe URLs, use actual iframe embed
  // expo-video can't play iframe URLs directly - they need to be embedded
  const isIframeUrl = uri.includes('iframe.videodelivery.net');
  const isWeb = Platform.OS === 'web';

  if (isWeb && isIframeUrl) {
    console.log('[MessageVideo] Using iframe embed for web');

    // Show thumbnail until user clicks play
    if (!isActive) {
      return (
        <View
          style={{
            width: finalWidth,
            height: finalHeight,
            borderRadius,
            overflow: 'hidden',
            backgroundColor: isDark ? '#1e293b' : '#000000',
            position: 'relative',
          }}
          className={className}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (onPlay) {
                onPlay();
              } else {
                setIsActive(true);
              }
            }}
            style={StyleSheet.absoluteFill}
          >
            {/* Thumbnail */}
            <Image
              source={{ uri: posterUri }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              onLoad={(e) => {
                // If we don't have explicit dimensions, use the image's natural dimensions
                if (!width || !height) {
                  setNaturalSize({ width: e.source.width, height: e.source.height });
                }
              }}
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

            {/* Duration/Type Badge */}
            <View className="absolute top-2 left-2 bg-black/60 rounded px-1.5 py-0.5 flex-row items-center">
              <Feather name="video" size={10} color="white" />
            </View>

            {/* Fullscreen Indicator (y=x arrow) */}
            <View className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5">
              <Feather name="maximize-2" size={12} color="white" />
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    // After click, show iframe
    // Add autoplay=true to ensure it plays immediately
    const iframeSrc = uri.includes('?') ? `${uri}&autoplay=true` : `${uri}?autoplay=true`;

    return (
      <View
        style={{
          width: finalWidth,
          height: finalHeight,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: isDark ? '#1e293b' : '#000000',
          position: 'relative',
        }}
        className={className}
      >
        <iframe
          src={iframeSrc}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </View>
    );
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
          onPress={() => {
            if (onPlay) {
              onPlay();
            } else {
              setIsActive(true);
            }
          }}
          style={StyleSheet.absoluteFill}
        >
          {/* Thumbnail */}
          <Image
            source={{ uri: posterUri }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            onLoad={(e) => {
              if (!width || !height) {
                setNaturalSize({ width: e.source.width, height: e.source.height });
              }
            }}
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

          {/* Fullscreen Indicator (y=x arrow) */}
          <View className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5">
            <Feather name="maximize-2" size={12} color="white" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
});

MessageVideo.displayName = "MessageVideo";
