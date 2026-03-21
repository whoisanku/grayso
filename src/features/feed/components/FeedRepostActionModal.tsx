import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { ArrowsRightLeftIcon } from "@/components/ui/ArrowsRightLeftIcon";
import { QuotePostIcon } from "@/components/ui/QuotePostIcon";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { getBorderColor } from "@/theme/borders";

export type FeedRepostActionAnchor = {
  x: number;
  y: number;
};

type FeedRepostActionModalProps = {
  visible: boolean;
  anchor: FeedRepostActionAnchor | null;
  onClose: () => void;
  onSelectRepost: () => void;
  onSelectQuote: () => void;
  isSubmittingRepost?: boolean;
};

const MENU_WIDTH = 158;
const MENU_HEIGHT = 104;
const SCREEN_EDGE_PADDING = 12;
const MENU_CONTENT_LEFT_PADDING = 14;

function getMenuPosition({
  anchor,
  windowWidth,
  windowHeight,
}: {
  anchor: FeedRepostActionAnchor | null;
  windowWidth: number;
  windowHeight: number;
}) {
  const resolvedAnchorX = anchor?.x ?? windowWidth - 24;
  const resolvedAnchorY = anchor?.y ?? windowHeight - 24;

  const maxLeft = Math.max(
    SCREEN_EDGE_PADDING,
    windowWidth - MENU_WIDTH - SCREEN_EDGE_PADDING,
  );
  // Align menu so its item content start lines up with the repost icon start line.
  const preferredLeft = resolvedAnchorX - MENU_CONTENT_LEFT_PADDING;
  const left = Math.min(
    Math.max(SCREEN_EDGE_PADDING, preferredLeft),
    maxLeft,
  );

  const maxTop = Math.max(
    SCREEN_EDGE_PADDING,
    windowHeight - MENU_HEIGHT - SCREEN_EDGE_PADDING,
  );
  // Prefer showing below the tapped repost button; fallback above if needed.
  const preferredTop = resolvedAnchorY + 6;
  const fallbackTop = resolvedAnchorY - MENU_HEIGHT - 12;
  const top =
    preferredTop <= maxTop
      ? preferredTop
      : Math.min(Math.max(SCREEN_EDGE_PADDING, fallbackTop), maxTop);

  return { left, top };
}

export function FeedRepostActionModal({
  visible,
  anchor,
  onClose,
  onSelectRepost,
  onSelectQuote,
  isSubmittingRepost = false,
}: FeedRepostActionModalProps) {
  const { isDark } = useAccentColor();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [animation] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      animation.stopAnimation();
      animation.setValue(0);
      Animated.timing(animation, {
        toValue: 1,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }
    animation.setValue(0);
  }, [animation, visible]);

  const menuPosition = useMemo(
    () =>
      getMenuPosition({
        anchor,
        windowWidth,
        windowHeight,
      }),
    [anchor, windowHeight, windowWidth],
  );

  if (!visible) {
    return null;
  }

  const backgroundOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const menuScale = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  const menuTranslateY = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 0],
  });

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent={Platform.OS === "android"}
    >
      <View className="flex-1">
        <Pressable className="absolute inset-0" onPress={onClose}>
          <Animated.View
            pointerEvents="none"
            className="absolute inset-0"
            style={{
              opacity: backgroundOpacity,
              backgroundColor: isDark
                ? "rgba(2, 6, 23, 0.2)"
                : "rgba(15, 23, 42, 0.08)",
            }}
          />
        </Pressable>

        <Animated.View
          className="absolute overflow-hidden rounded-xl border"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            width: MENU_WIDTH,
            borderWidth: 1.5,
            borderColor: getBorderColor(isDark, "contrast_medium"),
            backgroundColor: isDark ? "rgba(2, 6, 23, 0.98)" : "#ffffff",
            opacity: animation,
            transform: [{ scale: menuScale }, { translateY: menuTranslateY }],
            ...(Platform.OS === "web"
              ? ({
                  boxShadow: "0 14px 38px rgba(15, 23, 42, 0.28)",
                  transformOrigin: "top right",
                } as any)
              : {
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.24,
                  shadowRadius: 16,
                  elevation: 14,
                }),
          }}
        >
          <Pressable
            className="flex-row items-center gap-2.5 px-3.5 py-3"
            onPress={onSelectRepost}
            disabled={isSubmittingRepost}
            accessibilityRole="button"
            accessibilityLabel="Repost this post"
            style={({ pressed }) => ({
              opacity: pressed ? 0.72 : 1,
            })}
          >
            {isSubmittingRepost ? (
              <ActivityIndicator size="small" color={isDark ? "#e2e8f0" : "#334155"} />
            ) : (
              <ArrowsRightLeftIcon
                size={17}
                color={isDark ? "#e2e8f0" : "#334155"}
                strokeWidth={1.8}
              />
            )}
            <Text
              className="text-[14px] font-semibold"
              style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
            >
              {isSubmittingRepost ? "Reposting..." : "Repost"}
            </Text>
          </Pressable>

          <View
            style={{
              height: 1,
              backgroundColor: getBorderColor(isDark, "subtle"),
            }}
          />

          <Pressable
            className="flex-row items-center gap-2.5 px-3.5 py-3"
            onPress={onSelectQuote}
            disabled={isSubmittingRepost}
            accessibilityRole="button"
            accessibilityLabel="Quote this post"
            style={({ pressed }) => ({
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <QuotePostIcon
              size={17}
              color={isDark ? "#e2e8f0" : "#334155"}
              strokeWidth={1.85}
            />
            <Text
              className="text-[14px] font-semibold"
              style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
            >
              Quote
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}
