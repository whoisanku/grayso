import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";

import { type FocusFeedPost } from "@/lib/focus/graphql";
import { FALLBACK_PROFILE_IMAGE, getProfileImageUrl } from "@/utils/deso";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { FeedVideo } from "@/features/feed/components/FeedVideo";
import { FeedImageGrid } from "@/features/feed/components/FeedImageGrid";
import { getValidHttpUrl, toPlatformSafeImageUrl } from "@/lib/mediaUrl";

const DEFAULT_IMAGE_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

type FeedAuthor = {
  publicKey?: string | null;
  username?: string | null;
  extraData?: Record<string, unknown> | null;
};

function parseFocusTimestamp(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hasTimezoneSuffix =
    trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed);

  const normalized = hasTimezoneSuffix ? trimmed : `${trimmed}Z`;
  const millisPrecision = normalized.replace(
    /\.(\d{3})\d+(?=Z|[+-]\d{2}:\d{2}$)/,
    ".$1",
  );
  const timestamp = new Date(millisPrecision);

  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}

function formatRelativeTimestamp(value: string | null | undefined): string {
  if (!value) return "";

  const timestamp = parseFocusTimestamp(value);
  if (!timestamp) {
    return "";
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "now";
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;

  return timestamp.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatCount(value: number | null | undefined): string {
  const count = Number(value ?? 0);
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count < 1000) return `${Math.floor(count)}`;
  if (count < 10000) return `${(count / 1000).toFixed(1)}K`;
  if (count < 1_000_000) return `${Math.floor(count / 1000)}K`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

function getAuthorPresentation(author: FeedAuthor | null | undefined) {
  const username = author?.username?.trim() || "unknown";

  const rawDisplayName = author?.extraData?.DisplayName;
  const displayName =
    typeof rawDisplayName === "string" && rawDisplayName.trim()
      ? rawDisplayName.trim()
      : username;

  const largeProfilePic = getValidHttpUrl(author?.extraData?.LargeProfilePicURL);
  const generatedProfilePic = getValidHttpUrl(
    getProfileImageUrl(author?.publicKey ?? undefined),
  );
  const avatarUriRaw =
    generatedProfilePic ?? largeProfilePic ?? FALLBACK_PROFILE_IMAGE;
  const avatarUri = toPlatformSafeImageUrl(avatarUriRaw) ?? FALLBACK_PROFILE_IMAGE;

  return {
    username,
    displayName,
    avatarUri,
  };
}

function renderMedia({
  imageUrls,
  videoUrl,
  isDark,
  isVisible,
  compact = false,
}: {
  imageUrls?: (string | null | undefined)[] | null;
  videoUrl?: string | null;
  isDark: boolean;
  isVisible: boolean;
  compact?: boolean;
}) {
  if (videoUrl) {
    return (
      <View className="mt-3 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
        <FeedVideo url={videoUrl} isActive={isVisible} isDark={isDark} />
      </View>
    );
  }

  if (imageUrls?.length) {
    return <FeedImageGrid imageUrls={imageUrls} compact={compact} />;
  }

  return null;
}

export function FeedCard({
  post,
  isVisible,
  onPress,
  onReplyPress,
}: {
  post: FocusFeedPost;
  isVisible: boolean;
  onPress?: (post: FocusFeedPost) => void;
  onReplyPress?: (post: FocusFeedPost) => void;
}) {
  const { isDark, accentColor } = useAccentColor();

  const postBody = post.body?.trim() ?? "";
  const postStats = post.postStats;
  const repostedPost = post.repostedPost;
  const repostBody = repostedPost?.body?.trim() ?? "";
  const isPureRepost = Boolean(repostedPost?.postHash && !postBody);

  const {
    username: actorUsernameHandle,
    displayName: actorDisplayName,
    avatarUri: actorAvatarUri,
  } = getAuthorPresentation(post.poster);
  const {
    username: embeddedUsernameHandle,
    displayName: embeddedDisplayName,
    avatarUri: embeddedAvatarUri,
  } = getAuthorPresentation(repostedPost?.poster);

  const usernameHandle = isPureRepost
    ? embeddedUsernameHandle
    : actorUsernameHandle;
  const displayName = isPureRepost ? embeddedDisplayName : actorDisplayName;
  const avatarUri = isPureRepost ? embeddedAvatarUri : actorAvatarUri;
  const reposterLabel = actorDisplayName || actorUsernameHandle;
  const primaryTimestamp = isPureRepost
    ? repostedPost?.timestamp ?? post.timestamp
    : post.timestamp;
  const formattedPrimaryTimestamp = formatRelativeTimestamp(primaryTimestamp);

  const primaryBody = isPureRepost ? repostBody : postBody;
  const primaryImageUrls = isPureRepost
    ? repostedPost?.imageUrls
    : post.imageUrls;
  const primaryVideoUrl = isPureRepost
    ? repostedPost?.videoUrls?.[0]
    : post.videoUrls?.[0];

  const hasEmbeddedRepostCard = Boolean(
    !isPureRepost && postBody && repostedPost?.postHash,
  );

  const likeCount =
    postStats?.totalReactionCount ?? postStats?.likeReactionCount;
  const repostCount =
    (postStats?.repostCount ?? 0) + (postStats?.quoteCount ?? 0);

  return (
    <Pressable
      onPress={() => onPress?.(post)}
      className="border-b border-slate-200 px-4 py-3 dark:border-slate-800"
      style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
    >
      {isPureRepost ? (
        <View className="mb-1.5 flex-row items-center gap-1">
          <Feather
            name="repeat"
            size={13}
            color={isDark ? "#94a3b8" : "#64748b"}
          />
          <Text className="text-[12px] text-slate-500 dark:text-slate-400">
            Reposted by {reposterLabel}
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-start">
        <Image
          source={{ uri: avatarUri }}
          style={{ width: 44, height: 44, borderRadius: 22 }}
          className="bg-slate-200 dark:bg-slate-700"
          contentFit="cover"
          placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
          transition={500}
        />

        <View className="ml-3 flex-1">
          {isPureRepost ? (
            <View className="flex-row items-center gap-1.5">
              <Text
                numberOfLines={1}
                className="text-[15px] font-semibold text-slate-900 dark:text-white"
              >
                {displayName}
              </Text>
              <Text
                numberOfLines={1}
                className="min-w-0 flex-1 text-[15px] text-slate-500 dark:text-slate-400"
              >
                @{usernameHandle}
                {formattedPrimaryTimestamp ? ` · ${formattedPrimaryTimestamp}` : ""}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <Text
                  numberOfLines={1}
                  className="text-[15px] font-semibold text-slate-900 dark:text-white"
                >
                  {displayName}
                </Text>
                <Text
                  numberOfLines={1}
                  className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400"
                >
                  @{usernameHandle}
                </Text>
              </View>

              <Text className="text-[12px] text-slate-500 dark:text-slate-400">
                {formattedPrimaryTimestamp}
              </Text>
            </View>
          )}

          {primaryBody ? (
            <Text className="mt-1 text-[15px] leading-6 text-slate-900 dark:text-slate-100">
              {primaryBody}
            </Text>
          ) : null}

          {renderMedia({
            imageUrls: primaryImageUrls,
            videoUrl: primaryVideoUrl,
            isDark,
            isVisible: isVisible || Platform.OS !== "web",
          })}

          {hasEmbeddedRepostCard ? (
            <View className="mt-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <View className="flex-row items-start">
                <Image
                  source={{ uri: embeddedAvatarUri }}
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                  className="bg-slate-200 dark:bg-slate-700"
                  contentFit="cover"
                  placeholder={{ blurhash: DEFAULT_IMAGE_BLURHASH }}
                  transition={500}
                />

                <View className="ml-2.5 flex-1">
                  <Text
                    numberOfLines={1}
                    className="text-[13px] font-semibold text-slate-900 dark:text-white"
                  >
                    {embeddedDisplayName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400"
                  >
                    @{embeddedUsernameHandle}
                  </Text>
                </View>
              </View>

              {repostBody ? (
                <Text className="mt-2 text-[14px] leading-5 text-slate-900 dark:text-slate-100">
                  {repostBody}
                </Text>
              ) : null}

              {renderMedia({
                imageUrls: repostedPost?.imageUrls,
                videoUrl: repostedPost?.videoUrls?.[0],
                isDark,
                isVisible: isVisible || Platform.OS !== "web",
                compact: true,
              })}
            </View>
          ) : null}

          <View className="mt-3 flex-row items-center justify-between">
            <Pressable
              className="flex-row items-center gap-1 rounded-full px-1 py-1"
              onPress={(event) => {
                event.stopPropagation?.();
                onReplyPress?.(post);
              }}
              accessibilityRole="button"
              accessibilityLabel="Reply to this post"
              style={({ pressed }) => ({
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Feather
                name="message-circle"
                size={15}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
              <Text className="text-xs text-slate-500 dark:text-slate-400">
                {formatCount(postStats?.replyCount)}
              </Text>
            </Pressable>

            <View className="flex-row items-center gap-1">
              <Feather
                name="repeat"
                size={15}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
              <Text className="text-xs text-slate-500 dark:text-slate-400">
                {formatCount(repostCount)}
              </Text>
            </View>

            <View className="flex-row items-center gap-1">
              <Feather name="heart" size={15} color={accentColor} />
              <Text className="text-xs text-slate-500 dark:text-slate-400">
                {formatCount(likeCount)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
