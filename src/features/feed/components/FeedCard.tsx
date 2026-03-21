import React from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  View,
} from "react-native";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useQueryClient } from "@tanstack/react-query";

import {
  useIsFollowingAccount,
  useToggleFollowingAccount,
} from "@/features/feed/api/useFollowAccount";
import { type FocusFeedPost } from "@/lib/focus/graphql";
import { getProfileImageUrl } from "@/utils/deso";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { FeedVideo } from "@/features/feed/components/FeedVideo";
import { FeedImageGrid } from "@/features/feed/components/FeedImageGrid";
import { getValidHttpUrl, toPlatformSafeImageUrl } from "@/lib/mediaUrl";
import { UserAvatar } from "@/components/UserAvatar";
import { CommentIcon } from "@/components/icons/CommentIcon";
import { HeartIcon } from "@/components/icons/HeartIcon";
import { RepostIcon } from "@/components/icons/RepostIcon";
import { parseRichTextContent } from "@/lib/richText";
import { Toast } from "@/components/ui/Toast";
import { ReactionIcon } from "@/components/ui/ReactionIcon";
import { feedKeys } from "@/features/feed/api/keys";
import { applyOptimisticReactionUpdate } from "@/features/feed/api/optimisticUpdates";
import { getBorderColor } from "@/theme/borders";
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

type FeedProfileTarget = {
  publicKey?: string | null;
  username?: string | null;
};

type ReactionCountMap = Record<FocusPostReactionValue, number>;

const REACTION_VALUES = FOCUS_POST_REACTION_OPTIONS.map(
  (option) => option.value,
) as FocusPostReactionValue[];
const REACTION_PICKER_HOVER_OPEN_DELAY_MS = 380;
const REACTION_PICKER_HOVER_CLOSE_DELAY_MS = 140;
const FEED_COLLAPSED_BODY_MAX_LINES = 5;
const FEED_COLLAPSED_EMBEDDED_BODY_MAX_LINES = 4;
const FEED_BODY_TOGGLE_MIN_CHARACTERS = 220;
const FEED_EMBEDDED_BODY_TOGGLE_MIN_CHARACTERS = 180;

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

function formatDetailedTimestamp(value: string | null | undefined): string {
  if (!value) return "";

  const timestamp = parseFocusTimestamp(value);
  if (!timestamp) {
    return "";
  }

  const timeText = timestamp.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const dateText = timestamp.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return `${timeText} · ${dateText}`;
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
  onRepostPress,
  onProfilePress,
  onReactionSummaryPress,
  initialIsFollowingAuthor = null,
  variant = "feed",
  threadChildLineVisible = false,
  threadLineColor,
}: {
  post: FocusFeedPost;
  isVisible: boolean;
  onPress?: (post: FocusFeedPost) => void;
  onReplyPress?: (post: FocusFeedPost) => void;
  onRepostPress?: (
    post: FocusFeedPost,
    anchor: { x: number; y: number },
  ) => void;
  onProfilePress?: (profile: FeedProfileTarget) => void;
  onReactionSummaryPress?: (post: FocusFeedPost) => void;
  initialIsFollowingAuthor?: boolean | null;
  variant?: "feed" | "thread" | "threadReply";
  threadChildLineVisible?: boolean;
  threadLineColor?: string;
}) {
  const { isDark, accentColor, accentStrong } = useAccentColor();
  const { currentUser } = React.useContext(DeSoIdentityContext);
  const queryClient = useQueryClient();
  const {
    mutateAsync: setPostReactionAssociationAsync,
    isPending: isUpdatingReaction,
  } = useSetPostReactionAssociation();
  const {
    mutateAsync: toggleFollowingAsync,
    isPending: isUpdatingFollow,
  } = useToggleFollowingAccount();

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
  const [optimisticIsFollowing, setOptimisticIsFollowing] = React.useState<
    boolean | null
  >(null);
  const [isThreadAnchorFollowHovered, setIsThreadAnchorFollowHovered] =
    React.useState(false);
  const [isThreadAnchorReplyHovered, setIsThreadAnchorReplyHovered] =
    React.useState(false);
  const [isThreadAnchorRepostHovered, setIsThreadAnchorRepostHovered] =
    React.useState(false);
  const [isThreadAnchorLikeHovered, setIsThreadAnchorLikeHovered] =
    React.useState(false);
  const [isFeedReplyHovered, setIsFeedReplyHovered] = React.useState(false);
  const [isFeedRepostHovered, setIsFeedRepostHovered] = React.useState(false);
  const [isFeedLikeHovered, setIsFeedLikeHovered] = React.useState(false);
  const [isFeedBodyExpanded, setIsFeedBodyExpanded] = React.useState(false);
  const [isFeedEmbeddedBodyExpanded, setIsFeedEmbeddedBodyExpanded] =
    React.useState(false);
  const pendingReactionSyncValueRef = React.useRef<
    FocusPostReactionValue | null | undefined
  >(undefined);
  const lastReactionPostHashRef = React.useRef(post.postHash);
  const reactionPickerOpenTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const reactionPickerCloseTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const reactionTriggerRef = React.useRef<any>(null);
  const reactionPickerRef = React.useRef<any>(null);

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
    const isNewPost = lastReactionPostHashRef.current !== post.postHash;

    if (isNewPost) {
      lastReactionPostHashRef.current = post.postHash;
      pendingReactionSyncValueRef.current = undefined;
      setKnownReactionAssociations(viewerReactionAssociations);
      setCurrentReactionValue(initialReactionValue);
    } else {
      const pendingReactionSyncValue = pendingReactionSyncValueRef.current;

      if (pendingReactionSyncValue === undefined) {
        setKnownReactionAssociations(viewerReactionAssociations);
        setCurrentReactionValue(initialReactionValue);
      }
    }

    setIsReactionPickerVisible(false);
    if (reactionPickerOpenTimeoutRef.current) {
      clearTimeout(reactionPickerOpenTimeoutRef.current);
      reactionPickerOpenTimeoutRef.current = null;
    }
    if (reactionPickerCloseTimeoutRef.current) {
      clearTimeout(reactionPickerCloseTimeoutRef.current);
      reactionPickerCloseTimeoutRef.current = null;
    }
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

  React.useEffect(() => {
    setOptimisticIsFollowing(null);
    setIsThreadAnchorFollowHovered(false);
    setIsThreadAnchorReplyHovered(false);
    setIsThreadAnchorRepostHovered(false);
    setIsThreadAnchorLikeHovered(false);
    setIsFeedReplyHovered(false);
    setIsFeedRepostHovered(false);
    setIsFeedLikeHovered(false);
    setIsFeedBodyExpanded(false);
    setIsFeedEmbeddedBodyExpanded(false);
  }, [post.poster?.publicKey, post.postHash]);

  React.useEffect(
    () => () => {
      if (reactionPickerOpenTimeoutRef.current) {
        clearTimeout(reactionPickerOpenTimeoutRef.current);
      }
      if (reactionPickerCloseTimeoutRef.current) {
        clearTimeout(reactionPickerCloseTimeoutRef.current);
      }
    },
    [],
  );

  const clearReactionPickerOpenTimeout = React.useCallback(() => {
    if (!reactionPickerOpenTimeoutRef.current) {
      return;
    }

    clearTimeout(reactionPickerOpenTimeoutRef.current);
    reactionPickerOpenTimeoutRef.current = null;
  }, []);

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
      clearReactionPickerOpenTimeout();
      clearReactionPickerCloseTimeout();

      if (isReactionPickerVisible) {
        return;
      }

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
    [
      clearReactionPickerOpenTimeout,
      clearReactionPickerCloseTimeout,
      emojiItemAnimations,
      isReactionPickerVisible,
      reactionPickerAnimation,
    ],
  );

  const scheduleReactionPickerOpen = React.useCallback(() => {
    clearReactionPickerOpenTimeout();
    clearReactionPickerCloseTimeout();
    reactionPickerOpenTimeoutRef.current = setTimeout(() => {
      openReactionPicker();
    }, REACTION_PICKER_HOVER_OPEN_DELAY_MS);
  }, [
    clearReactionPickerCloseTimeout,
    clearReactionPickerOpenTimeout,
    openReactionPicker,
  ]);

  const closeReactionPicker = React.useCallback(() => {
    clearReactionPickerOpenTimeout();
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
  }, [
    clearReactionPickerCloseTimeout,
    clearReactionPickerOpenTimeout,
    reactionPickerAnimation,
    emojiItemAnimations,
  ]);

  const scheduleReactionPickerClose = React.useCallback(() => {
    clearReactionPickerOpenTimeout();
    clearReactionPickerCloseTimeout();
    reactionPickerCloseTimeoutRef.current = setTimeout(() => {
      closeReactionPicker();
    }, REACTION_PICKER_HOVER_CLOSE_DELAY_MS);
  }, [
    clearReactionPickerCloseTimeout,
    clearReactionPickerOpenTimeout,
    closeReactionPicker,
  ]);
  React.useEffect(() => {
    if (Platform.OS !== "web" || !isReactionPickerVisible) {
      return;
    }

    const isPointWithinRect = (
      x: number,
      y: number,
      rect:
        | {
            left: number;
            right: number;
            top: number;
            bottom: number;
          }
        | undefined,
    ) =>
      Boolean(
        rect &&
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom,
      );

    const isPointerInsideReactionZone = (x: number, y: number) => {
      const triggerRect = reactionTriggerRef.current?.getBoundingClientRect?.();
      const pickerRect = reactionPickerRef.current?.getBoundingClientRect?.();

      return (
        isPointWithinRect(x, y, triggerRect) ||
        isPointWithinRect(x, y, pickerRect)
      );
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isPointerInsideReactionZone(event.clientX, event.clientY)) {
        clearReactionPickerCloseTimeout();
        return;
      }

      scheduleReactionPickerClose();
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (isPointerInsideReactionZone(event.clientX, event.clientY)) {
        clearReactionPickerCloseTimeout();
        return;
      }

      closeReactionPicker();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
    };
  }, [
    clearReactionPickerCloseTimeout,
    closeReactionPicker,
    isReactionPickerVisible,
    scheduleReactionPickerClose,
  ]);
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
  const isThreadCommentVariant = variant === "threadReply";
  const isThreadAnchorVariant = variant === "thread";
  const replyActionLabel = variant === "feed" ? "Comment" : "Reply";
  const isThreadVariant = isThreadAnchorVariant || isThreadCommentVariant;
  const avatarSize = isThreadCommentVariant ? 24 : isThreadAnchorVariant ? 42 : 44;
  const detailedPrimaryTimestamp = formatDetailedTimestamp(primaryTimestamp);
  const normalizedReaderPublicKey = currentUser?.PublicKeyBase58Check?.trim() ?? "";
  const authorPublicKey = post.poster?.publicKey?.trim() ?? "";
  const canShowThreadAnchorFollowButton =
    isThreadAnchorVariant &&
    Boolean(normalizedReaderPublicKey) &&
    Boolean(authorPublicKey) &&
    normalizedReaderPublicKey !== authorPublicKey;
  const primaryAuthorProfileTarget = React.useMemo<FeedProfileTarget>(
    () => ({
      publicKey: isPureRepost
        ? repostedPost?.poster?.publicKey?.trim() ?? null
        : post.poster?.publicKey?.trim() ?? null,
      username: usernameHandle,
    }),
    [
      isPureRepost,
      post.poster?.publicKey,
      repostedPost?.poster?.publicKey,
      usernameHandle,
    ],
  );
  const embeddedAuthorProfileTarget = React.useMemo<FeedProfileTarget>(
    () => ({
      publicKey: repostedPost?.poster?.publicKey?.trim() ?? null,
      username: embeddedUsernameHandle,
    }),
    [embeddedUsernameHandle, repostedPost?.poster?.publicKey],
  );
  const cachedIsFollowingAuthor = queryClient.getQueryData<boolean>(
    feedKeys.followStatus(normalizedReaderPublicKey, authorPublicKey),
  );
  const resolvedInitialIsFollowingAuthor =
    initialIsFollowingAuthor ??
    (typeof cachedIsFollowingAuthor === "boolean"
      ? cachedIsFollowingAuthor
      : null);

  const mutedIconColor = isDark ? "#94a3b8" : "#64748b";
  const mutedCountColor = isDark ? "#94a3b8" : "#64748b";
  const threadCommentActionIconSize = 16;
  const feedActionIconSize = 18;
  const feedSelectedReactionIconSize = 19;
  const feedActionLabelClassName = "text-[14px] font-medium leading-5";
  const threadCommentActionCountClassName =
    "text-[14px] font-medium leading-[18px]";
  const threadAnchorReplyIconSize = 20;
  const threadAnchorRepostIconSize = 20;
  const threadAnchorLikeIconSize = 20;
  const threadAnchorActionClassName =
    "flex-row items-center gap-2.5 rounded-full px-3 py-2";
  const threadAnchorActionCountClassName = "text-[15px] font-medium leading-5";
  const isFeedVariant = variant === "feed";
  const threadReplyHoverColor = isDark ? "#60a5fa" : "#2563eb";
  const threadReplyHoverBackground = isDark
    ? "rgba(96, 165, 250, 0.2)"
    : "rgba(37, 99, 235, 0.14)";
  const threadRepostHoverColor = isDark ? "#4ade80" : "#16a34a";
  const threadRepostHoverBackground = isDark
    ? "rgba(74, 222, 128, 0.2)"
    : "rgba(22, 163, 74, 0.14)";
  const threadLikeHoverColor = selectedReactionOption?.color
    ? selectedReactionOption.color
    : isDark
      ? "#fb7185"
      : "#e11d48";
  const threadLikeHoverBackground = isDark
    ? "rgba(251, 113, 133, 0.2)"
    : "rgba(225, 29, 72, 0.14)";
  const replyHoverActive =
    (isThreadAnchorVariant && isThreadAnchorReplyHovered) ||
    (isFeedVariant && isFeedReplyHovered);
  const repostHoverActive =
    (isThreadAnchorVariant && isThreadAnchorRepostHovered) ||
    (isFeedVariant && isFeedRepostHovered);
  const likeHoverActive =
    (isThreadAnchorVariant && isThreadAnchorLikeHovered) ||
    (isFeedVariant && isFeedLikeHovered);
  const likeActionColor = selectedReactionOption?.color
    ? selectedReactionOption.color
    : likeHoverActive
      ? threadLikeHoverColor
      : mutedIconColor;
  const displayedLikeLabel = isFeedVariant ? "Like" : likeActionLabel;
  const shouldShowFeedBodyToggle = Boolean(
    isFeedVariant &&
      primaryBody &&
      primaryBody.length > FEED_BODY_TOGGLE_MIN_CHARACTERS,
  );
  const shouldShowFeedEmbeddedBodyToggle = Boolean(
    isFeedVariant &&
      repostBody &&
      repostBody.length > FEED_EMBEDDED_BODY_TOGGLE_MIN_CHARACTERS,
  );
  const reactionPickerPositionClassName = isFeedVariant
    ? "absolute bottom-full right-0"
    : "absolute bottom-full left-0";
  const reactionPickerHitAreaClassName = `${reactionPickerPositionClassName} -mb-1 pb-3`;

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
  const threadAnchorStats = React.useMemo(
    () =>
      [
        {
          label: replyCount === 1 ? "reply" : "replies",
          value: formatCount(replyCount),
        },
        {
          label: repostCount === 1 ? "repost" : "reposts",
          value: formatCount(repostCount),
        },
        {
          label: displayedTotalReactionCount === 1 ? "like" : "likes",
          value: formatCount(displayedTotalReactionCount),
        },
      ] as const,
    [displayedTotalReactionCount, replyCount, repostCount],
  );

  const hasInteractionSummary =
    displayedTotalReactionCount > 0 || interactionSummaryItems.length > 0;
  const shouldShowInteractionSummary =
    !isThreadCommentVariant && !isThreadAnchorVariant && hasInteractionSummary;
  const shouldShowThreadAnchorStats = isThreadAnchorVariant;
  const {
    isFollowing: isFollowingAuthor,
    isLoading: isFollowingAuthorLoading,
  } = useIsFollowingAccount({
    readerPublicKey: normalizedReaderPublicKey,
    targetPublicKey: authorPublicKey,
    enabled: canShowThreadAnchorFollowButton,
  });
  const effectiveIsFollowingAuthor =
    optimisticIsFollowing ??
    resolvedInitialIsFollowingAuthor ??
    isFollowingAuthor;
  const hasResolvedThreadAnchorFollowState =
    !canShowThreadAnchorFollowButton ||
    typeof optimisticIsFollowing === "boolean" ||
    typeof resolvedInitialIsFollowingAuthor === "boolean" ||
    !isFollowingAuthorLoading;
  const shouldRenderThreadAnchorFollowButton =
    canShowThreadAnchorFollowButton &&
    hasResolvedThreadAnchorFollowState &&
    (!effectiveIsFollowingAuthor || isUpdatingFollow);

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
      pendingReactionSyncValueRef.current = nextReactionValue;
      setCurrentReactionValue(nextReactionValue);
      applyOptimisticReactionUpdate(
        queryClient,
        post.postHash,
        nextReactionValue,
      );

      try {
        const result = await setPostReactionAssociationAsync({
          readerPublicKey,
          postHash: post.postHash,
          reactionValue: nextReactionValue,
          existingAssociations: knownReactionAssociations,
        });

        const resolvedReactionValue =
          nextReactionValue != null && result.currentReaction == null
            ? nextReactionValue
            : result.currentReaction;
        const resolvedAssociations =
          resolvedReactionValue != null && result.associations.length === 0
            ? [
                {
                  associationId: `optimistic:${post.postHash}:${resolvedReactionValue}`,
                  associationValue: resolvedReactionValue,
                },
              ]
            : result.associations;

        pendingReactionSyncValueRef.current = resolvedReactionValue;
        setCurrentReactionValue(resolvedReactionValue);
        setKnownReactionAssociations(resolvedAssociations);
        void queryClient.invalidateQueries({
          queryKey: feedKeys.postReactions(post.postHash),
        });
      } catch (error) {
        pendingReactionSyncValueRef.current = undefined;
        setCurrentReactionValue(previousReactionValue);
        setKnownReactionAssociations(previousAssociations);
        applyOptimisticReactionUpdate(
          queryClient,
          post.postHash,
          previousReactionValue,
        );
        console.warn("Reaction update failed in background", error);
        void queryClient.invalidateQueries({
          queryKey: feedKeys.base,
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
      clearReactionPickerOpenTimeout();
      const nextReactionValue = currentReactionValue ? null : "LIKE";
      void applyReaction(nextReactionValue, event);
    },
    [applyReaction, clearReactionPickerOpenTimeout, currentReactionValue],
  );

  const handleThreadAnchorFollowPress = React.useCallback(
    async (event?: { stopPropagation?: () => void }) => {
      event?.stopPropagation?.();

      if (
        !shouldRenderThreadAnchorFollowButton ||
        !normalizedReaderPublicKey ||
        !authorPublicKey ||
        isUpdatingFollow
      ) {
        return;
      }

      setOptimisticIsFollowing(true);

      try {
        await toggleFollowingAsync({
          readerPublicKey: normalizedReaderPublicKey,
          targetPublicKey: authorPublicKey,
          shouldFollow: true,
        });

        queryClient.setQueryData(
          feedKeys.followStatus(normalizedReaderPublicKey, authorPublicKey),
          true,
        );
      } catch (error) {
        setOptimisticIsFollowing(false);
        Toast.show({
          type: "error",
          text1: "Unable to follow",
          text2:
            error instanceof Error && error.message
              ? error.message
              : "Please try again.",
        });
      } finally {
        setOptimisticIsFollowing(null);
      }
    },
    [
      authorPublicKey,
      isUpdatingFollow,
      normalizedReaderPublicKey,
      queryClient,
      shouldRenderThreadAnchorFollowButton,
      toggleFollowingAsync,
    ],
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

  const getThreadAnchorActionStyle = React.useCallback(
    (hoverBackgroundColor: string, isHovered: boolean) =>
      ({ pressed }: { pressed: boolean }) => ({
        opacity: pressed ? 0.9 : 1,
        backgroundColor: isHovered ? hoverBackgroundColor : "transparent",
        borderRadius: 999,
        ...(Platform.OS === "web"
          ? ({
              cursor: "pointer",
            } as const)
          : null),
      }),
    [],
  );

  const reactionPickerTranslateY = reactionPickerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });
  const handleRepostPress = React.useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation?.();
      onRepostPress?.(post, {
        x: event.nativeEvent.pageX ?? 0,
        y: event.nativeEvent.pageY ?? 0,
      });
    },
    [onRepostPress, post],
  );
  const handleProfilePress = React.useCallback(
    (
      profile: FeedProfileTarget,
      event?: { stopPropagation?: () => void },
    ) => {
      event?.stopPropagation?.();

      const publicKey = profile.publicKey?.trim() ?? "";
      const username = profile.username?.trim() ?? "";
      if (!publicKey && !username) {
        return;
      }

      onProfilePress?.({
        publicKey: publicKey || undefined,
        username: username || undefined,
      });
    },
    [onProfilePress],
  );
  const handleCardPress = React.useCallback(() => {
    if (Platform.OS !== "web" && isReactionPickerVisible) {
      closeReactionPicker();
      return;
    }

    onPress?.(post);
  }, [closeReactionPicker, isReactionPickerVisible, onPress, post]);

  if (isThreadCommentVariant) {
    const threadTextOffset = avatarSize + 8;
    const threadRailOffset = Math.floor(avatarSize / 2);
    const threadConnectorColor = threadLineColor ?? getBorderColor(isDark, "subtle");

    return (
      <Pressable
        onPress={handleCardPress}
        className="py-1.5"
        style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
      >
        {Platform.OS !== "web" && isReactionPickerVisible ? (
          <Pressable
            className="absolute inset-0"
            onPress={(event) => {
              event.stopPropagation?.();
              closeReactionPicker();
            }}
            style={{ zIndex: 20 }}
            accessibilityRole="button"
            accessibilityLabel="Close reaction picker"
          />
        ) : null}

        {isPureRepost ? (
          <View
            className="mb-1 flex-row items-center gap-1"
            style={{ paddingLeft: threadTextOffset }}
          >
            <RepostIcon size={12} color={isDark ? "#94a3b8" : "#64748b"} />
            <Text className="text-[11px] text-slate-500 dark:text-slate-400">
              Reposted by {reposterLabel}
            </Text>
          </View>
        ) : null}

        <Pressable
          className="flex-row items-start"
          onPress={(event) => handleProfilePress(primaryAuthorProfileTarget, event)}
          style={actionButtonStyle}
          accessibilityRole="button"
          accessibilityLabel={`Open ${displayName} profile`}
        >
          <UserAvatar uri={avatarUri} name={displayName} size={avatarSize} />

          <View className="ml-2 flex-1">
            <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Text
                numberOfLines={1}
                className="max-w-[54%] text-[14px] font-semibold text-slate-900 dark:text-white"
              >
                {displayName}
              </Text>
              <Text className="text-[13px] text-slate-500 dark:text-slate-400">
                @{usernameHandle}
              </Text>
              {formattedPrimaryTimestamp && !isThreadAnchorVariant ? (
                <Text className="text-[13px] text-slate-500 dark:text-slate-400">
                  {" - "}
                  {formattedPrimaryTimestamp}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>

        <View className="mt-0.5 flex-row">
          <View style={{ width: threadTextOffset }}>
            {threadChildLineVisible ? (
              <View
                style={{
                  marginLeft: threadRailOffset,
                  width: 1,
                  flex: 1,
                  backgroundColor: threadConnectorColor,
                }}
              />
            ) : null}
          </View>

          <View className="flex-1">
            {primaryBody ? (
              <Text className="text-[15px] leading-[22px] text-slate-900 dark:text-slate-100">
                {primaryBody}
              </Text>
            ) : null}

            {renderMedia({
              imageUrls: primaryImageUrls,
              videoUrl: primaryVideoUrl,
              isDark,
              isVisible: isVisible || Platform.OS !== "web",
              compact: true,
            })}

            {hasEmbeddedRepostCard ? (
              <View className="mt-2.5 rounded-2xl border border-slate-200/80 p-3 dark:border-slate-700/80">
                <Pressable
                  className="flex-row items-start"
                  onPress={(event) => handleProfilePress(embeddedAuthorProfileTarget, event)}
                  style={actionButtonStyle}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${embeddedDisplayName} profile`}
                >
                  <UserAvatar
                    uri={embeddedAvatarUri}
                    name={embeddedDisplayName}
                    size={30}
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
                </Pressable>

                {repostBody ? (
                  <Text className="mt-2 text-[14px] leading-5 text-slate-900 dark:text-slate-100">
                    {repostBody}
                  </Text>
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

            <View className="mt-2 flex-row items-center gap-8">
              <Pressable
                className="flex-row items-center gap-1.5 py-0.5"
                onPress={(event) => {
                  event.stopPropagation?.();
                  onReplyPress?.(post);
                }}
                accessibilityRole="button"
                accessibilityLabel="Reply to this post"
                style={actionButtonStyle}
              >
                <CommentIcon
                  size={threadCommentActionIconSize}
                  color={mutedIconColor}
                />
                {replyCount > 0 ? (
                  <Text
                    className={threadCommentActionCountClassName}
                    style={{ color: mutedCountColor }}
                  >
                    {formatCount(replyCount)}
                  </Text>
                ) : null}
              </Pressable>

              <Pressable
                className="flex-row items-center gap-1.5 py-0.5"
                onPress={handleRepostPress}
                accessibilityRole="button"
                accessibilityLabel="Repost this post"
                style={actionButtonStyle}
              >
                <RepostIcon
                  size={threadCommentActionIconSize}
                  color={mutedIconColor}
                />
                {repostCount > 0 ? (
                  <Text
                    className={threadCommentActionCountClassName}
                    style={{ color: mutedCountColor }}
                  >
                    {formatCount(repostCount)}
                  </Text>
                ) : null}
              </Pressable>

              <View
                className="relative"
                style={
                  Platform.OS !== "web" && isReactionPickerVisible
                    ? { zIndex: 30 }
                    : undefined
                }
              >
                {isReactionPickerVisible ? (
                  <Pressable
                    ref={reactionPickerRef}
                    className={reactionPickerHitAreaClassName}
                    onPress={(event) => event.stopPropagation?.()}
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
                        const itemTranslateY =
                          emojiItemAnimations[index].interpolate({
                            inputRange: [0, 1],
                            outputRange: [16, 0],
                          });

                        return (
                          <Animated.View
                            key={reactionOption.value}
                            style={{
                              opacity: emojiItemAnimations[index],
                              transform: [
                                {
                                  scale: Animated.multiply(
                                    itemScale,
                                    emojiHoverAnimations[index],
                                  ),
                                },
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
                              <ReactionIcon
                                name={reactionOption.iconName}
                                size={26}
                              />
                            </Pressable>
                          </Animated.View>
                        );
                      })}
                    </Animated.View>
                  </Pressable>
                ) : null}

                <Pressable
                  ref={reactionTriggerRef}
                  className="flex-row items-center gap-1.5 py-0.5"
                  onPress={handlePrimaryLikePress}
                  onLongPress={openReactionPicker}
                  delayLongPress={170}
                  onHoverIn={
                    Platform.OS === "web"
                      ? scheduleReactionPickerOpen
                      : undefined
                  }
                  onHoverOut={
                    Platform.OS === "web"
                      ? clearReactionPickerOpenTimeout
                      : undefined
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
                    <View
                      style={{
                        width: threadCommentActionIconSize,
                        height: threadCommentActionIconSize,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ReactionIcon
                        name={selectedReactionOption.iconName}
                        size={threadCommentActionIconSize}
                      />
                    </View>
                  ) : (
                    <HeartIcon
                      size={threadCommentActionIconSize}
                      color={mutedIconColor}
                      filled={false}
                    />
                  )}

                  {displayedTotalReactionCount > 0 ? (
                    <Text
                      className={threadCommentActionCountClassName}
                      style={{ color: selectedReactionOption?.color ?? mutedCountColor }}
                    >
                      {formatCount(displayedTotalReactionCount)}
                    </Text>
                  ) : null}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handleCardPress}
      className={
        isThreadCommentVariant
          ? "py-1.5"
          : isThreadAnchorVariant
          ? "px-4 pt-3"
          : isThreadVariant
          ? "border-b border-slate-200/80 px-4 py-3 dark:border-slate-800/80"
          : "border-b border-slate-200 px-4 py-3 dark:border-slate-800"
      }
      style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
    >
      {Platform.OS !== "web" && isReactionPickerVisible ? (
        <Pressable
          className="absolute inset-0"
          onPress={(event) => {
            event.stopPropagation?.();
            closeReactionPicker();
          }}
          style={{ zIndex: 20 }}
          accessibilityRole="button"
          accessibilityLabel="Close reaction picker"
        />
      ) : null}

      {isPureRepost ? (
        <View className="mb-1.5 flex-row items-center gap-1">
          <RepostIcon
            size={isThreadVariant ? 12 : 13}
            color={isDark ? "#94a3b8" : "#64748b"}
          />
          <Text
            className={
              isThreadVariant
                ? "text-[11px] text-slate-500 dark:text-slate-400"
                : "text-[12px] text-slate-500 dark:text-slate-400"
            }
          >
            Reposted by {reposterLabel}
          </Text>
        </View>
      ) : null}

      {isThreadAnchorVariant ? (
        <View>
          <View className="flex-row items-start gap-3">
            <Pressable
              className="min-w-0 flex-1 flex-row items-start gap-3"
              onPress={(event) => handleProfilePress(primaryAuthorProfileTarget, event)}
              style={actionButtonStyle}
              accessibilityRole="button"
              accessibilityLabel={`Open ${displayName} profile`}
            >
              <UserAvatar uri={avatarUri} name={displayName} size={avatarSize} />

              <View className="min-w-0 flex-1">
                <Text
                  numberOfLines={1}
                  className="text-[16px] font-semibold leading-5 text-slate-900 dark:text-white"
                >
                  {displayName}
                </Text>
                <Text
                  numberOfLines={1}
                  className="mt-0.5 text-[15px] leading-5 text-slate-500 dark:text-slate-400"
                >
                  @{usernameHandle}
                </Text>
              </View>
            </Pressable>

            {shouldRenderThreadAnchorFollowButton ? (
              <Pressable
                onPress={(event) => void handleThreadAnchorFollowPress(event)}
                onHoverIn={
                  Platform.OS === "web"
                    ? () => setIsThreadAnchorFollowHovered(true)
                    : undefined
                }
                onHoverOut={
                  Platform.OS === "web"
                    ? () => setIsThreadAnchorFollowHovered(false)
                    : undefined
                }
                disabled={isUpdatingFollow}
                className="ml-3 h-7 min-w-[76px] shrink-0 items-center justify-center rounded-full px-3"
                style={{
                  backgroundColor: effectiveIsFollowingAuthor
                    ? isDark
                      ? "rgba(30, 41, 59, 0.9)"
                      : "rgba(226, 232, 240, 0.95)"
                    : isThreadAnchorFollowHovered
                      ? accentStrong
                      : accentColor,
                  borderWidth: effectiveIsFollowingAuthor ? 1 : 0,
                  borderColor: effectiveIsFollowingAuthor
                    ? getBorderColor(isDark, "input")
                    : "transparent",
                  opacity: isUpdatingFollow ? 0.75 : 1,
                  ...(Platform.OS === "web"
                    ? ({
                        cursor: "pointer",
                      } as const)
                    : null),
                }}
                accessibilityRole="button"
                accessibilityLabel={`Follow ${displayName}`}
              >
                {isUpdatingFollow ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text
                    className="text-[12px] font-semibold"
                    style={{
                      color: effectiveIsFollowingAuthor
                        ? isDark
                          ? "#e2e8f0"
                          : "#334155"
                        : "#ffffff",
                    }}
                  >
                    {effectiveIsFollowingAuthor ? "Following" : "Follow"}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>

          {primaryBody ? (
            <Text className="mt-3.5 text-[16px] leading-[24px] text-slate-900 dark:text-slate-100">
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
            <View className="mt-3 rounded-2xl border border-slate-200/90 p-3 dark:border-slate-700/90">
              <Pressable
                className="flex-row items-start"
                onPress={(event) => handleProfilePress(embeddedAuthorProfileTarget, event)}
                style={actionButtonStyle}
                accessibilityRole="button"
                accessibilityLabel={`Open ${embeddedDisplayName} profile`}
              >
                <UserAvatar
                  uri={embeddedAvatarUri}
                  name={embeddedDisplayName}
                  size={30}
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
              </Pressable>

              {repostBody ? (
                isFeedVariant ? (
                  <View className="mt-2">
                    <Text
                      numberOfLines={
                        shouldShowFeedEmbeddedBodyToggle && !isFeedEmbeddedBodyExpanded
                          ? FEED_COLLAPSED_EMBEDDED_BODY_MAX_LINES
                          : undefined
                      }
                      className="text-[14px] leading-5 text-slate-900 dark:text-slate-100"
                    >
                      {repostBody}
                    </Text>
                    {shouldShowFeedEmbeddedBodyToggle ? (
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation?.();
                          setIsFeedEmbeddedBodyExpanded((current) => !current);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isFeedEmbeddedBodyExpanded
                            ? "Show less repost text"
                            : "Show more repost text"
                        }
                        style={actionButtonStyle}
                      >
                        <Text className="mt-1 text-[13px] font-semibold text-sky-500 dark:text-sky-400">
                          {isFeedEmbeddedBodyExpanded ? "See less" : "See more"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <Text className="mt-2 text-[14px] leading-5 text-slate-900 dark:text-slate-100">
                    {repostBody}
                  </Text>
                )
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

          {detailedPrimaryTimestamp ? (
            <View className="mt-4 flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <Text className="text-[13px] text-slate-500 dark:text-slate-400">
                {detailedPrimaryTimestamp}
              </Text>
              <Text className="text-[13px] text-slate-500 dark:text-slate-400">
                Everyone can reply
              </Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View className="flex-row items-start">
          <Pressable
            onPress={(event) => handleProfilePress(primaryAuthorProfileTarget, event)}
            style={actionButtonStyle}
            accessibilityRole="button"
            accessibilityLabel={`Open ${displayName} profile`}
          >
            <UserAvatar uri={avatarUri} name={displayName} size={avatarSize} />
          </Pressable>

        <View className={isThreadVariant ? "ml-2.5 flex-1" : "ml-3 flex-1"}>
          {isThreadVariant ? (
            <Pressable
              className="flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5 self-start"
              onPress={(event) => handleProfilePress(primaryAuthorProfileTarget, event)}
              style={actionButtonStyle}
              accessibilityRole="button"
              accessibilityLabel={`Open ${displayName} profile`}
            >
              <Text
                numberOfLines={1}
                className={
                  isThreadCommentVariant
                    ? "max-w-[52%] text-[14px] font-semibold text-slate-900 dark:text-white"
                    : "max-w-[50%] text-[15px] font-semibold text-slate-900 dark:text-white"
                }
              >
                {displayName}
              </Text>
              <Text
                className={
                  isThreadCommentVariant
                    ? "text-[14px] text-slate-500 dark:text-slate-400"
                    : "text-[13px] text-slate-500 dark:text-slate-400"
                }
              >
                @{usernameHandle}
              </Text>
              {formattedPrimaryTimestamp ? (
                <Text
                  className={
                    isThreadCommentVariant
                      ? "text-[14px] text-slate-500 dark:text-slate-400"
                      : "text-[13px] text-slate-500 dark:text-slate-400"
                  }
                >
                  {isThreadCommentVariant
                    ? `· ${formattedPrimaryTimestamp}`
                    : formattedPrimaryTimestamp}
                </Text>
              ) : null}
            </Pressable>
          ) : isPureRepost ? (
            <Pressable
              className="flex-row items-center gap-1.5 self-start"
              onPress={(event) => handleProfilePress(primaryAuthorProfileTarget, event)}
              style={actionButtonStyle}
              accessibilityRole="button"
              accessibilityLabel={`Open ${displayName} profile`}
            >
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
            </Pressable>
          ) : (
            <View className="flex-row items-start justify-between">
              <Pressable
                className="flex-1 self-start pr-3"
                onPress={(event) => handleProfilePress(primaryAuthorProfileTarget, event)}
                style={actionButtonStyle}
                accessibilityRole="button"
                accessibilityLabel={`Open ${displayName} profile`}
              >
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
              </Pressable>

              <Text className="text-[12px] text-slate-500 dark:text-slate-400">
                {formattedPrimaryTimestamp}
              </Text>
            </View>
          )}

          {primaryBody ? (
            isFeedVariant ? (
              <View className="mt-1">
                <Text
                  numberOfLines={
                    shouldShowFeedBodyToggle && !isFeedBodyExpanded
                      ? FEED_COLLAPSED_BODY_MAX_LINES
                      : undefined
                  }
                  className="text-[15px] leading-6 text-slate-900 dark:text-slate-100"
                >
                  {primaryBody}
                </Text>
                {shouldShowFeedBodyToggle ? (
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation?.();
                      setIsFeedBodyExpanded((current) => !current);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isFeedBodyExpanded ? "Show less post text" : "Show more post text"
                    }
                    style={actionButtonStyle}
                  >
                    <Text className="mt-1 text-[13px] font-semibold text-sky-500 dark:text-sky-400">
                      {isFeedBodyExpanded ? "See less" : "See more"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text
                className={
                  isThreadCommentVariant
                    ? "mt-0.5 text-[15px] leading-6 text-slate-900 dark:text-slate-100"
                    : isThreadVariant
                    ? "mt-1.5 text-[15px] leading-7 text-slate-900 dark:text-slate-100"
                    : "mt-1 text-[15px] leading-6 text-slate-900 dark:text-slate-100"
                }
              >
                {primaryBody}
              </Text>
            )
          ) : null}

          {renderMedia({
            imageUrls: primaryImageUrls,
            videoUrl: primaryVideoUrl,
            isDark,
            isVisible: isVisible || Platform.OS !== "web",
            compact: isThreadCommentVariant,
          })}

          {hasEmbeddedRepostCard ? (
            <View
              className={
                isThreadCommentVariant
                  ? "mt-2.5 rounded-2xl border border-slate-200/80 p-3 dark:border-slate-700/80"
                  : isThreadVariant
                  ? "mt-3 rounded-2xl border border-slate-200/90 p-3 dark:border-slate-700/90"
                  : "mt-3 rounded-2xl border border-slate-200 p-3 dark:border-slate-700"
              }
            >
              <Pressable
                className="flex-row items-start"
                onPress={(event) => handleProfilePress(embeddedAuthorProfileTarget, event)}
                style={actionButtonStyle}
                accessibilityRole="button"
                accessibilityLabel={`Open ${embeddedDisplayName} profile`}
              >
                <UserAvatar
                  uri={embeddedAvatarUri}
                  name={embeddedDisplayName}
                  size={isThreadVariant ? 30 : 32}
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
              </Pressable>

              {repostBody ? (
                isFeedVariant ? (
                  <View className="mt-2">
                    <Text
                      numberOfLines={
                        shouldShowFeedEmbeddedBodyToggle && !isFeedEmbeddedBodyExpanded
                          ? FEED_COLLAPSED_EMBEDDED_BODY_MAX_LINES
                          : undefined
                      }
                      className="text-[14px] leading-5 text-slate-900 dark:text-slate-100"
                    >
                      {repostBody}
                    </Text>
                    {shouldShowFeedEmbeddedBodyToggle ? (
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation?.();
                          setIsFeedEmbeddedBodyExpanded((current) => !current);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isFeedEmbeddedBodyExpanded
                            ? "Show less repost text"
                            : "Show more repost text"
                        }
                        style={actionButtonStyle}
                      >
                        <Text className="mt-1 text-[13px] font-semibold text-sky-500 dark:text-sky-400">
                          {isFeedEmbeddedBodyExpanded ? "See less" : "See more"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <Text className="mt-2 text-[14px] leading-5 text-slate-900 dark:text-slate-100">
                    {repostBody}
                  </Text>
                )
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

          {isThreadAnchorVariant && detailedPrimaryTimestamp ? (
            <View className="mt-3 flex-row flex-wrap items-center gap-x-2 gap-y-1">
              <Text className="text-[13px] text-slate-500 dark:text-slate-400">
                {detailedPrimaryTimestamp}
              </Text>
              <Text className="text-[13px] text-slate-500 dark:text-slate-400">
                Everyone can reply
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      )}

      {shouldShowThreadAnchorStats ? (
        <View className="mt-3 flex-row flex-wrap items-center gap-x-5 gap-y-2">
          {threadAnchorStats.map((item) => (
            <View key={item.label} className="flex-row items-baseline gap-1.5">
              <Text className="text-[16px] font-semibold text-slate-900 dark:text-white">
                {item.value}
              </Text>
              <Text className="text-[14px] text-slate-500 dark:text-slate-400">
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {shouldShowInteractionSummary ? (
        <View
          className={
            isThreadVariant
              ? "mt-3 flex-row items-center justify-between gap-3"
              : "mt-3 flex-row items-center justify-between"
          }
        >
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
                    <ReactionIcon name={reaction.iconName} size={12} />
                  </View>
                ))}

                <Text
                  className={
                    isThreadVariant
                      ? "ml-1.5 text-[11px] text-slate-500 dark:text-slate-400"
                      : "ml-1.5 text-[12px] text-slate-500 dark:text-slate-400"
                  }
                >
                  {formatCount(displayedTotalReactionCount)}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View className="flex-row items-center" />
          )}

          <View
            className={
              isThreadVariant
                ? "flex-row items-center gap-2.5"
                : "flex-row items-center gap-3"
            }
          >
            {interactionSummaryItems.map((item) => (
              <Text
                key={item}
                className={
                  isThreadVariant
                    ? "text-[11px] text-slate-500 dark:text-slate-400"
                    : "text-[12px] text-slate-500 dark:text-slate-400"
                }
              >
                {item}
              </Text>
            ))}
          </View>
        </View>
      ) : null}

      <View
        className={
          isThreadCommentVariant
            ? "mt-1.5 flex-row items-center gap-6"
            : isThreadAnchorVariant
              ? "-mx-4 mt-3 flex-row items-center justify-start gap-3 border-b border-slate-200/80 px-4 py-2 dark:border-slate-800/80"
            : isThreadVariant
              ? shouldShowInteractionSummary
                ? "mt-2.5 flex-row items-center gap-5"
                : "mt-3 flex-row items-center gap-5"
              : hasInteractionSummary
                ? "mt-1 flex-row items-center"
                : "mt-3 flex-row items-center"
        }
      >
        <Pressable
          className={
            isThreadAnchorVariant
              ? threadAnchorActionClassName
              : isThreadCommentVariant
                ? "flex-row items-center gap-1.5 py-0.5"
                : isThreadVariant
                  ? "flex-row items-center gap-1.5 rounded-full py-1"
                  : "flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-1.5"
          }
          onPress={(event) => {
            event.stopPropagation?.();
            onReplyPress?.(post);
          }}
          onHoverIn={
            Platform.OS === "web"
              ? () => {
                  if (isThreadAnchorVariant) {
                    setIsThreadAnchorReplyHovered(true);
                  }
                  if (isFeedVariant) {
                    setIsFeedReplyHovered(true);
                  }
                }
              : undefined
          }
          onHoverOut={
            Platform.OS === "web"
              ? () => {
                  if (isThreadAnchorVariant) {
                    setIsThreadAnchorReplyHovered(false);
                  }
                  if (isFeedVariant) {
                    setIsFeedReplyHovered(false);
                  }
                }
              : undefined
          }
          accessibilityRole="button"
          accessibilityLabel="Comment on this post"
          style={
            isThreadAnchorVariant || replyHoverActive
              ? getThreadAnchorActionStyle(
                  threadReplyHoverBackground,
                  replyHoverActive,
                )
              : actionButtonStyle
          }
        >
          <CommentIcon
            size={
              isThreadAnchorVariant
                ? threadAnchorReplyIconSize
                : isThreadCommentVariant
                  ? 17
                  : isThreadVariant
                    ? 18
                    : feedActionIconSize
            }
            color={
              replyHoverActive
                ? threadReplyHoverColor
                : mutedCountColor
            }
          />
          {isThreadVariant ? (
            replyCount > 0 || isThreadAnchorVariant ? (
              <Text
                className={
                  isThreadAnchorVariant
                    ? threadAnchorActionCountClassName
                    : "text-[12px] font-medium"
                }
                style={{
                  color:
                    replyHoverActive
                      ? threadReplyHoverColor
                      : mutedCountColor,
                }}
              >
                {formatCount(replyCount)}
              </Text>
            ) : null
          ) : (
            <Text
              className={feedActionLabelClassName}
              style={{
                color:
                  replyHoverActive
                    ? threadReplyHoverColor
                    : mutedCountColor,
              }}
            >
              {replyActionLabel}
            </Text>
          )}
        </Pressable>

        <Pressable
          className={
            isThreadAnchorVariant
              ? threadAnchorActionClassName
              : isThreadCommentVariant
                ? "flex-row items-center gap-1.5 py-0.5"
                : isThreadVariant
                  ? "flex-row items-center gap-1.5 rounded-full py-1"
                  : "flex-1 flex-row items-center justify-center gap-1.5 rounded-full py-1.5"
          }
          onPress={handleRepostPress}
          onHoverIn={
            Platform.OS === "web"
              ? () => {
                  if (isThreadAnchorVariant) {
                    setIsThreadAnchorRepostHovered(true);
                  }
                  if (isFeedVariant) {
                    setIsFeedRepostHovered(true);
                  }
                }
              : undefined
          }
          onHoverOut={
            Platform.OS === "web"
              ? () => {
                  if (isThreadAnchorVariant) {
                    setIsThreadAnchorRepostHovered(false);
                  }
                  if (isFeedVariant) {
                    setIsFeedRepostHovered(false);
                  }
                }
              : undefined
          }
          accessibilityRole="button"
          accessibilityLabel="Repost this post"
          style={
            isThreadAnchorVariant || repostHoverActive
              ? getThreadAnchorActionStyle(
                  threadRepostHoverBackground,
                  repostHoverActive,
                )
              : actionButtonStyle
          }
        >
          <RepostIcon
            size={
              isThreadAnchorVariant
                ? threadAnchorRepostIconSize
                : isThreadCommentVariant
                  ? 17
                  : isThreadVariant
                    ? 18
                    : feedActionIconSize
            }
            color={
              repostHoverActive
                ? threadRepostHoverColor
                : mutedCountColor
            }
          />
          {isThreadVariant ? (
            repostCount > 0 || isThreadAnchorVariant ? (
              <Text
                className={
                  isThreadAnchorVariant
                    ? threadAnchorActionCountClassName
                    : "text-[12px] font-medium"
                }
                style={{
                  color:
                    repostHoverActive
                      ? threadRepostHoverColor
                      : mutedCountColor,
                }}
              >
                {formatCount(repostCount)}
              </Text>
            ) : null
          ) : (
            <Text
              className={feedActionLabelClassName}
              style={{
                color:
                  repostHoverActive
                    ? threadRepostHoverColor
                    : mutedCountColor,
              }}
            >
              Repost
            </Text>
          )}
        </Pressable>

        <View
          className={
            isThreadAnchorVariant
              ? "relative"
              : isThreadVariant
                ? "relative"
                : "relative flex-1"
          }
          style={
            Platform.OS !== "web" && isReactionPickerVisible
              ? { zIndex: 30 }
              : undefined
          }
        >
          {isReactionPickerVisible ? (
            <Pressable
              ref={reactionPickerRef}
              className={reactionPickerHitAreaClassName}
              onPress={(event) => event.stopPropagation?.()}
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
                        <ReactionIcon
                          name={reactionOption.iconName}
                          size={26}
                        />
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </Animated.View>
            </Pressable>
          ) : null}

          <Pressable
            ref={reactionTriggerRef}
            className={
              isThreadAnchorVariant
                ? threadAnchorActionClassName
                : isThreadCommentVariant
                  ? "flex-row items-center gap-1.5 py-0.5"
                  : isThreadVariant
                    ? "flex-row items-center gap-1.5 rounded-full py-1"
                    : "flex-row items-center justify-center gap-1.5 rounded-full py-1.5"
            }
            onPress={handlePrimaryLikePress}
            onLongPress={openReactionPicker}
            delayLongPress={170}
            onHoverIn={
              Platform.OS === "web"
                ? () => {
                  if (isThreadAnchorVariant) {
                    setIsThreadAnchorLikeHovered(true);
                  }
                  if (isFeedVariant) {
                    setIsFeedLikeHovered(true);
                  }
                  scheduleReactionPickerOpen();
                }
                : undefined
            }
            onHoverOut={
              Platform.OS === "web"
                ? () => {
                  if (isThreadAnchorVariant) {
                    setIsThreadAnchorLikeHovered(false);
                  }
                  if (isFeedVariant) {
                    setIsFeedLikeHovered(false);
                  }
                  clearReactionPickerOpenTimeout();
                }
                : undefined
            }
            accessibilityRole="button"
            accessibilityLabel={
              currentReactionValue
                ? `Remove ${likeActionLabel} reaction`
                : "Like this post"
            }
            style={
              isThreadAnchorVariant || likeHoverActive
                ? getThreadAnchorActionStyle(
                    threadLikeHoverBackground,
                    likeHoverActive,
                  )
                : actionButtonStyle
            }
          >
            {selectedReactionOption ? (
              <View
                style={{
                  width: isThreadAnchorVariant
                    ? threadAnchorLikeIconSize
                    : isThreadCommentVariant
                      ? threadCommentActionIconSize
                      : isThreadVariant
                        ? 17
                        : feedActionIconSize,
                  height: isThreadAnchorVariant
                    ? threadAnchorLikeIconSize
                    : isThreadCommentVariant
                      ? threadCommentActionIconSize
                      : isThreadVariant
                        ? 17
                        : feedActionIconSize,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ReactionIcon
                  name={selectedReactionOption.iconName}
                  size={
                    isThreadAnchorVariant
                      ? threadAnchorLikeIconSize - 1
                      : isThreadCommentVariant
                        ? threadCommentActionIconSize
                        : isThreadVariant
                          ? 16
                          : feedSelectedReactionIconSize
                  }
                />
              </View>
            ) : (
              <HeartIcon
                size={
                  isThreadAnchorVariant
                    ? threadAnchorLikeIconSize
                    : isThreadCommentVariant
                      ? threadCommentActionIconSize
                      : isThreadVariant
                        ? 17
                        : feedActionIconSize
                }
                color={
                  likeHoverActive ? threadLikeHoverColor : likeActionColor
                }
                filled={false}
              />
            )}

            {isThreadVariant ? (
              displayedTotalReactionCount > 0 || isThreadAnchorVariant ? (
                <Text
                  className={
                    isThreadAnchorVariant
                      ? threadAnchorActionCountClassName
                      : "text-[12px] font-medium"
                  }
                  style={{
                    color:
                      likeHoverActive && !selectedReactionOption
                        ? threadLikeHoverColor
                        : likeActionColor,
                  }}
                >
                  {formatCount(displayedTotalReactionCount)}
                </Text>
              ) : null
            ) : (
              <Text
                className={
                  isThreadVariant
                    ? "text-[12px] font-medium"
                    : feedActionLabelClassName
                }
                style={{
                  color:
                    likeHoverActive && !selectedReactionOption
                      ? threadLikeHoverColor
                      : likeActionColor,
                }}
              >
                {displayedLikeLabel}
              </Text>
            )}
          </Pressable>
        </View>
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
