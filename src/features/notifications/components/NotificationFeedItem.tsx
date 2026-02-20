import React from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useColorScheme } from "nativewind";

import { UserAvatar } from "@/components/UserAvatar";
import { ChatBubbleLeftIcon } from "@/components/ui/ChatBubbleLeftIcon";
import { type FocusNotificationItem } from "@/lib/focus/graphql";
import { normalizeVideoSource, toPlatformSafeImageUrl } from "@/lib/mediaUrl";
import { formatPublicKey, getProfileImageUrl } from "@/utils/deso";

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PREVIEW_BLURHASH = "L6Pj0^i_.AyE_3t7t7R**0o#DgR4";

function formatTimestamp(timestamp?: string | null): string {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diff = Date.now() - date.getTime();

  if (diff < ONE_DAY_IN_MS) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getNotificationVisual(
  item: FocusNotificationItem,
  isDark: boolean,
): {
  icon?: React.ComponentProps<typeof Feather>["name"];
  useCommentIcon?: boolean;
  bg: string;
  iconColor: string;
} {
  const subcategory = item.rawSubcategory.toUpperCase();

  if (subcategory === "FOLLOW") {
    return {
      icon: "user-plus",
      bg: isDark ? "#172554" : "#dbeafe",
      iconColor: isDark ? "#93c5fd" : "#1d4ed8",
    };
  }

  if (subcategory === "POST_REPLY") {
    return {
      useCommentIcon: true,
      bg: isDark ? "#3f1d2e" : "#fce7f3",
      iconColor: isDark ? "#f9a8d4" : "#be185d",
    };
  }

  if (subcategory === "MENTION") {
    return {
      icon: "at-sign",
      bg: isDark ? "#3f3f46" : "#f4f4f5",
      iconColor: isDark ? "#d4d4d8" : "#52525b",
    };
  }

  if (subcategory === "POST_REPOST" || subcategory === "POST_QUOTE_REPOST") {
    return {
      icon: "repeat",
      bg: isDark ? "#052e16" : "#dcfce7",
      iconColor: isDark ? "#86efac" : "#15803d",
    };
  }

  if (subcategory.startsWith("REACTION_")) {
    const reactionType = subcategory.replace("REACTION_", "");
    if (reactionType === "LOVE") {
      return {
        icon: "heart",
        bg: isDark ? "#3f1d2e" : "#ffe4e6",
        iconColor: isDark ? "#fda4af" : "#be123c",
      };
    }

    return {
      icon: "thumbs-up",
      bg: isDark ? "#082f49" : "#e0f2fe",
      iconColor: isDark ? "#7dd3fc" : "#0369a1",
    };
  }

  if (item.category === "money") {
    return {
      icon: "dollar-sign",
      bg: isDark ? "#022c22" : "#ecfdf5",
      iconColor: isDark ? "#6ee7b7" : "#059669",
    };
  }

  if (item.category === "message") {
    return {
      icon: "mail",
      bg: isDark ? "#0b1f4d" : "#eff6ff",
      iconColor: isDark ? "#93c5fd" : "#2563eb",
    };
  }

  return {
    icon: "bell",
    bg: isDark ? "#1e293b" : "#f1f5f9",
    iconColor: isDark ? "#cbd5e1" : "#475569",
  };
}

function getActionText(item: FocusNotificationItem): string {
  if (item.actionText?.trim()) {
    return item.actionText.trim();
  }

  if (item.category === "money") {
    if (item.requiredPaymentAmountUsdCents > 0) {
      return `requested $${(item.requiredPaymentAmountUsdCents / 100).toFixed(2)} in messages`;
    }

    if (item.totalUnclaimedMessageTipsUsdCents > 0) {
      return `sent you a $${(item.totalUnclaimedMessageTipsUsdCents / 100).toFixed(2)} tip`;
    }

    return "has money activity in chat";
  }

  if (item.category === "message") {
    return "sent you a message";
  }

  return "interacted with your activity";
}

function getProfilePictureFromExtraData(
  extraData: Record<string, unknown> | null,
): string | null {
  const raw = extraData?.ProfilePic;
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function getNotificationPreviewMedia(item: FocusNotificationItem): {
  uri: string | null;
  isVideo: boolean;
} {
  const safeImageUrl = toPlatformSafeImageUrl(item.previewImageUrl);
  if (safeImageUrl) {
    return { uri: safeImageUrl, isVideo: false };
  }

  const rawVideoUrl = item.previewVideoUrl?.trim();
  if (!rawVideoUrl) {
    return { uri: null, isVideo: false };
  }

  const videoSource = normalizeVideoSource(rawVideoUrl);
  const safePosterUrl = toPlatformSafeImageUrl(videoSource.posterUrl);
  if (safePosterUrl) {
    return { uri: safePosterUrl, isVideo: true };
  }

  return { uri: null, isVideo: false };
}

export function NotificationFeedItem({
  item,
  onPress,
}: {
  item: FocusNotificationItem;
  onPress?: (item: FocusNotificationItem) => void;
}) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const actorName = item.actorDisplayName?.trim() ||
    item.actorUsername?.trim() ||
    formatPublicKey(item.actorPublicKey ?? "");
  const actorHandle = item.actorUsername?.trim()
    ? `@${item.actorUsername.trim()}`
    : formatPublicKey(item.actorPublicKey ?? "");
  const fallbackAvatarUri = getProfileImageUrl(item.actorPublicKey ?? undefined);
  const avatarUri = getProfilePictureFromExtraData(item.actorExtraData) || fallbackAvatarUri;
  const timestampLabel = formatTimestamp(item.timestamp);
  const actionText = getActionText(item);
  const visual = getNotificationVisual(item, isDark);
  const previewMedia = getNotificationPreviewMedia(item);
  const hasPreviewCard = item.previewText.trim().length > 0 || Boolean(previewMedia.uri);

  const content = (
    <View className="flex-row items-start gap-3">
      <View
        className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700"
        style={{
          backgroundColor: visual.bg,
        }}
      >
        {visual.useCommentIcon ? (
          <ChatBubbleLeftIcon
            size={15}
            color={visual.iconColor}
            strokeWidth={1.7}
          />
        ) : (
          <Feather
            name={visual.icon ?? "bell"}
            size={15}
            color={visual.iconColor}
          />
        )}
      </View>

      <UserAvatar uri={avatarUri} name={actorName || "?"} size={42} />

      <View className="min-w-0 flex-1 gap-1.5">
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={2}
              className="text-[15px] leading-[20px] text-slate-900 dark:text-slate-100"
            >
              <Text className="font-semibold text-slate-900 dark:text-white">
                {actorName || "Activity"}
              </Text>{" "}
              <Text className="text-slate-600 dark:text-slate-300">{actionText}</Text>
            </Text>
            <Text
              numberOfLines={1}
              className="mt-0.5 text-xs text-slate-500 dark:text-slate-400"
            >
              {actorHandle}
              {timestampLabel ? ` · ${timestampLabel}` : ""}
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            {item.unreadCount > 0 ? (
              <View className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            ) : null}
            <Feather
              name="more-horizontal"
              size={16}
              color={isDark ? "#64748b" : "#94a3b8"}
            />
          </View>
        </View>

        {hasPreviewCard ? (
          <View className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
            {previewMedia.uri ? (
              <View className="mb-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                <Image
                  source={{ uri: previewMedia.uri }}
                  style={{ width: "100%", height: 176 }}
                  contentFit="cover"
                  placeholder={{ blurhash: DEFAULT_PREVIEW_BLURHASH }}
                  placeholderContentFit="cover"
                  transition={300}
                />
                {previewMedia.isVideo ? (
                  <View className="absolute inset-0 items-center justify-center">
                    <View className="rounded-full bg-black/60 p-2">
                      <Feather name="play" size={16} color="#ffffff" />
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {item.previewText.trim().length > 0 ? (
              <Text
                numberOfLines={3}
                className="text-[13px] leading-[18px] text-slate-700 dark:text-slate-300"
              >
                {item.previewText}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) {
    return (
      <View className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityLabel={`${actorName || "Activity"} ${actionText}`}
      className="border-b border-slate-200 px-4 py-3 active:opacity-85 dark:border-slate-800"
      style={({ pressed }) => ({
        opacity: pressed ? 0.86 : 1,
      })}
    >
      {content}
    </Pressable>
  );
}
