import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { Feather } from "@expo/vector-icons";

import { UserAvatar } from "@/components/UserAvatar";
import { Shimmer } from "@/components/ui/Shimmer";
import { type FocusAccount } from "@/lib/focus/graphql";
import { toPlatformSafeImageUrl } from "@/lib/mediaUrl";
import { RootStackParamList } from "@/navigation/types";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { getBorderColor } from "@/theme/borders";
import {
  FALLBACK_PROFILE_IMAGE,
  formatPublicKey,
  getProfileImageUrl,
} from "@/utils/deso";
import { useFollowers } from "../api/useFollowers";
import { useFollowing } from "../api/useFollowing";

type FollowListModalProps = {
  visible: boolean;
  publicKey?: string;
  initialTab?: "followers" | "following";
  onClose: () => void;
};

type AccountRowProps = {
  account: FocusAccount;
  isLast: boolean;
  isDark: boolean;
  onPress?: (account: FocusAccount) => void;
};

type FollowRowsShimmerProps = {
  isDark: boolean;
};

const SHIMMER_ROW_COUNT = 7;
const ESTIMATED_ROW_SIZE = 74;

const getExtraString = (
  extraData: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = extraData?.[key];
  return typeof value === "string" && value.trim().length ? value : undefined;
};

function FollowRowsShimmer({ isDark }: FollowRowsShimmerProps) {
  const subtleBorderColor = getBorderColor(isDark, "subtle");

  return (
    <View className="flex-1">
      {Array.from({ length: SHIMMER_ROW_COUNT }).map((_, index) => {
        const isLast = index === SHIMMER_ROW_COUNT - 1;

        return (
          <View
            key={`follow-shimmer-${index}`}
            className="flex-row items-center px-4 py-3"
            style={{
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: subtleBorderColor,
            }}
          >
            <Shimmer width={44} height={44} borderRadius={22} />

            <View className="ml-3 min-w-0 flex-1">
              <Shimmer
                width={index % 2 === 0 ? "52%" : "66%"}
                height={13}
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
          </View>
        );
      })}
    </View>
  );
}

const AccountRow = React.memo(function AccountRow({
  account,
  isLast,
  isDark,
  onPress,
}: AccountRowProps) {
  const avatarUrl = useMemo(() => {
    const rawUrl =
      getExtraString(
        account.extraData as Record<string, unknown> | undefined,
        "LargeProfilePicURL",
      ) ||
      getExtraString(
        account.extraData as Record<string, unknown> | undefined,
        "NFTProfilePictureUrl",
      ) ||
      (account.publicKey
        ? getProfileImageUrl(account.publicKey)
        : FALLBACK_PROFILE_IMAGE);

    return toPlatformSafeImageUrl(rawUrl) ?? rawUrl;
  }, [account.extraData, account.publicKey]);

  const displayName =
    getExtraString(
      account.extraData as Record<string, unknown> | undefined,
      "DisplayName",
    ) ||
    account.username ||
    (account.publicKey ? formatPublicKey(account.publicKey) : "");

  const handlePress = useCallback(() => {
    onPress?.(account);
  }, [account, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center gap-3 px-4 py-3"
      style={({ pressed }) => ({
        opacity: pressed ? 0.86 : 1,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: getBorderColor(isDark, "subtle"),
      })}
    >
      <UserAvatar
        uri={avatarUrl}
        name={displayName || "?"}
        size={44}
        className="bg-slate-200 dark:bg-slate-700"
      />

      <View className="min-w-0 flex-1">
        <Text
          className="text-base font-semibold text-slate-900 dark:text-white"
          numberOfLines={1}
        >
          {displayName}
        </Text>
        {account.username ? (
          <Text
            className="text-sm text-slate-500 dark:text-slate-400"
            numberOfLines={1}
          >
            @{account.username}
          </Text>
        ) : null}
      </View>

      {account.isVerified ? (
        <Feather name="check-circle" size={18} color="#2563eb" />
      ) : null}
    </Pressable>
  );
});

AccountRow.displayName = "AccountRow";

export function FollowListModal({
  visible,
  publicKey,
  initialTab = "followers",
  onClose,
}: FollowListModalProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { isDark, accentColor } = useAccentColor();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [manualTab, setManualTab] = useState<"followers" | "following" | null>(
    null,
  );
  const tab = manualTab ?? initialTab;

  const isDesktopWeb = Platform.OS === "web" && windowWidth >= 1024;
  const desktopModalHeight = Math.max(460, Math.min(620, windowHeight * 0.72));

  const handleClose = useCallback(() => {
    setManualTab(null);
    onClose();
  }, [onClose]);

  const followersQuery = useFollowers({
    publicKey,
    enabled: tab === "followers" && visible,
  });
  const followingQuery = useFollowing({
    publicKey,
    enabled: tab === "following" && visible,
  });

  const activeQuery = tab === "followers" ? followersQuery : followingQuery;
  const accounts =
    tab === "followers" ? followersQuery.accounts : followingQuery.accounts;

  const {
    hasNextPage,
    isLoading,
    isFetching,
    isError,
    error,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = activeQuery;

  const isInitialLoading = accounts.length === 0 && (isLoading || isFetching);

  const handleAccountPress = useCallback(
    (account: FocusAccount) => {
      handleClose();
      navigation.navigate("Main", {
        screen: "Profile",
        params: {
          username: account.username || undefined,
          publicKey: account.publicKey,
        },
      });
    },
    [handleClose, navigation],
  );

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const renderAccountItem = useCallback(
    ({ item, index }: { item: FocusAccount; index: number }) => (
      <AccountRow
        account={item}
        isDark={isDark}
        isLast={index === accounts.length - 1}
        onPress={handleAccountPress}
      />
    ),
    [accounts.length, handleAccountPress, isDark],
  );

  const renderFooter = useCallback(() => {
    if (isFetchingNextPage) {
      return (
        <View
          className="items-center py-3"
          style={{
            borderTopWidth: 1,
            borderTopColor: getBorderColor(isDark, "subtle"),
          }}
        >
          <ActivityIndicator size="small" color={accentColor} />
        </View>
      );
    }

    if (hasNextPage) {
      return (
        <Pressable
          onPress={() => void fetchNextPage()}
          className="items-center py-3"
          style={({ pressed }) => ({
            opacity: pressed ? 0.72 : 1,
            borderTopWidth: 1,
            borderTopColor: getBorderColor(isDark, "subtle"),
          })}
        >
          <Text className="text-[13px] font-semibold" style={{ color: accentColor }}>
            Load more
          </Text>
        </Pressable>
      );
    }

    return null;
  }, [accentColor, fetchNextPage, hasNextPage, isDark, isFetchingNextPage]);

  const modalTitle = tab === "followers" ? "Followers" : "Following";

  const modalContent = (
    <View className="flex-1">
      <View
        className="flex-row items-center px-4 py-3"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: getBorderColor(isDark, "subtle"),
        }}
      >
        <View className="min-w-0 flex-1 flex-row items-center gap-2 pr-3">
          <Pressable
            onPress={() => setManualTab("followers")}
            className="rounded-full border px-3 py-1.5"
            style={{
              borderColor:
                tab === "followers"
                  ? accentColor
                  : getBorderColor(isDark, "input"),
              backgroundColor:
                tab === "followers"
                  ? accentColor
                  : isDark
                    ? "rgba(15, 23, 42, 0.6)"
                    : "rgba(248, 250, 252, 1)",
            }}
            accessibilityRole="button"
            accessibilityLabel="Show followers"
          >
            <Text
              className="text-[13px] font-medium"
              style={{
                color:
                  tab === "followers"
                    ? "#ffffff"
                    : isDark
                      ? "#cbd5e1"
                      : "#334155",
              }}
            >
              Followers
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setManualTab("following")}
            className="rounded-full border px-3 py-1.5"
            style={{
              borderColor:
                tab === "following"
                  ? accentColor
                  : getBorderColor(isDark, "input"),
              backgroundColor:
                tab === "following"
                  ? accentColor
                  : isDark
                    ? "rgba(15, 23, 42, 0.6)"
                    : "rgba(248, 250, 252, 1)",
            }}
            accessibilityRole="button"
            accessibilityLabel="Show following"
          >
            <Text
              className="text-[13px] font-medium"
              style={{
                color:
                  tab === "following"
                    ? "#ffffff"
                    : isDark
                      ? "#cbd5e1"
                      : "#334155",
              }}
            >
              Following
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleClose}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{
            backgroundColor: isDark
              ? "rgba(30, 41, 59, 0.8)"
              : "rgba(241, 245, 249, 1)",
          }}
          accessibilityRole="button"
          accessibilityLabel={`Close ${modalTitle}`}
        >
          <Feather name="x" size={18} color={isDark ? "#cbd5e1" : "#475569"} />
        </Pressable>
      </View>

      {isInitialLoading ? (
        <FollowRowsShimmer isDark={isDark} />
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className="text-center text-[15px] font-semibold"
            style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
          >
            Couldn't load {tab}
          </Text>
          <Text
            className="mt-1.5 text-center text-[13px]"
            style={{ color: isDark ? "#94a3b8" : "#64748b" }}
          >
            {(error as Error)?.message || "Please try again."}
          </Text>
          <Pressable
            onPress={() => void refetch()}
            className="mt-4 rounded-full px-4 py-2"
            style={{ backgroundColor: accentColor }}
            accessibilityRole="button"
            accessibilityLabel={`Retry loading ${tab}`}
          >
            <Text className="text-[13px] font-semibold text-white">Retry</Text>
          </Pressable>
        </View>
      ) : accounts.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className="text-center text-[15px] font-semibold"
            style={{ color: isDark ? "#f8fafc" : "#0f172a" }}
          >
            {tab === "followers" ? "No followers yet" : "Not following anyone"}
          </Text>
          <Text
            className="mt-1.5 text-center text-[13px]"
            style={{ color: isDark ? "#94a3b8" : "#64748b" }}
          >
            {tab === "followers"
              ? "Followers will appear here once people start following this account."
              : "Accounts you follow will show up here."}
          </Text>
        </View>
      ) : (
        <FlashList
          data={accounts}
          renderItem={renderAccountItem}
          keyExtractor={(item, index) => item.publicKey?.trim() || `${tab}-${index}`}
          estimatedItemSize={ESTIMATED_ROW_SIZE}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={Platform.OS === "web"}
        />
      )}
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
      onRequestClose={handleClose}
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
              onPress={handleClose}
              style={{
                backgroundColor: isDark
                  ? "rgba(2, 6, 23, 0.72)"
                  : "rgba(15, 23, 42, 0.35)",
              }}
              accessibilityRole="button"
              accessibilityLabel={`Close ${modalTitle}`}
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
            style={{ backgroundColor: isDark ? "#0b1629" : "#ffffff" }}
          >
            {modalContent}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
