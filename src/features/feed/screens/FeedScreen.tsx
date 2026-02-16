import React, { useCallback, useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { FeedCard } from "@/features/feed/components/FeedCard";
import { type FocusFeedPost } from "@/lib/focus/graphql";
import { useSetDrawerOpen } from "@/state/shell";
import { PageTopBar, PageTopBarIconButton } from "@/components/ui/PageTopBar";

const EMPTY_VISIBLE_HASHES = new Set<string>();

export function FeedScreen() {
  const { currentUser } = useContext(DeSoIdentityContext);
  const { isDark, accentColor } = useAccentColor();
  const { width: windowWidth } = useWindowDimensions();
  const setDrawerOpen = useSetDrawerOpen();

  const userPublicKey = currentUser?.PublicKeyBase58Check;
  const isDesktopWeb = Platform.OS === "web" && windowWidth >= 1024;

  const {
    posts,
    isLoading,
    isRefreshing,
    isFetchingNextPage,
    hasNextPage,
    error,
    reload,
    loadMore,
  } = useFollowFeedTimeline({
    followerPublicKey: userPublicKey,
    enabled: true,
    pageSize: 20,
  });

  const [visiblePostHashes, setVisiblePostHashes] =
    useState<Set<string>>(EMPTY_VISIBLE_HASHES);
  const [viewabilityConfig] = useState(() => ({
    itemVisiblePercentThreshold: 60,
    waitForInteraction: false,
  }));

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
  const openDrawer = useCallback(() => setDrawerOpen(true), [setDrawerOpen]);

  const listEmptyState = useMemo(() => {
    if (isLoading) {
      return <FeedPostShimmer />;
    }

    if (!userPublicKey) {
      return (
        <View className="flex-1 items-center justify-center px-6 py-20">
          <Text className="text-lg font-semibold text-slate-900 dark:text-white">
            Sign in to view your feed
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
            Your timeline will appear here after login.
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
          Follow more creators to populate your timeline.
        </Text>
      </View>
    );
  }, [accentColor, error, isLoading, reload, userPublicKey]);

  return (
    <ScreenWrapper
      edges={["top", "left", "right"]}
      keyboardAvoiding={false}
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
    >
      <View className="flex-1">
        <PageTopBar
          title="Feed"
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
              Platform.OS !== "web" ? (
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => void reload()}
                  tintColor={accentColor}
                  colors={[accentColor]}
                />
              ) : undefined
            }
            showsVerticalScrollIndicator={Platform.OS === "web"}
            keyboardShouldPersistTaps="always"
          />
        </View>
      </View>
    </ScreenWrapper>
  );
}
