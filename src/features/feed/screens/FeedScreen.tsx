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
  Platform,
  RefreshControl,
  Text,
  View,
  Pressable,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ScreenWrapper from "@/components/ScreenWrapper";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { FeedPostShimmer } from "../components/FeedPostShimmer";
import { useFollowFeedTimeline } from "@/features/feed/api/useFollowFeedTimeline";
import { useForYouFeedTimeline } from "@/features/feed/api/useForYouFeedTimeline";
import { FeedCard } from "@/features/feed/components/FeedCard";
import { FeedCommentModal } from "@/features/feed/components/FeedCommentModal";
import { FeedReactionModal } from "@/features/feed/components/FeedReactionModal";
import {
  FeedRepostActionModal,
  type FeedRepostActionAnchor,
} from "@/features/feed/components/FeedRepostActionModal";
import { useSubmitRepost } from "@/features/feed/api/useSubmitRepost";
import { type FocusFeedPost } from "@/lib/focus/graphql";
import { useSetDrawerOpen } from "@/state/shell";
import { PageTopBar, PageTopBarIconButton } from "@/components/ui/PageTopBar";
import { PressableScale } from "@/components/ui/PressableScale";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { useManualRefresh } from "@/hooks/useManualRefresh";
import { feedKeys } from "@/features/feed/api/keys";
import { Toast } from "@/components/ui/Toast";

const SCROLL_TO_TOP_THRESHOLD = 500;

const EMPTY_VISIBLE_HASHES = new Set<string>();
type FeedMode = "forYou" | "following";
type NativeScrollToRef = {
  scrollTo?: (options: { x?: number; y?: number; animated?: boolean }) => void;
};

function resolveRepostTargetPostHash(post: FocusFeedPost): string {
  const rawPostBody = post.body?.trim() ?? "";
  const isPureRepost = Boolean(post.repostedPost?.postHash && !rawPostBody);

  return isPureRepost ? post.repostedPost?.postHash ?? post.postHash : post.postHash;
}

export function FeedScreen() {
  const { currentUser } = useContext(DeSoIdentityContext);
  const { isDark, accentColor } = useAccentColor();
  const queryClient = useQueryClient();
  const { width: windowWidth } = useWindowDimensions();
  const setDrawerOpen = useSetDrawerOpen();
  const insets = useSafeAreaInsets();

  const flashListRef = useRef<FlashList<FocusFeedPost> | null>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const showScrollToTopRef = useRef(false);
  const [scrollToTopOpacity] = useState(() => new Animated.Value(0));

  const scrollListToTop = useCallback((animated: boolean) => {
    const list = flashListRef.current;
    if (!list) {
      return;
    }

    list.scrollToOffset({ offset: 0, animated });

    const maybeNativeRef = (
      list as unknown as { getNativeScrollRef?: () => unknown }
    ).getNativeScrollRef?.();

    if (
      maybeNativeRef &&
      typeof (maybeNativeRef as NativeScrollToRef).scrollTo === "function"
    ) {
      (maybeNativeRef as NativeScrollToRef).scrollTo?.({
        x: 0,
        y: 0,
        animated,
      });
    }
  }, []);

  const userPublicKey = currentUser?.PublicKeyBase58Check;
  const normalizedUserPublicKey = userPublicKey?.trim() ?? "";
  const isDesktopWeb = Platform.OS === "web" && windowWidth >= 1024;
  const [activeFeedMode, setActiveFeedMode] = useState<FeedMode>("forYou");
  const [arrowProgress] = useState(() => new Animated.Value(0));
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
      // Scroll to top to show new content
      scrollListToTop(true);
      requestAnimationFrame(() => {
        scrollListToTop(false);
      });
    });
  const canPullToRefresh =
    (activeFeedMode === "forYou" || Boolean(userPublicKey)) &&
    Platform.OS !== "web";
  const refreshSpinnerColor = isDark ? "#f8fafc" : "#0f172a";

  const [visiblePostHashes, setVisiblePostHashes] =
    useState<Set<string>>(EMPTY_VISIBLE_HASHES);
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
  const { mutateAsync: submitRepostAsync, isPending: isSubmittingRepost } =
    useSubmitRepost();
  const [viewabilityConfig] = useState(() => ({
    itemVisiblePercentThreshold: 60,
    waitForInteraction: false,
  }));

  useEffect(() => {
    Animated.timing(arrowProgress, {
      toValue: activeFeedMode === "following" ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeFeedMode, arrowProgress]);

  useEffect(() => {
    showScrollToTopRef.current = showScrollToTop;
  }, [showScrollToTop]);

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

  // Track scroll position for scroll-to-top button
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const shouldShow = offsetY > SCROLL_TO_TOP_THRESHOLD;

      if (showScrollToTopRef.current === shouldShow) {
        return;
      }

      showScrollToTopRef.current = shouldShow;
      setShowScrollToTop(shouldShow);

      Animated.timing(scrollToTopOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    },
    [scrollToTopOpacity],
  );

  const scrollToTop = useCallback(() => {
    scrollListToTop(true);

    // Force final top snap; avoids stopping slightly above 0 on some mobile momentum states.
    requestAnimationFrame(() => {
      scrollListToTop(false);
    });
    setTimeout(() => {
      scrollListToTop(false);
    }, 180);
  }, [scrollListToTop]);

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
            <FlashList
              ref={flashListRef}
              data={posts}
              estimatedItemSize={420}
              keyExtractor={(item) => item.postHash}
              renderItem={({ item, index }) => (
                <FeedCard
                  post={item}
                  isVisible={
                    visiblePostHashes.size === 0
                      ? index < 2
                      : visiblePostHashes.has(item.postHash)
                  }
                  onReplyPress={openCommentComposer}
                  onRepostPress={openRepostActionMenu}
                  onReactionSummaryPress={openReactionList}
                />
              )}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              onScroll={handleScroll}
              scrollEventThrottle={32}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  void loadMore();
                }
              }}
              onEndReachedThreshold={0.35}
              ListEmptyComponent={listEmptyState}
              ListFooterComponent={
                isFetchingNextPage ? (
                  <View className="items-center py-5">
                    <ActivityIndicator size="small" color={accentColor} />
                  </View>
                ) : null
              }
              contentContainerStyle={
                posts.length === 0
                  ? {
                      flexGrow: 1,
                      paddingBottom: isDesktopWeb ? 24 : 84,
                    }
                  : {
                      paddingBottom: isDesktopWeb ? 24 : 84,
                    }
              }
              refreshControl={
                canPullToRefresh ? (
                  <RefreshControl
                    refreshing={isManualRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={refreshSpinnerColor}
                    colors={[refreshSpinnerColor]}
                    progressBackgroundColor={isDark ? "#0f172a" : "#ffffff"}
                  />
                ) : undefined
              }
              showsVerticalScrollIndicator={Platform.OS === "web"}
              keyboardShouldPersistTaps="always"
              removeClippedSubviews={Platform.OS !== "web"}
            />
          </View>
        </PullToRefresh>

        {/* Scroll-to-top arrow button — appears when scrolled deep */}
        {showScrollToTop ? (
          <Animated.View
            style={{
              position: "absolute",
              left: 24,
              bottom: isDesktopWeb ? 24 : Math.max(insets.bottom, 15) + 56,
              opacity: scrollToTopOpacity,
              transform: [
                {
                  scale: scrollToTopOpacity.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1],
                  }),
                },
              ],
            }}
          >
            <PressableScale
              onPress={scrollToTop}
              targetScale={0.9}
              accessibilityRole="button"
              accessibilityLabel="Scroll to top"
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isDark
                  ? "rgba(30, 41, 59, 0.92)"
                  : "rgba(255, 255, 255, 0.95)",
                borderWidth: 1,
                borderColor: isDark
                  ? "rgba(71, 85, 105, 0.5)"
                  : "rgba(148, 163, 184, 0.35)",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <Feather
                name="arrow-up"
                size={20}
                color={isDark ? "#e2e8f0" : "#334155"}
              />
            </PressableScale>
          </Animated.View>
        ) : null}

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
