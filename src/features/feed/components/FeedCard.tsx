import React from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { DeSoIdentityContext } from "react-deso-protocol";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Repeat2, ThumbsUp } from "lucide-react-native";

import { type FocusFeedPost } from "@/lib/focus/graphql";
import { getProfileImageUrl } from "@/utils/deso";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { FeedVideo } from "@/features/feed/components/FeedVideo";
import { FeedImageGrid } from "@/features/feed/components/FeedImageGrid";
import { ExpandablePostText } from "@/features/feed/components/ExpandablePostText";
import { getValidHttpUrl, toPlatformSafeImageUrl } from "@/lib/mediaUrl";
import { UserAvatar } from "@/components/UserAvatar";
import { parseRichTextContent } from "@/lib/richText";
import { Toast } from "@/components/ui/Toast";
import { ChatBubbleLeftIcon } from "@/components/ui/ChatBubbleLeftIcon";
import { feedKeys } from "@/features/feed/api/keys";
import {
  FOCUS_POST_REACTION_OPTIONS,
  extractViewerReactionAssociations,
  getReactionOption,
  type FocusPostReactionValue,
  type PostReactionAssociation,
  useSetPostReactionAssociation,
} from "@/features/feed/api/usePostReactionAssociation";

type FeedAuthor = {
  publicKey?: string | null;
  username?: string | null;
  extraData?: Record<string, unknown> | null;
};

type ReactionCountMap = Record<FocusPostReactionValue, number>;

const REACTION_VALUES = FOCUS_POST_REACTION_OPTIONS.map(
  (option) => option.value,
) as FocusPostReactionValue[];

function normalizeDisplayName(rawValue: unknown, username: string): string {
  if (typeof rawValue !== "string") {
    return username;
  }

  const normalized = rawValue
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized === "@") {
    return username;
  }

  const lower = normalized.toLowerCase();
  if (lower === "null" || lower === "undefined") {
    return username;
  }

  return normalized;
}

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

function toCount(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.floor(parsed);
}

function getAuthorPresentation(author: FeedAuthor | null | undefined) {
  const username = author?.username?.trim() || "unknown";

  const rawDisplayName = author?.extraData?.DisplayName ?? null;
  const displayName = normalizeDisplayName(rawDisplayName, username);

  const largeProfilePic = getValidHttpUrl(author?.extraData?.LargeProfilePicURL);
  const generatedProfilePic = author?.publicKey
    ? getValidHttpUrl(getProfileImageUrl(author.publicKey))
    : null;
  const avatarUriRaw = largeProfilePic ?? generatedProfilePic ?? null;
  const avatarUri = avatarUriRaw
    ? (toPlatformSafeImageUrl(avatarUriRaw) ?? avatarUriRaw)
    : null;

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

function getBaseReactionCounts(post: FocusFeedPost): ReactionCountMap {
  return {
    LIKE: toCount(
      post.likeReactions?.totalCount ?? post.postStats?.likeReactionCount,
    ),
    DISLIKE: toCount(
      post.dislikeReactions?.totalCount ?? post.postStats?.dislikeReactionCount,
    ),
    LOVE: toCount(
      post.loveReactions?.totalCount ?? post.postStats?.loveReactionCount,
    ),
    LAUGH: toCount(
      post.laughReactions?.totalCount ?? post.postStats?.laughReactionCount,
    ),
    SAD: toCount(post.sadReactions?.totalCount),
    CRY: toCount(
      post.cryReactions?.totalCount ?? post.postStats?.astonishedReactionCount,
    ),
    ANGRY: toCount(
      post.angryReactions?.totalCount ?? post.postStats?.angryReactionCount,
    ),
  };
}

export function FeedCard({
  post,
  isVisible,
  onPress,
  onReplyPress,
  onReactionSummaryPress,
}: {
  post: FocusFeedPost;
  isVisible: boolean;
  onPress?: (post: FocusFeedPost) => void;
  onReplyPress?: (post: FocusFeedPost) => void;
  onReactionSummaryPress?: (post: FocusFeedPost) => void;
}) {
  const { isDark } = useAccentColor();
  const { currentUser } = React.useContext(DeSoIdentityContext);
  const queryClient = useQueryClient();
  const {
    mutateAsync: setPostReactionAssociationAsync,
    isPending: isUpdatingReaction,
  } = useSetPostReactionAssociation();

  const [isReactionPickerVisible, setIsReactionPickerVisible] =
    React.useState(false);
  const [reactionPickerAnimation] = React.useState(
    () => new Animated.Value(0),
  );
  const [emojiItemAnimations] = React.useState(() =>
    FOCUS_POST_REACTION_OPTIONS.map(() => new Animated.Value(0)),
  );
  const [emojiHoverAnimations] = React.useState(() =>
    FOCUS_POST_REACTION_OPTIONS.map(() => new Animated.Value(1)),
  );
  const reactionPickerCloseTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const viewerReactionAssociations = React.useMemo(
    () => extractViewerReactionAssociations(post),
    [post],
  );
  const viewerReactionAssociationsKey = React.useMemo(
    () =>
      viewerReactionAssociations
        .map(
          (association) =>
            `${association.associationId}:${association.associationValue}`,
        )
        .join("|"),
    [viewerReactionAssociations],
  );

  const initialReactionValue =
    viewerReactionAssociations[0]?.associationValue ?? null;

  const [knownReactionAssociations, setKnownReactionAssociations] =
    React.useState<PostReactionAssociation[]>(viewerReactionAssociations);
  const [currentReactionValue, setCurrentReactionValue] = React.useState<
    FocusPostReactionValue | null
  >(initialReactionValue);

  React.useEffect(() => {
    setKnownReactionAssociations(viewerReactionAssociations);
    setCurrentReactionValue(initialReactionValue);
    setIsReactionPickerVisible(false);
    reactionPickerAnimation.setValue(0);
    for (const anim of emojiItemAnimations) {
      anim.setValue(0);
    }
  }, [
    initialReactionValue,
    post.postHash,
    reactionPickerAnimation,
    emojiItemAnimations,
    viewerReactionAssociations,
    viewerReactionAssociationsKey,
  ]);

  React.useEffect(
    () => () => {
      if (reactionPickerCloseTimeoutRef.current) {
        clearTimeout(reactionPickerCloseTimeoutRef.current);
      }
    },
    [],
  );

  const clearReactionPickerCloseTimeout = React.useCallback(() => {
    if (!reactionPickerCloseTimeoutRef.current) {
      return;
    }

    clearTimeout(reactionPickerCloseTimeoutRef.current);
    reactionPickerCloseTimeoutRef.current = null;
  }, []);

  const openReactionPicker = React.useCallback(
    (event?: { stopPropagation?: () => void }) => {
      event?.stopPropagation?.();
      clearReactionPickerCloseTimeout();
      setIsReactionPickerVisible(true);

      // Container fade in
      Animated.timing(reactionPickerAnimation, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      // Staggered bounce-in for each emoji (Facebook-like)
      const staggeredAnimations = emojiItemAnimations.map((anim, index) => {
        anim.setValue(0);
        return Animated.sequence([
          Animated.delay(index * 40),
          Animated.spring(anim, {
            toValue: 1,
            friction: 5,
            tension: 200,
            useNativeDriver: true,
          }),
        ]);
      });
      Animated.parallel(staggeredAnimations).start();
    },
    [clearReactionPickerCloseTimeout, reactionPickerAnimation, emojiItemAnimations],
  );

  const closeReactionPicker = React.useCallback(() => {
    clearReactionPickerCloseTimeout();

    // Reverse stagger out
    const staggeredOut = emojiItemAnimations.map((anim, index) =>
      Animated.sequence([
        Animated.delay(index * 20),
        Animated.timing(anim, {
          toValue: 0,
          duration: 100,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    Animated.parallel([
      ...staggeredOut,
      Animated.timing(reactionPickerAnimation, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setIsReactionPickerVisible(false);
      }
    });
  }, [clearReactionPickerCloseTimeout, reactionPickerAnimation, emojiItemAnimations]);

  // Facebook-like: 1.5 second delay before closing
  const scheduleReactionPickerClose = React.useCallback(() => {
    clearReactionPickerCloseTimeout();
    reactionPickerCloseTimeoutRef.current = setTimeout(() => {
      closeReactionPicker();
    }, 800);
  }, [clearReactionPickerCloseTimeout, closeReactionPicker]);

  const handleEmojiHoverIn = React.useCallback(
    (index: number) => {
      Animated.spring(emojiHoverAnimations[index], {
        toValue: 1.35,
        friction: 4,
        tension: 300,
        useNativeDriver: true,
      }).start();
    },
    [emojiHoverAnimations],
  );

  const handleEmojiHoverOut = React.useCallback(
    (index: number) => {
      Animated.spring(emojiHoverAnimations[index], {
        toValue: 1,
        friction: 5,
        tension: 200,
        useNativeDriver: true,
      }).start();
    },
    [emojiHoverAnimations],
  );

  const rawPostBody = post.body?.trim() ?? "";
  const postStats = post.postStats;
  const repostedPost = post.repostedPost;
  const isPureRepost = Boolean(repostedPost?.postHash && !rawPostBody);

  const parsedPostContent = parseRichTextContent({
    body: post.body,
    imageUrls: post.imageUrls,
  });
  const parsedRepostContent = parseRichTextContent({
    body: repostedPost?.body,
    imageUrls: repostedPost?.imageUrls,
  });

  const postBody = parsedPostContent.text;
  const repostBody = parsedRepostContent.text;

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
    ? parsedRepostContent.imageUrls
    : parsedPostContent.imageUrls;
  const primaryVideoUrl = isPureRepost
    ? repostedPost?.videoUrls?.[0]
    : post.videoUrls?.[0];

  const hasEmbeddedRepostCard = Boolean(
    !isPureRepost && postBody && repostedPost?.postHash,
  );

  const replyCount = toCount(postStats?.replyCount);
  const repostCount =
    toCount(postStats?.repostCount) + toCount(postStats?.quoteCount);

  const baseReactionCounts = React.useMemo(() => getBaseReactionCounts(post), [post]);

  const displayedReactionCounts = React.useMemo<ReactionCountMap>(() => {
    const adjusted: ReactionCountMap = {
      ...baseReactionCounts,
    };

    if (initialReactionValue) {
      adjusted[initialReactionValue] = Math.max(
        0,
        adjusted[initialReactionValue] - 1,
      );
    }

    if (currentReactionValue) {
      adjusted[currentReactionValue] += 1;
    }

    return adjusted;
  }, [baseReactionCounts, currentReactionValue, initialReactionValue]);

  const displayedTotalReactionCount = React.useMemo(
    () =>
      REACTION_VALUES.reduce(
        (total, reactionValue) => total + displayedReactionCounts[reactionValue],
        0,
      ),
    [displayedReactionCounts],
  );

  const topReactionBadges = React.useMemo(
    () =>
      FOCUS_POST_REACTION_OPTIONS.map((option) => ({
        ...option,
        count: displayedReactionCounts[option.value],
      }))
        .filter((option) => option.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3),
    [displayedReactionCounts],
  );

  const selectedReactionOption = getReactionOption(currentReactionValue);
  const likeActionLabel = selectedReactionOption?.label ?? "Like";

  const mutedIconColor = isDark ? "#94a3b8" : "#64748b";
  const mutedCountColor = isDark ? "#94a3b8" : "#64748b";
  const likeActionColor = selectedReactionOption
    ? selectedReactionOption.color
    : mutedIconColor;

  const interactionSummaryItems = React.useMemo(() => {
    const items: string[] = [];

    if (replyCount > 0) {
      items.push(`${formatCount(replyCount)} comments`);
    }

    if (repostCount > 0) {
      items.push(`${formatCount(repostCount)} reposts`);
    }

    return items;
  }, [replyCount, repostCount]);

  const hasInteractionSummary =
    displayedTotalReactionCount > 0 || interactionSummaryItems.length > 0;

  const applyReaction = React.useCallback(
    async (
      nextReactionValue: FocusPostReactionValue | null,
      event?: { stopPropagation?: () => void },
    ) => {
      event?.stopPropagation?.();
      closeReactionPicker();

      const readerPublicKey = currentUser?.PublicKeyBase58Check?.trim();
      if (!readerPublicKey) {
        Toast.show({
          type: "error",
          text1: "Login required",
          text2: "Sign in to react to posts.",
        });
        return;
      }

      if (isUpdatingReaction) {
        return;
      }

      const previousReactionValue = currentReactionValue;
      const previousAssociations = knownReactionAssociations;

      setCurrentReactionValue(nextReactionValue);

      try {
        const result = await setPostReactionAssociationAsync({
          readerPublicKey,
          postHash: post.postHash,
          reactionValue: nextReactionValue,
          existingAssociations: knownReactionAssociations,
        });

        setCurrentReactionValue(result.currentReaction);
        setKnownReactionAssociations(result.associations);
        void queryClient.invalidateQueries({
          queryKey: feedKeys.postReactions(post.postHash),
        });
      } catch (error) {
        setCurrentReactionValue(previousReactionValue);
        setKnownReactionAssociations(previousAssociations);

        const message =
          error instanceof Error && error.message
            ? error.message
            : "Please try again.";

        Toast.show({
          type: "error",
          text1: "Unable to update reaction",
          text2: message,
        });
      }
    },
    [
      closeReactionPicker,
      currentReactionValue,
      currentUser?.PublicKeyBase58Check,
      isUpdatingReaction,
      knownReactionAssociations,
      post.postHash,
      queryClient,
      setPostReactionAssociationAsync,
    ],
  );

  const handlePrimaryLikePress = React.useCallback(
    (event: { stopPropagation?: () => void }) => {
      const nextReactionValue = currentReactionValue ? null : "LIKE";
      void applyReaction(nextReactionValue, event);
    },
    [applyReaction, currentReactionValue],
  );

  const actionButtonStyle = React.useCallback(
    ({ pressed }: { pressed: boolean }) => {
      const style: { opacity: number; cursor?: "pointer" } = {
        opacity: pressed ? 0.74 : 1,
      };

      if (Platform.OS === "web") {
        style.cursor = "pointer";
      }

      return style;
    },
    [],
  );

  const reactionPickerTranslateY = reactionPickerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

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
        <UserAvatar uri={avatarUri} name={displayName} size={44} />

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
                {formattedPrimaryTimestamp
                  ? ` · ${formattedPrimaryTimestamp}`
                  : ""}
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
            <ExpandablePostText
              text={primaryBody}
              collapsedChars={430}
              textClassName="mt-1 text-[15px] leading-6 text-slate-900 dark:text-slate-100"
              toggleClassName="text-[13px] font-semibold text-sky-600 dark:text-sky-400"
            />
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
                <UserAvatar
                  uri={embeddedAvatarUri}
                  name={embeddedDisplayName}
                  size={32}
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
                <ExpandablePostText
                  text={repostBody}
                  collapsedChars={260}
                  textClassName="mt-2 text-[14px] leading-5 text-slate-900 dark:text-slate-100"
                  toggleClassName="text-[12px] font-semibold text-sky-600 dark:text-sky-400"
                />
              ) : null}

              {renderMedia({
                imageUrls: parsedRepostContent.imageUrls,
                videoUrl: repostedPost?.videoUrls?.[0],
                isDark,
                isVisible: isVisible || Platform.OS !== "web",
                compact: true,
              })}
            </View>
          ) : null}
        </View>
      </View>

      {hasInteractionSummary ? (
        <View className="mt-3 flex-row items-center justify-between">
          {displayedTotalReactionCount > 0 ? (
            <Pressable
              onPress={(event) => {
                event.stopPropagation?.();
                onReactionSummaryPress?.(post);
              }}
              accessibilityRole="button"
              accessibilityLabel="View reactions"
              style={actionButtonStyle}
            >
              <View className="flex-row items-center">
                {topReactionBadges.map((reaction, index) => (
                  <View
                    key={reaction.value}
                    className="h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
                    style={{
                      marginLeft: index === 0 ? 0 : -6,
                      zIndex: topReactionBadges.length - index,
                    }}
                  >
                    <Text className="text-[10px] leading-[10px]">
                      {reaction.emoji}
                    </Text>
                  </View>
                ))}

                <Text className="ml-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                  {formatCount(displayedTotalReactionCount)}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View className="flex-row items-center" />
          )}

          <View className="flex-row items-center gap-3">
            {interactionSummaryItems.map((item) => (
              <Text
                key={item}
                className="text-[12px] text-slate-500 dark:text-slate-400"
              >
                {item}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <View
        className={
          hasInteractionSummary
            ? "mt-1 flex-row items-center"
            : "mt-3 flex-row items-center"
        }
      >
        <View className="relative flex-1">
          {isReactionPickerVisible ? (
            <Pressable
              className="absolute bottom-full left-0 mb-1"
              onPress={(event) => event.stopPropagation?.()}
              onHoverIn={
                Platform.OS === "web"
                  ? clearReactionPickerCloseTimeout
                  : undefined
              }
              onHoverOut={
                Platform.OS === "web"
                  ? scheduleReactionPickerClose
                  : undefined
              }
            >
              <Animated.View
                style={[
                  reactionPickerStyles.container,
                  {
                    opacity: reactionPickerAnimation,
                    transform: [{ translateY: reactionPickerTranslateY }],
                  },
                ]}
              >
                {FOCUS_POST_REACTION_OPTIONS.map((reactionOption, index) => {
                  const itemScale = emojiItemAnimations[index].interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1.2, 1],
                  });
                  const itemTranslateY = emojiItemAnimations[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  });

                  return (
                    <Animated.View
                      key={reactionOption.value}
                      style={{
                        opacity: emojiItemAnimations[index],
                        transform: [
                          { scale: Animated.multiply(itemScale, emojiHoverAnimations[index]) },
                          { translateY: itemTranslateY },
                        ],
                      }}
                    >
                      <Pressable
                        className="items-center justify-center rounded-full"
                        style={reactionPickerStyles.emojiButton}
                        onPress={(event) => {
                          const nextReactionValue =
                            currentReactionValue === reactionOption.value
                              ? null
                              : reactionOption.value;
                          void applyReaction(nextReactionValue, event);
                        }}
                        onHoverIn={
                          Platform.OS === "web"
                            ? () => handleEmojiHoverIn(index)
                            : undefined
                        }
                        onHoverOut={
                          Platform.OS === "web"
                            ? () => handleEmojiHoverOut(index)
                            : undefined
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`React with ${reactionOption.label}`}
                      >
                        <Text style={reactionPickerStyles.emojiText}>
                          {reactionOption.emoji}
                        </Text>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </Animated.View>
            </Pressable>
          ) : null}

          <Pressable
            className="flex-row items-center justify-center gap-1.5 rounded-full py-1.5"
            onPress={handlePrimaryLikePress}
            onLongPress={openReactionPicker}
            delayLongPress={170}
            onHoverIn={Platform.OS === "web" ? openReactionPicker : undefined}
            onHoverOut={
              Platform.OS === "web" ? scheduleReactionPickerClose : undefined
            }
            accessibilityRole="button"
            accessibilityLabel={
              currentReactionValue
                ? `Remove ${likeActionLabel} reaction`
                : "Like this post"
            }
            style={actionButtonStyle}
          >
            {selectedReactionOption ? (
              <Text className="text-[18px] leading-[20px]">
                {selectedReactionOption.emoji}
              </Text>
            ) : (
              <ThumbsUp
                size={16}
                strokeWidth={1.9}
                color={mutedIconColor}
                fill="none"
              />
            )}

            <Text
              className="text-[13px] font-medium"
              style={{ color: likeActionColor }}
            >
              {likeActionLabel}
            </Text>
          </Pressable>
        </View>

        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-1.5"
          onPress={(event) => {
            event.stopPropagation?.();
          }}
          accessibilityRole="button"
          accessibilityLabel="Repost this post"
          style={actionButtonStyle}
        >
          <Repeat2
            size={16}
            strokeWidth={1.9}
            color={mutedIconColor}
            fill="none"
          />
          <Text
            className="text-[13px] font-medium"
            style={{ color: mutedCountColor }}
          >
            Repost
          </Text>
        </Pressable>

        <Pressable
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-1.5"
          onPress={(event) => {
            event.stopPropagation?.();
            onReplyPress?.(post);
          }}
          accessibilityRole="button"
          accessibilityLabel="Comment on this post"
          style={actionButtonStyle}
        >
          <ChatBubbleLeftIcon
            size={16}
            color={mutedIconColor}
            strokeWidth={1.7}
          />
          <Text className="text-[13px] font-medium" style={{ color: mutedCountColor }}>
            Comment
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// Styles for the reaction picker (using StyleSheet for Reanimated/Animated shared values)
const reactionPickerStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: Platform.select({
      web: "rgba(15, 23, 42, 0.92)",
      default: "rgba(15, 23, 42, 0.95)",
    }),
    // Subtle shadow for depth
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(148,163,184,0.12)",
          backdropFilter: "blur(12px)",
        }
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 8,
        }),
  },
  emojiButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 26,
    lineHeight: 30,
  },
});
