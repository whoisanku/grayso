import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Text,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UserAvatar } from "@/components/UserAvatar";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { FlashList } from "@shopify/flash-list";
import { useColorScheme } from "nativewind";
import { Feather } from "@expo/vector-icons";
import { type FocusAccount } from "@/lib/focus/graphql";
import { useFollowers } from "../api/useFollowers";
import { useFollowing } from "../api/useFollowing";
import { FALLBACK_PROFILE_IMAGE, formatPublicKey, getProfileImageUrl } from "@/utils/deso";
import { toPlatformSafeImageUrl } from "@/lib/mediaUrl";
import { DesktopLeftNav } from "@/features/messaging/components/desktop/DesktopLeftNav";
import { DesktopRightNav } from "@/features/messaging/components/desktop/DesktopRightNav";
import { CENTER_CONTENT_MAX_WIDTH, useLayoutBreakpoints } from "@/alf/breakpoints";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { RootStackParamList } from "@/navigation/types";

type FollowListModalProps = {
  visible: boolean;
  publicKey?: string;
  initialTab?: "followers" | "following";
  onClose: () => void;
};

const getExtraString = (
  extraData: Record<string, unknown> | null | undefined,
  key: string
) => {
  const value = extraData?.[key];
  return typeof value === "string" && value.trim().length ? value : undefined;
};

type AccountRowProps = {
  account: FocusAccount;
  onPress?: (account: FocusAccount) => void;
};

const AccountRow = React.memo(function AccountRow({ account, onPress }: AccountRowProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  
  const avatarUrl = useMemo(() => {
    const rawUrl =
      getExtraString(account.extraData as Record<string, unknown> | undefined, "LargeProfilePicURL") ||
      getExtraString(account.extraData as Record<string, unknown> | undefined, "NFTProfilePictureUrl") ||
      (account.publicKey ? getProfileImageUrl(account.publicKey) : FALLBACK_PROFILE_IMAGE);
    return toPlatformSafeImageUrl(rawUrl) ?? rawUrl;
  }, [account.extraData, account.publicKey]);

  const displayName =
    getExtraString(account.extraData as Record<string, unknown> | undefined, "DisplayName") ||
    account.username ||
    (account.publicKey ? formatPublicKey(account.publicKey) : "");

  const handlePress = useCallback(() => {
    onPress?.(account);
  }, [account, onPress]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      className="flex-row items-center gap-3 px-4 py-3"
    >
      <UserAvatar
        uri={avatarUrl}
        name={displayName || "?"}
        size={44}
        className="bg-slate-200 dark:bg-slate-700"
      />
      <View className="flex-1">
        <Text className="text-base font-semibold text-slate-900 dark:text-white" numberOfLines={1}>
          {displayName}
        </Text>
        {account.username ? (
          <Text className="text-sm text-slate-500 dark:text-slate-400" numberOfLines={1}>
            @{account.username}
          </Text>
        ) : null}
        {account.followerCounts?.totalFollowers !== undefined ? (
          <Text className="text-xs text-slate-400 dark:text-slate-500" numberOfLines={1}>
            {account.followerCounts.totalFollowers} followers
          </Text>
        ) : null}
      </View>
      {account.isVerified ? <Feather name="check-circle" size={18} color="#2563eb" /> : null}
    </TouchableOpacity>
  );
});

AccountRow.displayName = "AccountRow";

export function FollowListModal({ visible, publicKey, initialTab = "followers", onClose }: FollowListModalProps) {
  const { isDark, accentColor } = useAccentColor();
  const { isDesktop } = useLayoutBreakpoints();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<"followers" | "following">(initialTab);

  // Check if we're on web desktop to show sidebars
  const isWebDesktop = Platform.OS === 'web' && isDesktop;

  const handleAccountPress = useCallback((account: FocusAccount) => {
    // Close modal
    onClose();
    // Navigate to user profile
    navigation.navigate('Main', {
      screen: 'Profile',
      params: {
        username: account.username || undefined,
        publicKey: account.publicKey,
      }
    });
  }, [navigation, onClose]);

  useEffect(() => {
    if (visible) {
      setTab(initialTab);
    }
  }, [initialTab, visible]);

  const followersQuery = useFollowers({ publicKey, enabled: tab === "followers" && visible });
  const followingQuery = useFollowing({ publicKey, enabled: tab === "following" && visible });

  const activeQuery = tab === "followers" ? followersQuery : followingQuery;
  const data = tab === "followers" ? followersQuery.accounts : followingQuery.accounts;

  const handleEndReached = useCallback(() => {
    if (activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
      void activeQuery.fetchNextPage();
    }
  }, [activeQuery]);

  const renderAccountItem = useCallback(
    ({ item }: { item: FocusAccount }) => (
      <AccountRow account={item} onPress={handleAccountPress} />
    ),
    [handleAccountPress]
  );

  const renderFooter = () => {
    if (activeQuery.isFetchingNextPage) {
      return (
        <View className="items-center justify-center py-3">
          <ActivityIndicator size="small" color={accentColor} />
        </View>
      );
    }
    if (activeQuery.hasNextPage) {
      return (
        <TouchableOpacity
          onPress={() => activeQuery.fetchNextPage()}
          disabled={activeQuery.isFetchingNextPage}
          activeOpacity={0.8}
          className="py-3"
        >
          <Text className="text-center text-sm font-semibold" style={{ color: accentColor }}>
            Load more
          </Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const body = () => {
    if (activeQuery.isLoading) {
      return (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={accentColor} />
          <Text className="mt-2 text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
            Loading…
          </Text>
        </View>
      );
    }

    if (activeQuery.isError) {
      return (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-1 text-base font-semibold" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
            Unable to load
          </Text>
          <Text
            className="mb-3 text-center text-sm"
            style={{ color: isDark ? '#64748b' : '#94a3b8' }}
          >
            {(activeQuery.error as Error)?.message || "Something went wrong."}
          </Text>
          <TouchableOpacity
            onPress={() => activeQuery.refetch()}
            activeOpacity={0.8}
            className="rounded-full px-4 py-2"
            style={{ backgroundColor: accentColor }}
          >
            <Text className="font-semibold text-white">Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!data.length) {
      return (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-1 text-base font-semibold" style={{ color: isDark ? '#ffffff' : '#0f172a' }}>
            {tab === "followers" ? "No followers yet" : "Not following anyone"}
          </Text>
          <Text className="text-center text-sm" style={{ color: isDark ? '#64748b' : '#94a3b8' }}>
            {tab === "followers"
              ? "Followers will appear here once people start following this account."
              : "Accounts you follow will show up here."}
          </Text>
        </View>
      );
    }

      return (
      <FlashList
        data={data}
        keyExtractor={(item) => item.publicKey}
        renderItem={renderAccountItem}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-4"
      />
    );
  };

  // Main content that's shared between mobile and desktop
  const renderContent = () => (
    <>
      {/* Header */}
      <View
        className="flex-row items-center justify-between border-b px-5 py-4"
        style={{
          borderBottomColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
        }}
      >
        {/* Tab Switcher */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setTab("followers")}
            activeOpacity={0.8}
            className="rounded-full px-3 py-2"
            style={{
              backgroundColor: tab === "followers"
                ? accentColor
                : (isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 1)'),
            }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: tab === "followers" ? '#ffffff' : (isDark ? '#e2e8f0' : '#334155') }}
            >
              Followers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("following")}
            activeOpacity={0.8}
            className="rounded-full px-3 py-2"
            style={{
              backgroundColor: tab === "following"
                ? accentColor
                : (isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(241, 245, 249, 1)'),
            }}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: tab === "following" ? '#ffffff' : (isDark ? '#e2e8f0' : '#334155') }}
            >
              Following
            </Text>
          </TouchableOpacity>
        </View>

        {/* Close Button */}
        <TouchableOpacity
          onPress={onClose}
          activeOpacity={0.7}
          className="h-9 w-9 items-center justify-center rounded-full"
          style={{
            backgroundColor: isDark ? 'rgba(51, 65, 85, 0.6)' : 'rgba(241, 245, 249, 1)',
          }}
        >
          <Feather name="x" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View className="flex-1">
        {body()}
      </View>
    </>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType={isWebDesktop ? "fade" : "slide"}
      presentationStyle={isWebDesktop ? "overFullScreen" : "pageSheet"}
      transparent={isWebDesktop}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {isWebDesktop ? (
          // Desktop: Show with sidebars visible
          <View
            className="flex-1"
            style={{ backgroundColor: isDark ? 'rgba(10, 15, 26, 0.85)' : 'rgba(255, 255, 255, 0.85)' }}
          >
            {/* Left sidebar */}
            <DesktopLeftNav />

            {/* Center content area */}
            <View className="flex-1 items-center">
              <View
                className="flex-1 w-full"
                style={{
                  maxWidth: CENTER_CONTENT_MAX_WIDTH,
                  backgroundColor: isDark ? '#0a0f1a' : '#ffffff',
                  borderLeftWidth: 1,
                  borderRightWidth: 1,
                  borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.25)',
                }}
              >
                {renderContent()}
              </View>
            </View>

            {/* Right sidebar */}
            <DesktopRightNav />
          </View>
        ) : (
          // Mobile: Standard page sheet
          <SafeAreaView
            className="flex-1"
            style={{ backgroundColor: isDark ? '#0a0f1a' : '#ffffff' }}
          >
            {renderContent()}
          </SafeAreaView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}
