import React, { useContext, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { UserAvatar } from "@/components/UserAvatar";
import { Shimmer } from "@/components/ui/Shimmer";
import { Toast } from "@/components/ui/Toast";
import { feedKeys } from "@/features/feed/api/keys";
import {
  useIsFollowingAccount,
  useToggleFollowingAccount,
} from "@/features/feed/api/useFollowAccount";
import {
  type PostReactionItem,
  usePostReactions,
} from "@/features/feed/api/usePostReactions";
import {
  FOCUS_POST_REACTION_OPTIONS,
  type FocusPostReactionValue,
} from "@/features/feed/api/usePostReactionAssociation";
import { type FocusFeedPost } from "@/lib/focus/graphql";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { getBorderColor } from "@/theme/borders";

type FeedReactionModalProps = {
  visible: boolean;
  post: FocusFeedPost | null;
  onClose: () => void;
};

type ReactionFilter = FocusPostReactionValue | "ALL";

type ReactionListRowProps = {
  reaction: PostReactionItem;
  reactionEmoji: string;
  isLast: boolean;
  isDark: boolean;
  accentColor: string;
  readerPublicKey: string | null;
};

type ReactionRowsShimmerProps = {
  isDark: boolean;
};

const SHIMMER_ROW_COUNT = 7;

function createEmptyReactionCounts(): Record<FocusPostReactionValue, number> {
  return {
    LIKE: 0,
    DISLIKE: 0,
    LOVE: 0,
    LAUGH: 0,
    SAD: 0,
    CRY: 0,
    ANGRY: 0,
  };
}

function ReactionRowsShimmer({ isDark }: ReactionRowsShimmerProps) {
  const subtleBorderColor = getBorderColor(isDark, "subtle");

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={Platform.OS === "web"}
    >
      {Array.from({ length: SHIMMER_ROW_COUNT }).map((_, index) => {
        const isLast = index === SHIMMER_ROW_COUNT - 1;

        return (
          <View
            key={`reaction-shimmer-${index}`}
            className="flex-row items-center px-4 py-3"
            style={{
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: subtleBorderColor,
            }}
          >
            <Shimmer width={38} height={38} borderRadius={19} />

            <View className="ml-3 min-w-0 flex-1">
              <Shimmer
                width={index % 2 === 0 ? "58%" : "66%"}
                height={12}
                borderRadius={999}
              />
              <View className="mt-2">
                <Shimmer
                  width={index % 3 === 0 ? "41%" : "34%"}
                  height={11}
                  borderRadius={999}
                />
              </View>
            </View>

            <View className="ml-3">
              <Shimmer width={76} height={28} borderRadius={999} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function ReactionListRow({
  reaction,
  reactionEmoji,
  isLast,
  isDark,
  accentColor,
  readerPublicKey,
}: ReactionListRowProps) {
  const queryClient = useQueryClient();
  const [optimisticIsFollowing, setOptimisticIsFollowing] = useState<
    boolean | null
  >(null);
  const { mutateAsync: toggleFollowingAsync, isPending } =
    useToggleFollowingAccount();

  const normalizedReaderPublicKey = readerPublicKey?.trim() ?? "";
  const isOwnRow =
    Boolean(normalizedReaderPublicKey) &&
    normalizedReaderPublicKey === reaction.publicKey;
  const showFollowButton = Boolean(normalizedReaderPublicKey) && !isOwnRow;

  const { isFollowing } = useIsFollowingAccount({
    readerPublicKey: normalizedReaderPublicKey,
    targetPublicKey: reaction.publicKey,
    enabled: showFollowButton,
  });

  const effectiveIsFollowing = optimisticIsFollowing ?? isFollowing;

  const handleToggleFollow = async () => {
    if (!showFollowButton || isPending || !normalizedReaderPublicKey) {
      return;
    }

    const shouldFollow = !effectiveIsFollowing;
    setOptimisticIsFollowing(shouldFollow);

    try {
      await toggleFollowingAsync({
        readerPublicKey: normalizedReaderPublicKey,
        targetPublicKey: reaction.publicKey,
        shouldFollow,
      });

      queryClient.setQueryData(
        feedKeys.followStatus(normalizedReaderPublicKey, reaction.publicKey),
        shouldFollow,
      );
    } catch (error) {
      Toast.show({
        type: "error",
        text1: shouldFollow ? "Unable to follow" : "Unable to unfollow",
        text2:
          error instanceof Error && error.message
            ? error.message
            : "Please try again.",
      });
    } finally {
      setOptimisticIsFollowing(null);
    }
  };

  return (
    <View
      className="flex-row items-center px-4 py-3"
      style={{
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: getBorderColor(isDark, "subtle"),
      }}
    >
      <View className="relative">
        <UserAvatar uri={reaction.avatarUri} name={reaction.displayName} size={38} />
        <View
          className="absolute -bottom-1 -right-1 h-[16px] w-[16px] items-center justify-center rounded-full border"
          style={{
            borderColor: isDark ? "#0b1629" : "#ffffff",
            backgroundColor: isDark ? "rgba(2, 6, 23, 0.9)" : "#ffffff",
          }}
        >
          <Text className="text-[10px] leading-[12px]">{reactionEmoji}</Text>
        </View>
      </View>

      <View className="ml-3 min-w-0 flex-1">
        <Text
          numberOfLines={1}
          className="text-[15px] font-semibold"
          style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
        >
          {reaction.displayName}
        </Text>
        <Text
          numberOfLines={1}
          className="mt-0.5 text-[13px]"
          style={{ color: isDark ? "#94a3b8" : "#64748b" }}
        >
          @{reaction.username}
        </Text>
      </View>

      {showFollowButton ? (
        <Pressable
          onPress={() => void handleToggleFollow()}
          disabled={isPending}
          className="ml-3 h-7 min-w-[76px] items-center justify-center rounded-full px-3"
          style={{
            backgroundColor: effectiveIsFollowing
              ? isDark
                ? "rgba(30, 41, 59, 0.9)"
                : "rgba(226, 232, 240, 0.95)"
              : accentColor,
            borderWidth: effectiveIsFollowing ? 1 : 0,
            borderColor: effectiveIsFollowing
              ? getBorderColor(isDark, "input")
              : "transparent",
            opacity: isPending ? 0.75 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel={
            effectiveIsFollowing
              ? `Unfollow ${reaction.displayName}`
              : `Follow ${reaction.displayName}`
          }
        >
          {isPending ? (
            <ActivityIndicator
              size="small"
              color={effectiveIsFollowing ? (isDark ? "#e2e8f0" : "#334155") : "#ffffff"}
            />
          ) : (
            <Text
              className="text-[12px] font-semibold"
              style={{
                color: effectiveIsFollowing
                  ? isDark
                    ? "#e2e8f0"
                    : "#334155"
                  : "#ffffff",
              }}
            >
              {effectiveIsFollowing ? "Following" : "Follow"}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function FeedReactionModal({ visible, post, onClose }: FeedReactionModalProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { currentUser } = useContext(DeSoIdentityContext);
  const { isDark, accentColor } = useAccentColor();
  const [activeFilter, setActiveFilter] = useState<ReactionFilter>("ALL");

  const isDesktopWeb = Platform.OS === "web" && windowWidth >= 1024;
  const desktopModalHeight = Math.max(460, Math.min(620, windowHeight * 0.72));
  const readerPublicKey = currentUser?.PublicKeyBase58Check?.trim() ?? null;

  const {
    reactions,
    totalCount,
    isLoading,
    isFetching,
    error,
    refetch,
  } = usePostReactions({
    postHash: post?.postHash,
    enabled: visible && Boolean(post?.postHash),
    limit: 200,
  });

  const reactionCounts = useMemo(() => {
    const counts = createEmptyReactionCounts();

    for (const reaction of reactions) {
      counts[reaction.reactionValue] += 1;
    }

    return counts;
  }, [reactions]);

  const effectiveFilter: ReactionFilter =
    activeFilter === "ALL" || reactionCounts[activeFilter] > 0
      ? activeFilter
      : "ALL";

  const filterItems = useMemo(
    () => [
      {
        value: "ALL" as const,
        emoji: null,
        label: "All",
        count: Math.max(totalCount, reactions.length),
      },
      ...FOCUS_POST_REACTION_OPTIONS.map((option) => ({
        value: option.value,
        emoji: option.emoji,
        label: option.label,
        count: reactionCounts[option.value],
      })).filter((option) => option.count > 0),
    ],
    [reactionCounts, reactions.length, totalCount],
  );

  const reactionOptionByValue = useMemo(
    () =>
      new Map(
        FOCUS_POST_REACTION_OPTIONS.map((option) => [option.value, option] as const),
      ),
    [],
  );

  const filteredReactions = useMemo(() => {
    if (effectiveFilter === "ALL") {
      return reactions;
    }

    return reactions.filter(
      (reaction) => reaction.reactionValue === effectiveFilter,
    );
  }, [effectiveFilter, reactions]);

  const isInitialLoading = reactions.length === 0 && (isLoading || isFetching);

  const modalContent = (
    <View className="flex-1">
      <View
        className="flex-row items-center px-4 py-3"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: getBorderColor(isDark, "subtle"),
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="min-w-0 flex-1 pr-3"
          contentContainerStyle={{ alignItems: "center", columnGap: 8, paddingRight: 8 }}
        >
          {filterItems.map((item) => {
            const isActive = effectiveFilter === item.value;
            return (
              <Pressable
                key={item.value}
                onPress={() => setActiveFilter(item.value)}
                className="flex-row items-center gap-1 rounded-full border px-3 py-1.5"
                style={{
                  alignSelf: "flex-start",
                borderColor: isActive ? accentColor : getBorderColor(isDark, "input"),
                backgroundColor: isActive
                    ? accentColor
                    : isDark
                      ? "rgba(15, 23, 42, 0.6)"
                      : "rgba(248, 250, 252, 1)",
                }}
                accessibilityRole="button"
                accessibilityLabel={`Show ${item.label} reactions`}
              >
                {item.emoji ? (
                  <Text className="text-[15px] leading-[18px]">{item.emoji}</Text>
                ) : null}
                <Text
                  className="text-[13px] font-medium"
                  style={{ color: isActive ? "#ffffff" : isDark ? "#cbd5e1" : "#334155" }}
                >
                  {item.label}
                </Text>
                <Text
                  className="text-[12px]"
                  style={{
                    color: isActive
                      ? "rgba(255,255,255,0.85)"
                      : isDark
                        ? "#94a3b8"
                        : "#64748b",
                  }}
                >
                  {item.count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={onClose}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{
            backgroundColor: isDark
              ? "rgba(30, 41, 59, 0.8)"
              : "rgba(241, 245, 249, 1)",
          }}
          accessibilityRole="button"
          accessibilityLabel="Close reactions"
        >
          <Feather name="x" size={18} color={isDark ? "#cbd5e1" : "#475569"} />
        </Pressable>
      </View>

      {isInitialLoading ? (
        <ReactionRowsShimmer isDark={isDark} />
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className="text-center text-[15px] font-semibold"
            style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
          >
            Couldn't load reactions
          </Text>
          <Text
            className="mt-1.5 text-center text-[13px]"
            style={{ color: isDark ? "#94a3b8" : "#64748b" }}
          >
            {error}
          </Text>
          <Pressable
            onPress={() => void refetch()}
            className="mt-4 rounded-full px-4 py-2"
            style={{ backgroundColor: accentColor }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading reactions"
          >
            <Text className="text-[13px] font-semibold text-white">Retry</Text>
          </Pressable>
        </View>
      ) : filteredReactions.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className="text-center text-[15px] font-semibold"
            style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
          >
            No reactions yet
          </Text>
          <Text
            className="mt-1.5 text-center text-[13px]"
            style={{ color: isDark ? "#94a3b8" : "#64748b" }}
          >
            Be the first to react to this post.
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={Platform.OS === "web"}
        >
          {filteredReactions.map((reaction, index) => {
            const reactionOption = reactionOptionByValue.get(reaction.reactionValue);

            return (
              <ReactionListRow
                key={reaction.associationId}
                reaction={reaction}
                reactionEmoji={reactionOption?.emoji ?? "👍"}
                isLast={index === filteredReactions.length - 1}
                isDark={isDark}
                accentColor={accentColor}
                readerPublicKey={readerPublicKey}
              />
            );
          })}
        </ScrollView>
      )}

      {isFetching && !isLoading ? (
        <View
          className="items-center py-2"
          style={{
            borderTopWidth: 1,
            borderTopColor: getBorderColor(isDark, "subtle"),
          }}
        >
          <ActivityIndicator size="small" color={accentColor} />
        </View>
      ) : null}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={isDesktopWeb}
      animationType="fade"
      presentationStyle={
        isDesktopWeb
          ? "overFullScreen"
          : Platform.OS === "ios"
            ? "fullScreen"
            : "overFullScreen"
      }
      statusBarTranslucent={Platform.OS === "android"}
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={isDesktopWeb ? [] : ["top", "bottom"]}
        className="flex-1"
        style={{
          backgroundColor: isDesktopWeb
            ? "transparent"
            : isDark
              ? "#0b1629"
              : "#ffffff",
        }}
      >
        {isDesktopWeb ? (
          <View
            className="flex-1 items-center justify-center px-6 py-8"
            pointerEvents="box-none"
          >
            <Pressable
              className="absolute inset-0"
              onPress={onClose}
              style={{
                backgroundColor: isDark
                  ? "rgba(2, 6, 23, 0.72)"
                  : "rgba(15, 23, 42, 0.35)",
              }}
              accessibilityRole="button"
              accessibilityLabel="Close reactions"
            />

            <View
              className="w-full overflow-hidden rounded-3xl border"
              style={{
                maxWidth: 640,
                height: desktopModalHeight,
                backgroundColor: isDark ? "#0b1629" : "#ffffff",
                borderColor: getBorderColor(isDark, "contrast_low"),
              }}
            >
              {modalContent}
            </View>
          </View>
        ) : (
          <View
            className="flex-1"
            style={{
              backgroundColor: isDark ? "#0b1629" : "#ffffff",
            }}
          >
            {modalContent}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
