import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { type NativeStackScreenProps } from "@react-navigation/native-stack";
import { DeSoIdentityContext } from "react-deso-protocol";

import ScreenWrapper from "@/components/ScreenWrapper";
import {
  PageTopBar,
  PageTopBarIconButton,
} from "@/components/ui/PageTopBar";
import {
  type PostThreadSortMode,
  usePostThread,
} from "@/features/feed/api/usePostThread";
import { FeedCard } from "@/features/feed/components/FeedCard";
import { FeedCommentModal } from "@/features/feed/components/FeedCommentModal";
import { FeedPostShimmer } from "@/features/feed/components/FeedPostShimmer";
import { FeedReactionModal } from "@/features/feed/components/FeedReactionModal";
import { PostThreadCommentItem } from "@/features/feed/components/PostThreadCommentItem";
import { PostThreadReplyPrompt } from "@/features/feed/components/PostThreadReplyPrompt";
import { PostThreadRepliesShimmer } from "@/features/feed/components/PostThreadRepliesShimmer";
import { DesktopLeftNav } from "@/features/messaging/components/desktop/DesktopLeftNav";
import { DesktopRightNav } from "@/features/messaging/components/desktop/DesktopRightNav";
import { type FocusFeedPost } from "@/lib/focus/graphql";
import { type RootStackParamList } from "@/navigation/types";
import {
  CENTER_COLUMN_OFFSET,
  CENTER_CONTENT_MAX_WIDTH,
  useLayoutBreakpoints,
} from "@/alf/breakpoints";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { getBorderColor } from "@/theme/borders";

type PostThreadScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "PostThread"
>;

function formatCount(value: number): string {
  if (value <= 0) return "0";
  if (value < 1000) return `${Math.floor(value)}`;
  if (value < 10_000) return `${(value / 1000).toFixed(1)}K`;
  if (value < 1_000_000) return `${Math.floor(value / 1000)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

function normalizePostHash(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(/^0x/i, "");
}

const THREAD_DESKTOP_MAX_WIDTH = 720;
const THREAD_COMMENT_SORT_OPTIONS: Array<{
  label: string;
  value: PostThreadSortMode;
}> = [
  {
    label: "Most recent",
    value: "recent",
  },
  {
    label: "Most valuable",
    value: "valuable",
  },
];

export function PostThreadScreen({
  navigation,
  route,
}: PostThreadScreenProps) {
  const { currentUser } = React.useContext(DeSoIdentityContext);
  const { isDark, accentColor } = useAccentColor();
  const { isDesktop, centerColumnOffset } = useLayoutBreakpoints();
  const isDesktopWeb = Platform.OS === "web";
  const [commentSortMode, setCommentSortMode] =
    React.useState<PostThreadSortMode>("recent");
  const [isSortMenuOpen, setIsSortMenuOpen] = React.useState(false);
  const [commentTargetPost, setCommentTargetPost] =
    React.useState<FocusFeedPost | null>(null);
  const [reactionTargetPost, setReactionTargetPost] =
    React.useState<FocusFeedPost | null>(null);

  const postHash = route.params.postHash;
  const initialPost = route.params.initialPost ?? null;
  const initialIsFollowingAuthor = route.params.initialIsFollowingAuthor ?? null;
  const normalizedCurrentPostHash = normalizePostHash(postHash);
  const readerPublicKey = currentUser?.PublicKeyBase58Check?.trim() ?? null;

  const {
    parents,
    post,
    comments,
    totalCommentCount,
    loadedCommentCount,
    hasLoadedInitialPage,
    hasNextPage,
    isLoading,
    isRefreshing,
    isFetching,
    isFetchingNextPage,
    error,
    reload,
    loadMore,
  } = usePostThread({
    postHash,
    readerPublicKey,
    enabled: Boolean(postHash),
    sortMode: commentSortMode,
    initialPost,
  });

  React.useEffect(() => {
    setIsSortMenuOpen(false);
  }, [commentSortMode, normalizedCurrentPostHash]);

  const closeCommentComposer = React.useCallback(() => {
    setCommentTargetPost(null);
  }, []);

  const closeReactionSheet = React.useCallback(() => {
    setReactionTargetPost(null);
  }, []);

  const handleOpenCommentComposer = React.useCallback((target: FocusFeedPost) => {
    setCommentTargetPost(target);
  }, []);

  const handleOpenReactionSummary = React.useCallback((target: FocusFeedPost) => {
    setReactionTargetPost(target);
  }, []);

  const activeSortLabel = React.useMemo(
    () =>
      THREAD_COMMENT_SORT_OPTIONS.find((option) => option.value === commentSortMode)
        ?.label ?? "Most recent",
    [commentSortMode],
  );
  const handleReplyToAnchor = React.useCallback(() => {
    if (!post?.post) {
      return;
    }

    setCommentTargetPost(post.post);
  }, [post]);

  const handleOpenPostThread = React.useCallback(
    (target: FocusFeedPost) => {
      const nextPostHash = normalizePostHash(target.postHash);

      if (!nextPostHash || nextPostHash === normalizedCurrentPostHash) {
        return;
      }

      navigation.push("PostThread", {
        postHash: nextPostHash,
        initialPost: target,
      });
    },
    [navigation, normalizedCurrentPostHash],
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

  const threadColumnStyle = React.useMemo(
    () =>
      isDesktopWeb
        ? ({
            width: "100%",
            maxWidth: THREAD_DESKTOP_MAX_WIDTH,
            alignSelf: "center",
          } as const)
        : undefined,
    [isDesktopWeb],
  );

  const threadHeader = React.useMemo(() => {
    if (!post) {
      return null;
    }

    return (
      <View style={threadColumnStyle}>
        {parents.length > 0 ? (
          <View className="relative">
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 34,
                top: 0,
                bottom: 0,
                width: 2,
                backgroundColor: getBorderColor(isDark, "subtle"),
              }}
            />
            {parents.map((parent) => (
              <View
                key={parent.postHash}
                className="border-b border-slate-200/80 px-4 py-2.5 dark:border-slate-800/80"
              >
                <FeedCard
                  post={parent.post}
                  variant="threadReply"
                  isVisible
                  onPress={handleOpenPostThread}
                  onProfilePress={handleOpenProfile}
                  onReplyPress={handleOpenCommentComposer}
                  onReactionSummaryPress={handleOpenReactionSummary}
                />
              </View>
            ))}
          </View>
        ) : null}

        <FeedCard
          post={post.post}
          variant="thread"
          isVisible
          onPress={handleOpenPostThread}
          onProfilePress={handleOpenProfile}
          onReplyPress={handleOpenCommentComposer}
          onReactionSummaryPress={handleOpenReactionSummary}
          initialIsFollowingAuthor={initialIsFollowingAuthor}
        />

        <View
          className="relative border-b border-slate-200/80 px-4 py-3 dark:border-slate-800/80"
          style={{
            zIndex: isSortMenuOpen ? 40 : 1,
            overflow: "visible",
          }}
        >
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-[17px] font-semibold text-slate-900 dark:text-white">
              Comments ({Math.max(0, totalCommentCount).toLocaleString()})
            </Text>

            <View className="relative">
              <Pressable
                onPress={() => setIsSortMenuOpen((current) => !current)}
                className="flex-row items-center gap-2 rounded-full px-3 py-1.5"
                style={({ pressed }) => ({
                  opacity: pressed ? 0.9 : 1,
                  backgroundColor: isDark
                    ? "rgba(30, 41, 59, 0.72)"
                    : "rgba(241, 245, 249, 0.96)",
                  ...(Platform.OS === "web"
                    ? ({
                        cursor: "pointer",
                      } as const)
                    : null),
                })}
                accessibilityRole="button"
                accessibilityLabel="Change comment sort"
              >
                <Text className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                  Sort:
                </Text>
                <Text className="text-[13px] font-semibold text-slate-900 dark:text-white">
                  {activeSortLabel}
                </Text>
                <Feather
                  name={isSortMenuOpen ? "chevron-up" : "chevron-down"}
                  size={15}
                  color={isDark ? "#cbd5e1" : "#475569"}
                />
              </Pressable>
              {isSortMenuOpen ? (
                <View
                  className="absolute right-0 top-full mt-2 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80"
                  style={{
                    minWidth: 176,
                    backgroundColor: isDark ? "#111827" : "#ffffff",
                    shadowColor: "#020617",
                    shadowOpacity: isDark ? 0.36 : 0.12,
                    shadowRadius: 18,
                    shadowOffset: { width: 0, height: 10 },
                    elevation: 14,
                    zIndex: 60,
                  }}
                >
                  {THREAD_COMMENT_SORT_OPTIONS.map((option, index) => {
                    const isActive = option.value === commentSortMode;

                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => {
                          setCommentSortMode(option.value);
                          setIsSortMenuOpen(false);
                        }}
                        className="flex-row items-center justify-between gap-3 px-4 py-3"
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.88 : 1,
                          backgroundColor: isActive
                            ? isDark
                              ? "rgba(29, 155, 240, 0.18)"
                              : "rgba(29, 155, 240, 0.1)"
                            : "transparent",
                          borderTopWidth: index === 0 ? 0 : 1,
                          borderTopColor: getBorderColor(isDark, "subtle"),
                          ...(Platform.OS === "web"
                            ? ({
                                cursor: "pointer",
                              } as const)
                            : null),
                        })}
                        accessibilityRole="button"
                        accessibilityLabel={`Sort comments by ${option.label}`}
                      >
                        <Text
                          numberOfLines={1}
                          className="flex-1 text-[14px] font-medium"
                          style={{
                            color: isActive
                              ? accentColor
                              : isDark
                                ? "#e2e8f0"
                                : "#0f172a",
                          }}
                        >
                          {option.label}
                        </Text>
                        {isActive ? (
                          <Feather name="check" size={15} color={accentColor} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    );
  }, [
    activeSortLabel,
    accentColor,
    handleOpenCommentComposer,
    handleOpenProfile,
    handleOpenPostThread,
    handleOpenReactionSummary,
    isDark,
    isSortMenuOpen,
    parents,
    post,
    threadColumnStyle,
    totalCommentCount,
  ]);

  const emptyState = React.useMemo(() => {
    if (!post) {
      return null;
    }

    if (!hasLoadedInitialPage && isFetching) {
      return (
        <View className="px-4 pb-4 pt-3" style={threadColumnStyle}>
          <PostThreadRepliesShimmer count={2} />
        </View>
      );
    }

    if (!hasLoadedInitialPage || error) {
      return null;
    }

    return (
      <View className="items-center px-6 py-16" style={threadColumnStyle}>
        <Text className="text-[17px] font-semibold text-slate-900 dark:text-white">
          No replies yet
        </Text>
        <Text className="mt-2 text-center text-[14px] text-slate-500 dark:text-slate-400">
          Be the first person to reply to this thread.
        </Text>
      </View>
    );
  }, [error, hasLoadedInitialPage, isFetching, post, threadColumnStyle]);

  const footer = React.useMemo(() => {
    if (isFetchingNextPage) {
      return (
        <View className="pb-6 pt-2" style={threadColumnStyle}>
          <PostThreadRepliesShimmer count={2} />
        </View>
      );
    }

    if (!hasNextPage || !post) {
      return <View className="h-8" />;
    }

    return (
      <View className="px-4 pb-8 pt-3" style={threadColumnStyle}>
        <Pressable
          onPress={() => void loadMore()}
          className="self-start flex-row items-center gap-2 py-1"
          style={({ pressed }) => ({
            opacity: pressed ? 0.84 : 1,
            ...(Platform.OS === "web"
              ? ({
                  cursor: "pointer",
                } as const)
              : null),
          })}
          accessibilityRole="button"
          accessibilityLabel="Show more comments"
        >
          <View
            style={{
              width: 24,
              height: 1,
              backgroundColor: getBorderColor(isDark, "subtle"),
            }}
          />
          <Text
            className="text-[13px] font-semibold"
            style={{ color: accentColor }}
          >
            Show more comments
            {loadedCommentCount < totalCommentCount
              ? ` (${formatCount(totalCommentCount - loadedCommentCount)} left)`
              : ""}
          </Text>
        </Pressable>
      </View>
    );
  }, [
    accentColor,
    hasNextPage,
    isDark,
    isFetchingNextPage,
    loadMore,
    loadedCommentCount,
    post,
    threadColumnStyle,
    totalCommentCount,
  ]);

  const screenContent = (
    <View className="flex-1">
      <PageTopBar
        title="Post"
        leftSlot={
          <PageTopBarIconButton
            onPress={navigation.goBack}
            accessibilityLabel="Go back"
          >
            <Feather
              name="arrow-left"
              size={18}
              color={isDark ? "#f8fafc" : "#0f172a"}
            />
          </PageTopBarIconButton>
        }
      />

      {isLoading && !post ? (
        <View className="flex-1">
          <FeedPostShimmer />
          <PostThreadRepliesShimmer count={3} />
        </View>
      ) : error && !post ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-[18px] font-semibold text-slate-900 dark:text-white">
            Unable to open this thread
          </Text>
          <Text className="mt-2 text-center text-[14px] text-slate-500 dark:text-slate-400">
            {error}
          </Text>
          <Pressable
            onPress={() => void reload()}
            className="mt-4 rounded-full px-4 py-2"
            style={{ backgroundColor: accentColor }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading thread"
          >
            <Text className="text-[13px] font-semibold text-white">Retry</Text>
          </Pressable>
        </View>
      ) : post ? (
        <FlashList
          data={comments}
          keyExtractor={(item) => item.postHash}
          renderItem={({ item, index }) => (
            <View style={threadColumnStyle}>
              <PostThreadCommentItem
                threadPost={item}
                readerPublicKey={readerPublicKey}
                sortMode={commentSortMode}
                isVisible={index < 3}
                onReplyPress={handleOpenCommentComposer}
                onReactionSummaryPress={handleOpenReactionSummary}
              />
            </View>
          )}
          ListHeaderComponent={threadHeader}
          ListEmptyComponent={emptyState}
          ListFooterComponent={footer}
          contentContainerStyle={{
            paddingBottom: 132,
            flexGrow: comments.length === 0 ? 1 : undefined,
          }}
          refreshControl={
            Platform.OS !== "web" ? (
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => void reload()}
                tintColor={accentColor}
                colors={[accentColor]}
              />
            ) : undefined
          }
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={Platform.OS === "web"}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-[18px] font-semibold text-slate-900 dark:text-white">
            Post unavailable
          </Text>
          <Text className="mt-2 text-center text-[14px] text-slate-500 dark:text-slate-400">
            This post may have been removed or is temporarily unavailable.
          </Text>
        </View>
      )}

      <FeedCommentModal
        key={commentTargetPost?.postHash ?? "thread-comment-modal"}
        visible={Boolean(commentTargetPost)}
        post={commentTargetPost}
        onClose={closeCommentComposer}
      />

      <FeedReactionModal
        key={reactionTargetPost?.postHash ?? "thread-reaction-modal"}
        visible={Boolean(reactionTargetPost)}
        post={reactionTargetPost}
        onClose={closeReactionSheet}
      />

      {post ? <PostThreadReplyPrompt onPress={handleReplyToAnchor} /> : null}

      {isFetchingNextPage && post ? (
        <View className="absolute bottom-5 right-5 rounded-full bg-slate-900/85 px-3 py-2 dark:bg-slate-100/90">
          <View className="flex-row items-center gap-2">
            <ActivityIndicator
              size="small"
              color={isDark ? "#0f172a" : "#f8fafc"}
            />
            <Text
              className="text-[12px] font-semibold"
              style={{ color: isDark ? "#0f172a" : "#f8fafc" }}
            >
              Loading
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <ScreenWrapper
      edges={["top", "left", "right"]}
      keyboardAvoiding={false}
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
    >
      {isDesktop ? (
        <View
          className="flex-1"
          style={{ backgroundColor: isDark ? "#0a0f1a" : "#ffffff" }}
        >
          <DesktopLeftNav activeTab="Feed" />

          <View className="flex-1 items-center">
            <View
              className="flex-1 w-full"
              style={{
                maxWidth: CENTER_CONTENT_MAX_WIDTH,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: getBorderColor(isDark, "contrast_low"),
                transform: [
                  {
                    translateX: centerColumnOffset ? CENTER_COLUMN_OFFSET : 0,
                  },
                ],
                ...(Platform.OS === "web"
                  ? ({
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    } as const)
                  : null),
              }}
            >
              {screenContent}
            </View>
          </View>

          <DesktopRightNav />
        </View>
      ) : (
        screenContent
      )}
    </ScreenWrapper>
  );
}
