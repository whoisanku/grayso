import React, { useState, useRef, useCallback } from "react";
import { View, StyleSheet, Text, Dimensions, Platform, Modal, StatusBar, useWindowDimensions, TouchableOpacity as RNTouchableOpacity, TouchableWithoutFeedback as RNTouchableWithoutFeedback } from "react-native";
import { TouchableOpacity, TouchableWithoutFeedback } from 'react-native-gesture-handler';
import { Video, ResizeMode, AVPlaybackStatus } from "expo-av";
import { Feather } from "@expo/vector-icons";
import { Image } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// Minimum and maximum dimensions for video thumbnail
const MIN_VIDEO_WIDTH = Platform.OS === 'web' ? 200 : SCREEN_WIDTH * 0.5;
const MAX_VIDEO_WIDTH = Platform.OS === 'web' ? 320 : SCREEN_WIDTH * 0.72;
const MIN_VIDEO_HEIGHT = 120;
const MAX_VIDEO_HEIGHT = 280;

export type VideoMessageBubbleProps = {
  decryptedVideoURLs?: string;
  extraData?: Record<string, any> | null;
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

const buildStreamUrlFromClientId = (clientId?: string): NormalizedVideoSource | null => {
  if (!clientId) return null;

  const sanitized = clientId.split("?")[0];
  if (!sanitized) return null;

  return {
    streamUrl: `https://videodelivery.net/${sanitized}/manifest/video.m3u8`,
    posterUrl: `https://videodelivery.net/${sanitized}/thumbnails/thumbnail.jpg?time=1s`,
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

// Format duration as MM:SS
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

type FullscreenVideoModalProps = {
  visible: boolean;
  streamUrl: string;
  posterUrl?: string;
  onClose: () => void;
};

// Fullscreen Video Modal Component
const FullscreenVideoModal = React.memo(({ 
  visible, 
  streamUrl, 
  posterUrl, 
  onClose 
}: FullscreenVideoModalProps) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      if (status.durationMillis) {
        setDuration(Math.floor(status.durationMillis / 1000));
      }
      if (status.positionMillis) {
        setCurrentTime(Math.floor(status.positionMillis / 1000));
      }
      // Auto-close when video ends
      if (status.didJustFinish) {
        onClose();
      }
    }
  }, [onClose]);

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

  const toggleControls = useCallback(() => {
    setShowControls(prev => !prev);
  }, []);

  const progress = duration ? (currentTime / duration) * 100 : 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar hidden />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Close button */}
        <RNTouchableOpacity
          onPress={onClose}
          style={{
            position: 'absolute',
            top: Platform.OS === 'ios' ? 50 : 20,
            left: 16,
            zIndex: 100,
            padding: 8,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 20,
          }}
        >
          <Feather name="x" size={24} color="#fff" />
        </RNTouchableOpacity>

        {/* Video Player */}
        {/* Video Player */}
        <RNTouchableWithoutFeedback onPress={toggleControls}>
          <View 
            style={{ 
              flex: 1, 
              justifyContent: 'center', 
              alignItems: 'center',
              width: Platform.OS === 'web' ? windowWidth : '100%',
              height: Platform.OS === 'web' ? windowHeight : '100%',
              position: 'relative',
            }}
          >
            <Video
              ref={videoRef}
              source={{ uri: streamUrl }}
              style={{
                width: '100%',
                height: '100%',
              }}
              resizeMode={ResizeMode.CONTAIN}
              usePoster={Boolean(posterUrl)}
              posterSource={posterUrl ? { uri: posterUrl } : undefined}
              posterStyle={{ resizeMode: 'contain' }}
              isLooping={false}
              shouldPlay={true}
              isMuted={isMuted}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            />

            {/* Play/Pause overlay - center */}
            {showControls && (
              <>
                <RNTouchableOpacity
                  style={{
                    ...StyleSheet.absoluteFillObject,
                    justifyContent: "center",
                    alignItems: "center",
                    zIndex: 10,
                  }}
                  activeOpacity={1}
                  onPress={handleTogglePlay}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: "rgba(0,0,0,0.6)",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Feather
                      name={isPlaying ? "pause" : "play"}
                      size={32}
                      color="#fff"
                      style={{ marginLeft: isPlaying ? 0 : 4 }}
                    />
                  </View>
                </RNTouchableOpacity>

                {/* Mute Button - Top Right */}
                <RNTouchableOpacity
                  onPress={() => setIsMuted(prev => !prev)}
                  style={{
                    position: 'absolute',
                    top: Platform.OS === 'ios' ? 50 : 20,
                    right: 16,
                    zIndex: 100,
                    padding: 8,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    borderRadius: 20,
                  }}
                >
                  <Feather name={isMuted ? "volume-x" : "volume-2"} size={24} color="#fff" />
                </RNTouchableOpacity>
              </>
            )}
          </View>
        </RNTouchableWithoutFeedback>

        {/* Bottom controls */}
        {showControls && (
          <View
            style={{
              position: 'absolute',
              bottom: Platform.OS === 'ios' ? 40 : 20,
              left: 16,
              right: 16,
            }}
          >
            {/* Progress bar */}
            <View
              style={{
                height: 4,
                backgroundColor: 'rgba(255,255,255,0.3)',
                borderRadius: 2,
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: '#fff',
                  borderRadius: 2,
                }}
              />
            </View>

            {/* Time display */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>
                {formatDuration(currentTime)}
              </Text>
              <Text style={{ color: '#fff', fontSize: 12 }}>
                {duration ? formatDuration(duration) : '--:--'}
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
});

FullscreenVideoModal.displayName = "FullscreenVideoModal";

type VideoThumbnailProps = {
  streamUrl: string;
  posterUrl?: string;
  aspectRatio: number;
  videoWidth: number;
  videoHeight: number;
  isDark: boolean;
  isLast: boolean;
};

const VideoThumbnail = React.memo(({ 
  streamUrl, 
  posterUrl, 
  aspectRatio, 
  videoWidth,
  videoHeight,
  isDark, 
  isLast,
}: VideoThumbnailProps) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const videoRef = useRef<Video>(null);

  // Calculate constrained dimensions with minimum sizes
  const constrainedWidth = Math.max(MIN_VIDEO_WIDTH, Math.min(videoWidth, MAX_VIDEO_WIDTH));
  const constrainedHeight = Math.max(
    MIN_VIDEO_HEIGHT, 
    Math.min(constrainedWidth / aspectRatio, MAX_VIDEO_HEIGHT)
  );

  const openFullscreen = useCallback(() => {
    setIsModalVisible(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsModalVisible(false);
  }, []);

  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      if (status.durationMillis && !duration) {
        setDuration(Math.floor(status.durationMillis / 1000));
      }
    }
  }, [duration]);

  return (
    <>
      <View style={{ marginBottom: isLast ? 0 : 12, marginRight: Platform.OS === 'web' ? 0 : -2 }}>
        <TouchableOpacity
          onPress={openFullscreen}
          activeOpacity={0.9}
          style={{
            width: constrainedWidth,
            height: constrainedHeight,
            borderRadius: 0,
            backgroundColor: isDark ? "#1f2937" : "#e2e8f0",
            overflow: "hidden",
            position: 'relative',
          }}
        >
          {/* Video Component for thumbnail and duration extraction */}
          <Video
            ref={videoRef}
            source={{ uri: streamUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            usePoster={Boolean(posterUrl)}
            posterSource={posterUrl ? { uri: posterUrl } : undefined}
            posterStyle={{ resizeMode: 'cover' }}
            isLooping={false}
            shouldPlay={false}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
          />



          {/* Duration badge - top left */}
          {duration !== null && (
            <View
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.6)',
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderRadius: 4,
              }}
            >
              <Feather name="video" size={10} color="#fff" style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 11, color: '#fff', fontWeight: '500' }}>
                {formatDuration(duration)}
              </Text>
            </View>
          )}

          {/* Video icon badge if no duration yet */}
          {duration === null && (
            <View
              style={{
                position: 'absolute',
                top: 8,
                left: 8,
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(0,0,0,0.6)',
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderRadius: 4,
              }}
            >
              <Feather name="video" size={10} color="#fff" />
            </View>
          )}

          {/* Play button - center */}
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              justifyContent: "center",
              alignItems: "center",
            }}
            pointerEvents="none"
          >
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "rgba(0,0,0,0.5)",
                borderColor: "#fff",
                borderWidth: 2,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Feather
                name="play"
                size={20}
                color="#fff"
                style={{ marginLeft: 3 }}
              />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* Fullscreen Video Modal */}
      <FullscreenVideoModal
        visible={isModalVisible}
        streamUrl={streamUrl}
        posterUrl={posterUrl}
        onClose={closeFullscreen}
      />
    </>
  );
});

VideoThumbnail.displayName = "VideoThumbnail";

export const VideoMessageBubble = React.memo(({ 
  decryptedVideoURLs, 
  extraData, 
  isDark,
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

  return (
    <View className="mb-2">
      {videoUrls.map((url, index) => {
        const normalized = normalizeVideoSource(url);
        const widthKey = `video.${index}.width`;
        const heightKey = `video.${index}.height`;
        const rawWidth = metadata[widthKey];
        const rawHeight = metadata[heightKey];
        const videoWidth = rawWidth ? parseInt(String(rawWidth), 10) : MAX_VIDEO_WIDTH;
        const videoHeight = rawHeight ? parseInt(String(rawHeight), 10) : MAX_VIDEO_HEIGHT;
        const hasValidDimensions = typeof videoWidth === "number" && typeof videoHeight === "number" && videoWidth > 0 && videoHeight > 0;
        const aspectRatio = hasValidDimensions ? videoWidth / videoHeight : 9 / 16;

        if (!normalized.streamUrl) {
          const clientIdKey = `video.${index}.clientId`;
          const fallback = buildStreamUrlFromClientId(metadata[clientIdKey] as string | undefined);
          if (!fallback?.streamUrl) {
            return null;
          }

          return (
            <VideoThumbnail
              key={`${metadata[clientIdKey] ?? index}`}
              streamUrl={fallback.streamUrl}
              posterUrl={fallback.posterUrl}
              aspectRatio={aspectRatio}
              videoWidth={videoWidth}
              videoHeight={videoHeight}
              isDark={isDark}
              isLast={index === videoUrls.length - 1}
            />
          );
        }

        return (
          <VideoThumbnail
            key={url}
            streamUrl={normalized.streamUrl}
            posterUrl={normalized.posterUrl}
            aspectRatio={aspectRatio}
            videoWidth={videoWidth}
            videoHeight={videoHeight}
            isDark={isDark}
            isLast={index === videoUrls.length - 1}
          />
        );
      })}
    </View>
  );
});

VideoMessageBubble.displayName = "VideoMessageBubble";
