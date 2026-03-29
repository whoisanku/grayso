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
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { DeSoIdentityContext } from "react-deso-protocol";
import {
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { type NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ScreenWrapper from "@/components/ScreenWrapper";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Toast } from "@/components/ui/Toast";
import { FeedCommentModal } from "@/features/feed/components/FeedCommentModal";
import { FeedCard } from "@/features/feed/components/FeedCard";
import { FeedPostShimmer } from "@/features/feed/components/FeedPostShimmer";
import { FeedReactionModal } from "@/features/feed/components/FeedReactionModal";
import {
  FeedRepostActionModal,
  type FeedRepostActionAnchor,
} from "@/features/feed/components/FeedRepostActionModal";
import { feedKeys } from "@/features/feed/api/keys";
import { useSubmitRepost } from "@/features/feed/api/useSubmitRepost";
import { type FocusFeedPost } from "@/lib/focus/graphql";
import { getWebScrollbarStyle } from "@/lib/webScrollbar";
import { estimateFeedCardHeight } from "@/features/feed/lib/estimateFeedCardHeight";
import { useManualRefresh } from "@/hooks/useManualRefresh";
import { HomeTabParamList, RootStackParamList } from "@/navigation/types";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { FollowListModal } from "../components/FollowListModal";
import { ProfileHeader } from "../components/ProfileHeader";
import { ProfileShimmer } from "../components/ProfileShimmer";
import { ProfileStats } from "../components/ProfileStats";
import { useAccountProfile } from "../api/useAccountProfile";
import { useProfilePosts } from "../api/useProfilePosts";

type ProfileScreenRouteProp = RouteProp<HomeTabParamList, "Profile">;

const EMPTY_VISIBLE_HASHES = new Set<string>();
const MOBILE_PROFILE_BOTTOM_CLEARANCE = 96;

function resolveRepostTargetPostHash(post: FocusFeedPost): string {
  const rawPostBody = post.body?.trim() ?? "";
  const isPureRepost = Boolean(post.repostedPost?.postHash && !rawPostBody);

  return isPureRepost ? post.repostedPost?.postHash ?? post.postHash : post.postHash;
}

export function ProfileScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<ProfileScreenRouteProp>();
  const queryClient = useQueryClient();
  const { currentUser } = useContext(DeSoIdentityContext);
  const { isDark, accentColor } = useAccentColor();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [isModalVisible, setModalVisible] = useState(false);
  const [listTab, setListTab] = useState<"followers" | "following">("followers");
  const [commentTargetPost, setCommentTargetPost] =
    useState<FocusFeedPost | null>(null);
  const [quoteTargetPost, setQuoteTargetPost] =
    useState<FocusFeedPost | null>(null);
  const [reactionTargetPost, setReactionTargetPost] =
    useState<FocusFeedPost | null>(null);
  const [repostActionTarget, setRepostActionTarget] = useState<{
    post: FocusFeedPost;
    anchor: FeedRepostActionAnchor;
  } | null>(null);
  const [visiblePostHashes, setVisiblePostHashes] =
    useState<Set<string>>(EMPTY_VISIBLE_HASHES);
  const [viewabilityConfig] = useState(() => ({
    itemVisiblePercentThreshold: 60,
    waitForInteraction: false,
  }));

  const flashListRef = useRef<any>(null);

  const normalizedCurrentUserPublicKey =
    currentUser?.PublicKeyBase58Check?.trim() ?? "";
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;
  const scrollBarStyle = useMemo(
    () => getWebScrollbarStyle(isDark),
    [isDark],
  );

  const normalizedRouteUsername = route.params?.username?.trim() ?? "";
  const normalizedRoutePublicKey = route.params?.publicKey?.trim() ?? "";
  const hasExplicitRouteTarget = Boolean(
    normalizedRoutePublicKey || normalizedRouteUsername,
  );

  const profileParams = useMemo(() => {
    if (normalizedRoutePublicKey) {
      return { publicKey: normalizedRoutePublicKey };
    }

    if (normalizedRouteUsername) {
      return { username: normalizedRouteUsername };
    }

    return normalizedCurrentUserPublicKey
      ? { publicKey: normalizedCurrentUserPublicKey }
      : {};
  }, [
    normalizedCurrentUserPublicKey,
    normalizedRoutePublicKey,
    normalizedRouteUsername,
  ]);

  const {
    data: account,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAccountProfile(profileParams);

  const normalizedAccountPublicKey = account?.publicKey?.trim() ?? "";
  const normalizedAccountUsername = account?.username?.trim() ?? "";
  const activePublicKey =
    normalizedAccountPublicKey ||
    normalizedRoutePublicKey ||
    (!hasExplicitRouteTarget ? normalizedCurrentUserPublicKey : "");
  const activeUsername = normalizedAccountUsername || normalizedRouteUsername;
  const isOwnProfile = Boolean(normalizedCurrentUserPublicKey) && (
    activePublicKey
      ? activePublicKey === normalizedCurrentUserPublicKey
      : !hasExplicitRouteTarget
  );

  const {
    posts,
    isLoading: isPostsLoading,
    isFetchingNextPage,
    hasNextPage,
    error: postsError,
    reload: reloadPosts,
    loadMore,
  } = useProfilePosts({
    publicKey: activePublicKey || undefined,
    username: !activePublicKey ? activeUsername || undefined : undefined,
    readerPublicKey: normalizedCurrentUserPublicKey || undefined,
    enabled: Boolean(activePublicKey || activeUsername),
    pageSize: 15,
  });

  const { mutateAsync: submitRepostAsync, isPending: isSubmittingRepost } =
    useSubmitRepost();

  const followerCount = useMemo(
    () => account?.followerCounts?.totalFollowers ?? 0,
    [account?.followerCounts?.totalFollowers],
  );
  const followingCount = useMemo(
    () => account?.followingCounts?.totalFollowing ?? 0,
    [account?.followingCounts?.totalFollowing],
  );

  const activePublicKeyForModal = activePublicKey || undefined;
  const refreshSpinnerColor = isDark ? "#f8fafc" : "#0f172a";
  const canPullToRefresh = Platform.OS !== "web";

  const { isRefreshing: isManualRefreshing, onRefresh: handleRefresh } =
    useManualRefresh(async () => {
      await Promise.all([
        refetch(),
        activePublicKey || activeUsername ? reloadPosts() : Promise.resolve(),
      ]);
      flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });

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

  const handleFollowersPress = useCallback(() => {
    setListTab("followers");
    setModalVisible(true);
  }, []);

  const handleFollowingPress = useCallback(() => {
    setListTab("following");
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => setModalVisible(false), []);

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
    void reloadPosts();
  }, [reloadPosts]);

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

    if (!normalizedCurrentUserPublicKey) {
      Toast.show({
        type: "error",
        text1: "Login required",
        text2: "Sign in to repost posts.",
      });
      return;
    }

    try {
      await submitRepostAsync({
        updaterPublicKey: normalizedCurrentUserPublicKey,
        repostedPostHash: resolveRepostTargetPostHash(repostActionTarget.post),
      });

      closeRepostActionMenu();
      Toast.show({
        type: "success",
        text1: "Reposted",
        text2: "This post was shared to your feed.",
      });

      await Promise.resolve(reloadPosts());
    } catch (repostError) {
      Toast.show({
        type: "error",
        text1: "Failed to repost",
        text2:
          repostError instanceof Error && repostError.message
            ? repostError.message
            : "Please try again.",
      });
    }
  }, [
    closeRepostActionMenu,
    isSubmittingRepost,
    normalizedCurrentUserPublicKey,
    reloadPosts,
    repostActionTarget,
    submitRepostAsync,
  ]);

  const openPostThread = useCallback(
    (post: FocusFeedPost) => {
      if (!post.postHash) {
        return;
      }

      const targetAuthorPublicKey = post.poster?.publicKey?.trim() ?? "";
      const cachedFollowStatus =
        normalizedCurrentUserPublicKey && targetAuthorPublicKey
          ? queryClient.getQueryData<boolean>(
              feedKeys.followStatus(
                normalizedCurrentUserPublicKey,
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
    [navigation, normalizedCurrentUserPublicKey, queryClient],
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

      const isSameProfile =
        (normalizedPublicKey && normalizedPublicKey === activePublicKey) ||
        (!normalizedPublicKey &&
          normalizedUsername &&
          normalizedUsername.toLowerCase() === activeUsername.toLowerCase());

      if (isSameProfile) {
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
    [activePublicKey, activeUsername, navigation],
  );

  useEffect(() => {
    if (account?.username) {
      navigation.setOptions({
        title: `@${account.username}`,
      });
    } else if (normalizedRouteUsername) {
      navigation.setOptions({
        title: `@${normalizedRouteUsername}`,
      });
    }
  }, [account?.username, navigation, normalizedRouteUsername]);

  if (!profileParams.publicKey && !profileParams.username) {
    return (
      <ScreenWrapper
        backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
        edges={["top", "left", "right"]}
      >
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
            You are not signed in
          </Text>
          <Text className="text-center text-base text-slate-500 dark:text-slate-400">
            Sign in to view your profile, followers, and following lists.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  const profileBottomInset = isDesktopWeb
    ? 32
    : Math.max(insets.bottom, 15) + MOBILE_PROFILE_BOTTOM_CLEARANCE;
  const profileContentContainerStyle =
    posts.length === 0
      ? {
          flexGrow: 1 as const,
          paddingBottom: profileBottomInset,
        }
      : {
          paddingBottom: profileBottomInset,
        };

  const listHeader = (
    <View>
      {isLoading && !account ? (
        <ProfileShimmer />
      ) : error ? (
        <View className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/20">
          <Text className="mb-1 text-base font-semibold text-red-700 dark:text-red-300">
            Unable to load profile
          </Text>
          <Text className="mb-3 text-sm text-red-600 dark:text-red-200">
            {error.message || "Something went wrong."}
          </Text>
          <Pressable
            onPress={() => {
              void refetch();
              Toast.show({
                type: "info",
                text1: "Refreshing profile",
                text2: "Trying again...",
              });
            }}
          >
            <Text className="text-sm font-semibold text-blue-600 dark:text-blue-300">
              Tap to retry
            </Text>
          </Pressable>
        </View>
      ) : !account ? (
        <View className="mx-4 mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-800/60">
          <Text className="mb-1 text-base font-semibold text-slate-900 dark:text-white">
            Profile unavailable
          </Text>
          <Text className="text-sm text-slate-600 dark:text-slate-300">
            We could not find profile details for this account yet. Pull to
            refresh or try again later.
          </Text>
        </View>
      ) : (
        <>
          <ProfileHeader
            account={account}
            onAvatarPress={handleFollowersPress}
            showBackButton={!isOwnProfile}
            onBackPress={() => navigation.goBack()}
          />

          <View className="mb-4 mt-3 px-4">
            <ProfileStats
              followers={followerCount}
              following={followingCount}
              onFollowersPress={handleFollowersPress}
              onFollowingPress={handleFollowingPress}
            />
          </View>

          {isFetching && !isLoading ? (
            <View className="mb-3 mt-1 flex-row items-center gap-2 px-4">
              <ActivityIndicator
                size="small"
                color={isDark ? "#94a3b8" : "#475569"}
              />
              <Text className="text-sm text-slate-500 dark:text-slate-400">
                Updating...
              </Text>
            </View>
          ) : null}

          <View className="border-b border-slate-200/80 dark:border-slate-800/80" />
        </>
      )}
    </View>
  );

  const listEmptyState = (() => {
    if (posts.length > 0) {
      return null;
    }

    if (isPostsLoading) {
      return <FeedPostShimmer />;
    }

    if (postsError) {
      return (
        <View className="flex-1 items-center justify-center px-6 py-16">
          <Text className="text-base font-semibold text-red-600 dark:text-red-300">
            Unable to load posts
          </Text>
          <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
            {postsError}
          </Text>
          <Pressable
            onPress={() => void reloadPosts()}
            className="mt-4 rounded-full px-4 py-2"
            style={{ backgroundColor: accentColor }}
          >
            <Text className="text-sm font-semibold text-white">Retry</Text>
          </Pressable>
        </View>
      );
    }

    if (!account && (isLoading || error)) {
      return null;
    }

    return (
      <View className="flex-1 items-center justify-center px-6 py-16">
        <Text className="text-lg font-semibold text-slate-900 dark:text-white">
          No posts yet
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          {isOwnProfile
            ? "Your posts will appear here once you publish something."
            : "This account has not posted anything yet."}
        </Text>
      </View>
    );
  })();

  const listFooter = isFetchingNextPage ? (
    <View className="items-center py-5">
      <ActivityIndicator
        size="small"
        color={isDark ? "#e2e8f0" : accentColor}
      />
    </View>
  ) : null;
  const estimatedProfileItemSize = useMemo(() => {
    if (!posts.length) {
      return 420;
    }

    const sample = posts.slice(0, 12);
    const total = sample.reduce(
      (sum, post) => sum + estimateFeedCardHeight(post, width),
      0,
    );

    return Math.round(total / sample.length);
  }, [posts, width]);

  const renderProfilePostItem = useCallback(
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

  return (
    <ScreenWrapper
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
      edges={["top", "left", "right"]}
      keyboardAvoiding={false}
    >
      <PullToRefresh
        onRefresh={handleRefresh}
        isRefreshing={isManualRefreshing}
        enabled={Platform.OS === "web" && !isDesktopWeb}
      >
        <View className="flex-1">
          {Platform.OS === "web" ? (
            <FlatList
              ref={flashListRef}
              data={posts}
              style={scrollBarStyle}
              keyExtractor={(item) => item.postHash}
              renderItem={renderProfilePostItem}
              ListHeaderComponent={listHeader}
              ListEmptyComponent={listEmptyState}
              ListFooterComponent={listFooter}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  void loadMore();
                }
              }}
              onEndReachedThreshold={0.3}
              contentContainerStyle={profileContentContainerStyle}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={Platform.OS === "web"}
              removeClippedSubviews={false}
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              windowSize={7}
            />
          ) : (
            <FlashList
              ref={flashListRef}
              data={posts}
              estimatedItemSize={estimatedProfileItemSize}
              // @ts-ignore FlashList runtime supports per-item sizing; local types are stale.
              overrideItemLayout={(layout: { size?: number }, item: FocusFeedPost) => {
                layout.size = estimateFeedCardHeight(item, width);
              }}
              style={scrollBarStyle}
              keyExtractor={(item) => item.postHash}
              renderItem={renderProfilePostItem}
              ListHeaderComponent={listHeader}
              ListEmptyComponent={listEmptyState}
              ListFooterComponent={listFooter}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  void loadMore();
                }
              }}
              onEndReachedThreshold={0.3}
              contentContainerStyle={profileContentContainerStyle}
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
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </PullToRefresh>

      <FeedCommentModal
        key={commentTargetPost?.postHash ?? "profile-comment-modal"}
        visible={Boolean(commentTargetPost)}
        post={commentTargetPost}
        onClose={closeCommentComposer}
        onSubmitted={handleReplyOrQuoteSubmitted}
      />

      <FeedCommentModal
        key={quoteTargetPost?.postHash ?? "profile-quote-modal"}
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
        key={reactionTargetPost?.postHash ?? "profile-reaction-modal"}
        visible={Boolean(reactionTargetPost)}
        post={reactionTargetPost}
        onClose={closeReactionList}
      />

      <FollowListModal
        visible={isModalVisible}
        publicKey={activePublicKeyForModal || ""}
        initialTab={listTab}
        onClose={handleCloseModal}
      />
    </ScreenWrapper>
  );
}
