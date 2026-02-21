import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { DeSoIdentityContext } from "react-deso-protocol";
import { Feather } from "@expo/vector-icons";

import ScreenWrapper from "@/components/ScreenWrapper";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { FeedPostShimmer } from "../components/FeedPostShimmer";
import { useFollowFeedTimeline } from "@/features/feed/api/useFollowFeedTimeline";
import { useForYouFeedTimeline } from "@/features/feed/api/useForYouFeedTimeline";
import { FeedCard } from "@/features/feed/components/FeedCard";
import { FeedCommentModal } from "@/features/feed/components/FeedCommentModal";
import { FeedReactionModal } from "@/features/feed/components/FeedReactionModal";
import { type FocusFeedPost } from "@/lib/focus/graphql";
import { useSetDrawerOpen } from "@/state/shell";
import { PageTopBar, PageTopBarIconButton } from "@/components/ui/PageTopBar";
import { useManualRefresh } from "@/hooks/useManualRefresh";

const EMPTY_VISIBLE_HASHES = new Set<string>();
type FeedMode = "forYou" | "following";

export function FeedScreen() {
  const { currentUser } = useContext(DeSoIdentityContext);
  const { isDark, accentColor } = useAccentColor();
  const { width: windowWidth } = useWindowDimensions();
  const setDrawerOpen = useSetDrawerOpen();

  const userPublicKey = currentUser?.PublicKeyBase58Check;
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
  const { isRefreshing: isManualRefreshing, onRefresh: handleRefresh } =
    useManualRefresh(reload);
  const canPullToRefresh =
    (activeFeedMode === "forYou" || Boolean(userPublicKey)) &&
    (Platform.OS !== "web" || !isDesktopWeb);

  const [visiblePostHashes, setVisiblePostHashes] =
    useState<Set<string>>(EMPTY_VISIBLE_HASHES);
  const [commentTargetPost, setCommentTargetPost] = useState<FocusFeedPost | null>(
    null,
  );
  const [reactionTargetPost, setReactionTargetPost] = useState<FocusFeedPost | null>(
    null,
  );
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
  const closeCommentComposer = useCallback(() => {
    setCommentTargetPost(null);
  }, []);
  const openReactionList = useCallback((post: FocusFeedPost) => {
    setReactionTargetPost(post);
  }, []);
  const closeReactionList = useCallback(() => {
    setReactionTargetPost(null);
  }, []);
  const handleCommentSubmitted = useCallback(() => {
    void reload();
  }, [reload]);

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

        <View
          // @ts-ignore - data attribute for web touch/scroll behavior
          dataSet={{ virtualizedList: "true", scrollable: "true" }}
          className="flex-1"
        >
          <FlashList
            data={posts}
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
                onReactionSummaryPress={openReactionList}
              />
            )}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
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
                  tintColor={accentColor}
                  colors={[accentColor]}
                />
              ) : undefined
            }
            showsVerticalScrollIndicator={Platform.OS === "web"}
            keyboardShouldPersistTaps="always"
          />
        </View>

        <FeedCommentModal
          key={commentTargetPost?.postHash ?? "feed-comment-modal"}
          visible={Boolean(commentTargetPost)}
          post={commentTargetPost}
          onClose={closeCommentComposer}
          onSubmitted={handleCommentSubmitted}
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
