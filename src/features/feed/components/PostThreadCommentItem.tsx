import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { type NativeStackNavigationProp } from "@react-navigation/native-stack";

import {
  type PostThreadSortMode,
  type ThreadPost,
  usePostThread,
} from "@/features/feed/api/usePostThread";
import { FeedCard } from "@/features/feed/components/FeedCard";
import { PostThreadRepliesShimmer } from "@/features/feed/components/PostThreadRepliesShimmer";
import { type FocusFeedPost } from "@/lib/focus/graphql";
import { type RootStackParamList } from "@/navigation/types";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { getBorderColor } from "@/theme/borders";

const REPLIES_PAGE_SIZE = 4;
const THREAD_CONNECTOR_OFFSET = 12;
const THREAD_CONTENT_OFFSET = 32;

function getReplyToggleLabel({
  showReplies,
  replyCount,
  hasNextPage,
  isFetchingNextPage,
}: {
  showReplies: boolean;
  replyCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
}) {
  if (!showReplies) {
    return replyCount > 1 ? "Show more replies" : "Show reply";
  }

  if (isFetchingNextPage) {
    return "Loading more replies...";
  }

  if (hasNextPage) {
    return "Show more replies";
  }

  return "Hide replies";
}

export function PostThreadCommentItem({
  threadPost,
  readerPublicKey,
  depth = 0,
  isVisible = true,
  onReplyPress,
  onReactionSummaryPress,
  sortMode = "valuable",
}: {
  threadPost: ThreadPost;
  readerPublicKey?: string | null;
  depth?: number;
  isVisible?: boolean;
  onReplyPress: (post: FocusFeedPost) => void;
  onReactionSummaryPress: (post: FocusFeedPost) => void;
  sortMode?: PostThreadSortMode;
}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isDark, accentColor } = useAccentColor();
  const shouldAutoExpand = threadPost.replyCount === 1;
  const [showReplies, setShowReplies] = React.useState(shouldAutoExpand);

  React.useEffect(() => {
    if (shouldAutoExpand) {
      setShowReplies(true);
    }
  }, [shouldAutoExpand]);

  const {
    comments,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
    loadMore,
    reload,
  } = usePostThread({
    postHash: threadPost.postHash,
    readerPublicKey,
    enabled: showReplies && threadPost.replyCount > 0,
    pageSize: REPLIES_PAGE_SIZE,
    includeParents: false,
    sortMode,
    initialPost: threadPost.post,
  });

  const connectorColor = getBorderColor(isDark, "subtle");
  const hasReplies = threadPost.replyCount > 0;
  const isInitialReplyLoad = showReplies && comments.length === 0 && isLoading;
  const hasVisibleReplies = showReplies && comments.length > 0;
  const shouldShowChildLine =
    hasVisibleReplies || (shouldAutoExpand && (isInitialReplyLoad || comments.length > 0));
  const shouldRenderReplyToggle =
    hasReplies && (!shouldAutoExpand || hasNextPage || (!showReplies && comments.length === 0));
  const shouldUseExpandedToggleRow = !showReplies || hasNextPage;

  const openReplies = React.useCallback(() => {
    setShowReplies(true);
  }, []);

  const closeReplies = React.useCallback(() => {
    setShowReplies(false);
  }, []);

  const handleRepliesPress = React.useCallback(() => {
    if (!showReplies) {
      openReplies();
      return;
    }

    if (hasNextPage && !isFetchingNextPage) {
      void loadMore();
      return;
    }

    closeReplies();
  }, [
    closeReplies,
    hasNextPage,
    isFetchingNextPage,
    loadMore,
    openReplies,
    showReplies,
  ]);

  const handleOpenThread = React.useCallback(
    (post: FocusFeedPost) => {
      if (!post.postHash) {
        return;
      }

      navigation.push("PostThread", {
        postHash: post.postHash,
        initialPost: post,
      });
    },
    [navigation],
  );
  const handleOpenProfile = React.useCallback(
    ({
      publicKey,
      username,
    }: {
      publicKey?: string | null;
      username?: string | null;
    }) => {
      const normalizedPublicKey = publicKey?.trim() ?? "";
      const normalizedUsername = username?.trim() ?? "";
      if (!normalizedPublicKey && !normalizedUsername) {
        return;
      }

      navigation.navigate("Main", {
        screen: "Profile",
        params: {
          publicKey: normalizedPublicKey || undefined,
          username: normalizedUsername || undefined,
        },
      });
    },
    [navigation],
  );

  const replyToggleLabel = getReplyToggleLabel({
    showReplies,
    replyCount: threadPost.replyCount,
    hasNextPage,
    isFetchingNextPage,
  });

  return (
    <View
      className={
        depth === 0
          ? "border-b border-slate-200/80 px-4 pb-3 pt-3 dark:border-slate-800/80"
          : "pt-1"
      }
    >
      {depth > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: THREAD_CONNECTOR_OFFSET,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: connectorColor,
          }}
        />
      ) : null}

      <FeedCard
        post={threadPost.post}
        variant="threadReply"
        threadChildLineVisible={shouldShowChildLine}
        threadLineColor={connectorColor}
        isVisible={isVisible}
        onPress={handleOpenThread}
        onProfilePress={handleOpenProfile}
        onReplyPress={onReplyPress}
        onReactionSummaryPress={onReactionSummaryPress}
      />

      {hasReplies ? (
        <View className="pb-1">
          {isInitialReplyLoad ? (
            <View className="pt-2">
              <PostThreadRepliesShimmer depth={0} count={2} />
            </View>
          ) : null}

          {showReplies && comments.length > 0 ? (
            <View className="pt-1">
              {comments.map((reply) => (
                <PostThreadCommentItem
                  key={reply.postHash}
                  threadPost={reply}
                  readerPublicKey={readerPublicKey}
                  depth={depth + 1}
                  isVisible
                  onReplyPress={onReplyPress}
                  onReactionSummaryPress={onReactionSummaryPress}
                  sortMode={sortMode}
                />
              ))}
            </View>
          ) : null}

          {showReplies && error ? (
            <View className="px-3 pb-3 pt-2">
              <Text
                className="text-[13px]"
                style={{ color: isDark ? "#fca5a5" : "#dc2626" }}
              >
                {error}
              </Text>
              <Pressable
                onPress={() => void reload()}
                className="mt-2 self-start rounded-full px-3 py-1.5"
                style={{
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.9)"
                    : "rgba(241, 245, 249, 1)",
                }}
                accessibilityRole="button"
                accessibilityLabel="Retry loading replies"
              >
                <Text
                  className="text-[12px] font-semibold"
                  style={{ color: isDark ? "#e2e8f0" : "#334155" }}
                >
                  Retry replies
                </Text>
              </Pressable>
            </View>
          ) : null}

          {showReplies && isFetchingNextPage ? (
            <View className="pt-1">
              <PostThreadRepliesShimmer depth={0} count={1} />
            </View>
          ) : null}

          {shouldRenderReplyToggle ? (
            shouldUseExpandedToggleRow ? (
              <Pressable
                onPress={handleRepliesPress}
                disabled={isLoading || isFetchingNextPage}
                className="mt-2 flex-row items-center gap-2 border-t border-slate-200/80 py-3 dark:border-slate-800/80"
                style={({ pressed }) => ({
                  opacity: pressed ? 0.82 : 1,
                  marginLeft: THREAD_CONTENT_OFFSET,
                  ...(Platform.OS === "web"
                    ? ({
                        cursor: "pointer",
                      } as const)
                    : null),
                })}
                accessibilityRole="button"
                accessibilityLabel={replyToggleLabel}
              >
                <View
                  className="h-6 w-6 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isDark
                      ? "rgba(30, 41, 59, 0.92)"
                      : "rgba(241, 245, 249, 1)",
                  }}
                >
                  {isFetchingNextPage ? (
                    <ActivityIndicator size="small" color={accentColor} />
                  ) : (
                    <Feather
                      name="eye-off"
                      size={13}
                      color={isDark ? "#94a3b8" : "#64748b"}
                    />
                  )}
                </View>

                <Text
                  className="flex-1 text-[13px]"
                  style={{ color: isDark ? "#94a3b8" : "#64748b" }}
                >
                  {replyToggleLabel}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleRepliesPress}
                disabled={isLoading || isFetchingNextPage}
                className="mt-1 self-start py-1"
                style={({ pressed }) => ({
                  opacity: pressed ? 0.82 : 1,
                  marginLeft: THREAD_CONTENT_OFFSET,
                  ...(Platform.OS === "web"
                    ? ({
                        cursor: "pointer",
                      } as const)
                    : null),
                })}
                accessibilityRole="button"
                accessibilityLabel={replyToggleLabel}
              >
                <Text
                  className="text-[12px] font-semibold"
                  style={{ color: accentColor }}
                >
                  {replyToggleLabel}
                </Text>
              </Pressable>
            )
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
