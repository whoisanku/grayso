import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { type NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ScreenWrapper from "@/components/ScreenWrapper";
import { FeedPostShimmer } from "../components/FeedPostShimmer";
import { FeedCard } from "@/features/feed/components/FeedCard";
import { FeedCommentModal } from "@/features/feed/components/FeedCommentModal";
import { FeedReactionModal } from "@/features/feed/components/FeedReactionModal";
import {
  FeedRepostActionModal,
  type FeedRepostActionAnchor,
} from "@/features/feed/components/FeedRepostActionModal";
import { useFollowFeedTimeline } from "@/features/feed/api/useFollowFeedTimeline";
import { useForYouFeedTimeline } from "@/features/feed/api/useForYouFeedTimeline";
import { feedKeys } from "@/features/feed/api/keys";
import { useSubmitRepost } from "@/features/feed/api/useSubmitRepost";
import { type FocusFeedPost } from "@/lib/focus/graphql";
import { type RootStackParamList } from "@/navigation/types";
import { useManualRefresh } from "@/hooks/useManualRefresh";
import { useSetDrawerOpen } from "@/state/shell";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Toast } from "@/components/ui/Toast";
import { PageTopBar, PageTopBarIconButton } from "@/components/ui/PageTopBar";

const EMPTY_VISIBLE_HASHES = new Set<string>();
const MOBILE_FEED_BOTTOM_CLEARANCE = 96;

type FeedMode = "forYou" | "following";

function resolveRepostTargetPostHash(post: FocusFeedPost): string {
  const rawPostBody = post.body?.trim() ?? "";
  const isPureRepost = Boolean(post.repostedPost?.postHash && !rawPostBody);

  return isPureRepost ? post.repostedPost?.postHash ?? post.postHash : post.postHash;
}

export function FeedScreen() {
  const { currentUser } = useContext(DeSoIdentityContext);
  const { isDark, accentColor } = useAccentColor();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const setDrawerOpen = useSetDrawerOpen();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const flashListRef = useRef<any>(null);

  const userPublicKey = currentUser?.PublicKeyBase58Check;
  const normalizedUserPublicKey = userPublicKey?.trim() ?? "";
  const isDesktopWeb = Platform.OS === "web" && windowWidth >= 1024;
  const [activeFeedMode, setActiveFeedMode] = useState<FeedMode>("forYou");
  const [arrowProgress] = useState(() => new Animated.Value(0));
  const [visiblePostHashes, setVisiblePostHashes] =
    useState<Set<string>>(EMPTY_VISIBLE_HASHES);
  const activeFeedLabel = activeFeedMode === "forYou" ? "For You" : "Following";

  const followingFeed = useFollowFeedTimeline({
    followerPublicKey: userPublicKey,
    readerPublicKey: userPublicKey,
    enabled: activeFeedMode === "following",
    pageSize: 20,
  });
  const forYouFeed = useForYouFeedTimeline({
    readerPublicKey: userPublicKey,
    enabled: activeFeedMode === "forYou",
    pageSize: 20,
  });

  const activeFeed = activeFeedMode === "forYou" ? forYouFeed : followingFeed;
  const {
    posts,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    reload,
    loadMore,
  } = activeFeed;

  const activeFeedQueryKey = useMemo(
    () =>
      activeFeedMode === "forYou"
        ? feedKeys.forYouTimeline(normalizedUserPublicKey)
        : feedKeys.timeline(normalizedUserPublicKey, normalizedUserPublicKey),
    [activeFeedMode, normalizedUserPublicKey],
  );

  const { isRefreshing: isManualRefreshing, onRefresh: handleRefresh } =
    useManualRefresh(async () => {
      await queryClient.invalidateQueries({
        queryKey: activeFeedQueryKey,
        exact: true,
      });
      await reload();
      flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });

  const canPullToRefresh =
    (activeFeedMode === "forYou" || Boolean(userPublicKey)) &&
    Platform.OS !== "web";
  const refreshSpinnerColor = isDark ? "#f8fafc" : "#0f172a";

  const [commentTargetPost, setCommentTargetPost] = useState<FocusFeedPost | null>(
    null,
  );
  const [quoteTargetPost, setQuoteTargetPost] = useState<FocusFeedPost | null>(
    null,
  );
  const [reactionTargetPost, setReactionTargetPost] = useState<FocusFeedPost | null>(
    null,
  );
  const [repostActionTarget, setRepostActionTarget] = useState<{
    post: FocusFeedPost;
    anchor: FeedRepostActionAnchor;
  } | null>(null);
  const [viewabilityConfig] = useState(() => ({
    itemVisiblePercentThreshold: 60,
    waitForInteraction: false,
  }));
  const { mutateAsync: submitRepostAsync, isPending: isSubmittingRepost } =
    useSubmitRepost();

  useEffect(() => {
    Animated.timing(arrowProgress, {
      toValue: activeFeedMode === "following" ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeFeedMode, arrowProgress]);

  const onViewableItemsChanged = useCallback(
    (payload: {
      viewableItems: { item: FocusFeedPost; isViewable?: boolean }[];
    }) => {
      const next = new Set<string>();

      for (const token of payload.viewableItems) {
        if (!token.isViewable) continue;
        const hash = token.item?.postHash;
        if (hash) {
          next.add(hash);
        }
      }

      setVisiblePostHashes((previous) => {
        if (previous.size === next.size) {
          let isSame = true;
          for (const hash of next) {
            if (!previous.has(hash)) {
              isSame = false;
              break;
            }
          }

          if (isSame) {
            return previous;
          }
        }

        return next;
      });
    },
    [],
  );

  const toggleFeedMode = useCallback(() => {
    setVisiblePostHashes(EMPTY_VISIBLE_HASHES);
    setActiveFeedMode((previous) =>
      previous === "forYou" ? "following" : "forYou",
    );
  }, []);

  const openDrawer = useCallback(() => setDrawerOpen(true), [setDrawerOpen]);

  const openCommentComposer = useCallback((post: FocusFeedPost) => {
    setCommentTargetPost(post);
  }, []);

  const openQuoteComposer = useCallback((post: FocusFeedPost) => {
    setQuoteTargetPost(post);
  }, []);

  const closeCommentComposer = useCallback(() => {
    setCommentTargetPost(null);
  }, []);

  const closeQuoteComposer = useCallback(() => {
    setQuoteTargetPost(null);
  }, []);

  const openReactionList = useCallback((post: FocusFeedPost) => {
    setReactionTargetPost(post);
  }, []);

  const closeReactionList = useCallback(() => {
    setReactionTargetPost(null);
  }, []);

  const openPostThread = useCallback(
    (post: FocusFeedPost) => {
      if (!post.postHash) {
        return;
      }

      const targetAuthorPublicKey = post.poster?.publicKey?.trim() ?? "";
      const cachedFollowStatus =
        normalizedUserPublicKey && targetAuthorPublicKey
          ? queryClient.getQueryData<boolean>(
              feedKeys.followStatus(
                normalizedUserPublicKey,
                targetAuthorPublicKey,
              ),
            )
          : undefined;

      navigation.push("PostThread", {
        postHash: post.postHash,
        initialPost: post,
        initialIsFollowingAuthor:
          typeof cachedFollowStatus === "boolean" ? cachedFollowStatus : null,
      });
    },
    [navigation, normalizedUserPublicKey, queryClient],
  );
  const openProfile = useCallback(
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

  const openRepostActionMenu = useCallback(
    (post: FocusFeedPost, anchor: FeedRepostActionAnchor) => {
      setRepostActionTarget({ post, anchor });
    },
    [],
  );

  const closeRepostActionMenu = useCallback(() => {
    setRepostActionTarget(null);
  }, []);

  const handleReplyOrQuoteSubmitted = useCallback(() => {
    void reload();
  }, [reload]);

  const handleSelectQuoteFromRepostMenu = useCallback(() => {
    if (!repostActionTarget?.post) {
      return;
    }

    openQuoteComposer(repostActionTarget.post);
    closeRepostActionMenu();
  }, [closeRepostActionMenu, openQuoteComposer, repostActionTarget]);

  const handleSelectRepostFromRepostMenu = useCallback(async () => {
    if (!repostActionTarget?.post || isSubmittingRepost) {
      return;
    }

    const updaterPublicKey = currentUser?.PublicKeyBase58Check?.trim() ?? "";
    if (!updaterPublicKey) {
      Toast.show({
        type: "error",
        text1: "Login required",
        text2: "Sign in to repost posts.",
      });
      return;
    }

    try {
      await submitRepostAsync({
        updaterPublicKey,
        repostedPostHash: resolveRepostTargetPostHash(repostActionTarget.post),
      });

      closeRepostActionMenu();
      Toast.show({
        type: "success",
        text1: "Reposted",
        text2: "This post was shared to your feed.",
      });

      await Promise.resolve(reload());
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Failed to repost",
        text2:
          error instanceof Error && error.message
            ? error.message
            : "Please try again.",
      });
    }
  }, [
    closeRepostActionMenu,
    currentUser?.PublicKeyBase58Check,
    isSubmittingRepost,
    reload,
    repostActionTarget,
    submitRepostAsync,
  ]);

  const listEmptyState = useMemo(() => {
    if (isLoading) {
      return <FeedPostShimmer />;
    }

    if (activeFeedMode === "following" && !userPublicKey) {
      return (
        <View className="flex-1 items-center justify-center px-6 py-20">
          <Text className="text-lg font-semibold text-slate-900 dark:text-white">
            Sign in to view following feed
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
            Following posts will appear here after login.
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View className="flex-1 items-center justify-center px-6 py-20">
          <Text className="text-base font-semibold text-red-600 dark:text-red-300">
            Unable to load feed
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
            {error}
          </Text>
          <Pressable
            onPress={() => void reload()}
            className="mt-4 rounded-full px-4 py-2"
            style={{ backgroundColor: accentColor }}
          >
            <Text className="text-sm font-semibold text-white">Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center px-6 py-20">
        <Text className="text-lg font-semibold text-slate-900 dark:text-white">
          No posts yet
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          {activeFeedMode === "forYou"
            ? "No posts found in your For You feed right now."
            : "Follow more creators to populate your following feed."}
        </Text>
      </View>
    );
  }, [accentColor, activeFeedMode, error, isLoading, reload, userPublicKey]);

  const arrowRotation = arrowProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const feedBottomInset = isDesktopWeb
    ? 24
    : Math.max(insets.bottom, 15) + MOBILE_FEED_BOTTOM_CLEARANCE;
  const feedContentContainerStyle =
    posts.length === 0
      ? {
          flexGrow: 1 as const,
          paddingBottom: feedBottomInset,
        }
      : {
          paddingBottom: feedBottomInset,
        };
  const renderFeedItem = useCallback(
    ({ item, index }: { item: FocusFeedPost; index: number }) => (
      <FeedCard
        post={item}
        isVisible={
          visiblePostHashes.size === 0
            ? index < 2
            : visiblePostHashes.has(item.postHash)
        }
        onPress={openPostThread}
        onReplyPress={openCommentComposer}
        onRepostPress={openRepostActionMenu}
        onProfilePress={openProfile}
        onReactionSummaryPress={openReactionList}
      />
    ),
    [
      openCommentComposer,
      openPostThread,
      openProfile,
      openReactionList,
      openRepostActionMenu,
      visiblePostHashes,
    ],
  );
  const feedFooter = isFetchingNextPage ? (
    <View
      className="items-center pt-5"
      style={{ paddingBottom: isDesktopWeb ? 0 : 16 }}
    >
      <ActivityIndicator
        size="small"
        color={isDark ? "#e2e8f0" : accentColor}
      />
    </View>
  ) : null;

  return (
    <ScreenWrapper
      edges={["top", "left", "right"]}
      keyboardAvoiding={false}
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
    >
      <View className="flex-1">
        <PageTopBar
          titleSlot={
            <Pressable
              onPress={toggleFeedMode}
              accessibilityRole="button"
              accessibilityLabel={`Switch feed. Current feed: ${activeFeedLabel}`}
              style={({ pressed }) => {
                const style: any = {
                  opacity: pressed ? 0.82 : 1,
                };

                if (Platform.OS === "web") {
                  style.cursor = "pointer";
                }

                return style;
              }}
            >
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[24px] font-bold tracking-[-0.3px] text-slate-900 dark:text-white">
                  {activeFeedLabel}
                </Text>
                <Animated.View
                  style={{
                    transform: [{ rotate: arrowRotation }],
                  }}
                >
                  <Feather
                    name="chevron-down"
                    size={18}
                    color={isDark ? "#f8fafc" : "#0f172a"}
                  />
                </Animated.View>
              </View>
            </Pressable>
          }
          leftSlot={
            !isDesktopWeb ? (
              <PageTopBarIconButton
                onPress={openDrawer}
                accessibilityLabel="Open menu"
              >
                <Feather
                  name="menu"
                  size={18}
                  color={isDark ? "#f8fafc" : "#0f172a"}
                />
              </PageTopBarIconButton>
            ) : undefined
          }
        />

        <PullToRefresh
          onRefresh={handleRefresh}
          isRefreshing={isManualRefreshing}
          enabled={Platform.OS === "web" && !isDesktopWeb}
        >
          <View
            // @ts-ignore - data attribute for web touch/scroll behavior
            dataSet={{ virtualizedList: "true", scrollable: "true" }}
            className="flex-1"
          >
            {Platform.OS === "web" ? (
              <FlatList
                ref={flashListRef}
                data={posts}
                keyExtractor={(item) => item.postHash}
                renderItem={renderFeedItem}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage) {
                    void loadMore();
                  }
                }}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={listEmptyState}
                ListFooterComponent={feedFooter}
                contentContainerStyle={feedContentContainerStyle}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
                initialNumToRender={6}
                maxToRenderPerBatch={8}
                windowSize={7}
              />
            ) : (
              <FlashList
                ref={flashListRef}
                data={posts}
                // @ts-expect-error FlashList runtime supports this; installed types are stale.
                estimatedItemSize={420}
                keyExtractor={(item) => item.postHash}
                renderItem={renderFeedItem}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onEndReached={() => {
                  if (hasNextPage && !isFetchingNextPage) {
                    void loadMore();
                  }
                }}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={listEmptyState}
                ListFooterComponent={feedFooter}
                contentContainerStyle={feedContentContainerStyle}
                refreshControl={
                  canPullToRefresh ? (
                    <RefreshControl
                      tintColor={refreshSpinnerColor}
                      colors={[refreshSpinnerColor]}
                      progressBackgroundColor={isDark ? "#0f172a" : "#ffffff"}
                      refreshing={isManualRefreshing}
                      onRefresh={handleRefresh}
                    />
                  ) : undefined
                }
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </PullToRefresh>

        <FeedCommentModal
          key={commentTargetPost?.postHash ?? "feed-comment-modal"}
          visible={Boolean(commentTargetPost)}
          post={commentTargetPost}
          onClose={closeCommentComposer}
          onSubmitted={handleReplyOrQuoteSubmitted}
        />

        <FeedCommentModal
          key={quoteTargetPost?.postHash ?? "feed-quote-modal"}
          visible={Boolean(quoteTargetPost)}
          post={quoteTargetPost}
          mode="quote"
          onClose={closeQuoteComposer}
          onSubmitted={handleReplyOrQuoteSubmitted}
        />

        <FeedRepostActionModal
          visible={Boolean(repostActionTarget)}
          anchor={repostActionTarget?.anchor ?? null}
          onClose={closeRepostActionMenu}
          onSelectRepost={() => {
            void handleSelectRepostFromRepostMenu();
          }}
          onSelectQuote={handleSelectQuoteFromRepostMenu}
          isSubmittingRepost={isSubmittingRepost}
        />

        <FeedReactionModal
          key={reactionTargetPost?.postHash ?? "feed-reaction-modal"}
          visible={Boolean(reactionTargetPost)}
          post={reactionTargetPost}
          onClose={closeReactionList}
        />
      </View>
    </ScreenWrapper>
  );
}
