import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useColorScheme } from "nativewind";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/types";
import ScreenWrapper from "@/components/ScreenWrapper";
import { ProfileHeader } from "../components/ProfileHeader";
import { ProfileStats } from "../components/ProfileStats";
import { useAccountProfile } from "../api/useAccountProfile";
import { Toast } from "@/components/ui/Toast";
import { FollowListModal } from "../components/FollowListModal";
import { DesktopLeftNav } from "@/features/messaging/components/desktop/DesktopLeftNav";
import { DesktopRightNav } from "@/features/messaging/components/desktop/DesktopRightNav";
import {
  CENTER_CONTENT_MAX_WIDTH,
  useLayoutBreakpoints,
} from "@/alf/breakpoints";
import { MobileNav } from "@/navigation/MobileNav";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<RootStackParamList, "UserProfile">;

export function UserProfileScreen({ route, navigation }: Props) {
  const { username, publicKey: routePublicKey } = route.params || {};
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { isDesktop } = useLayoutBreakpoints();
  const isWebDesktop = Platform.OS === "web" && isDesktop;
  const insets = useSafeAreaInsets();

  const [isModalVisible, setModalVisible] = useState(false);
  const [listTab, setListTab] = useState<"followers" | "following">(
    "followers"
  );

  // Use publicKey from route params directly
  const publicKey = routePublicKey;

  const {
    data: account,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useAccountProfile(publicKey);

  const followerCount = useMemo(
    () => account?.followerCounts?.totalFollowers ?? 0,
    [account?.followerCounts?.totalFollowers]
  );
  const followingCount = useMemo(
    () => account?.followingCounts?.totalFollowing ?? 0,
    [account?.followingCounts?.totalFollowing]
  );

  const handleFollowersPress = () => {
    setListTab("followers");
    setModalVisible(true);
  };

  const handleFollowingPress = () => {
    setListTab("following");
    setModalVisible(true);
  };

  const handleCloseModal = useCallback(() => setModalVisible(false), []);

  // Set header title to username
  React.useEffect(() => {
    if (account?.username) {
      navigation.setOptions({
        title: `@${account.username}`,
      });
    } else if (username) {
      navigation.setOptions({
        title: `@${username}`,
      });
    }
  }, [account?.username, username, navigation]);

  return (
    <>
      {isWebDesktop ? (
        <View
          style={{ flex: 1, backgroundColor: isDark ? "#0a0f1a" : "#ffffff" }}
        >
          <DesktopLeftNav />
          <View style={{ flex: 1, alignItems: "center" }}>
            <View
              style={{
                flex: 1,
                width: "100%",
                maxWidth: CENTER_CONTENT_MAX_WIDTH,
                backgroundColor: isDark ? "#0a0f1a" : "#ffffff",
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: isDark
                  ? "rgba(148, 163, 184, 0.15)"
                  : "rgba(148, 163, 184, 0.25)",
              }}
            >
              {renderContent()}
            </View>
          </View>
          <DesktopRightNav />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScreenWrapper
            backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
            edges={["top", "left", "right"]}
          >
            {renderContent()}
          </ScreenWrapper>
          {/* Mobile bottom navigation (matches home tabs) */}
          <MobileNav activeTab="Profile" />
        </View>
      )}

      <FollowListModal
        visible={isModalVisible}
        publicKey={publicKey}
        initialTab={listTab}
        onClose={handleCloseModal}
      />
    </>
  );

  function renderContent() {
    if (!publicKey && !username) {
      return (
        <View style={{ flex: 1 }} className="items-center justify-center px-6">
          <Text className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
            Profile not found
          </Text>
          <Text className="text-base text-center text-slate-500 dark:text-slate-400">
            Unable to load this profile. The username or public key may be
            invalid.
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 32 + 70 + Math.max(insets.bottom, 15),
        }}
        refreshControl={
          Platform.OS !== "web" ? (
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={isDark ? "#94a3b8" : "#475569"}
              colors={[isDark ? "#60a5fa" : "#3b82f6"]}
            />
          ) : undefined
        }
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-16 px-4">
            <ActivityIndicator
              size="small"
              color={isDark ? "#60a5fa" : "#3b82f6"}
            />
            <Text className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Loading profile…
            </Text>
          </View>
        ) : error ? (
          <View className="rounded-2xl p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 mx-4">
            <Text className="text-base font-semibold text-red-700 dark:text-red-300 mb-1">
              Unable to load profile
            </Text>
            <Text className="text-sm text-red-600 dark:text-red-200 mb-3">
              {(error as Error)?.message || "Something went wrong."}
            </Text>
            <Text
              className="text-sm font-semibold text-blue-600 dark:text-blue-300"
              onPress={() => {
                refetch();
                Toast.show({
                  type: "info",
                  text1: "Refreshing profile",
                  text2: "Trying again…",
                });
              }}
            >
              Tap to retry
            </Text>
          </View>
        ) : !account ? (
          <View className="rounded-2xl p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 mx-4">
            <Text className="text-base font-semibold text-slate-900 dark:text-white mb-1">
              Profile unavailable
            </Text>
            <Text className="text-sm text-slate-600 dark:text-slate-300">
              We couldn't find profile details for this account yet. Pull to
              refresh or try again later.
            </Text>
          </View>
        ) : (
          <>
            {/* Profile Header (includes bio) */}
            <ProfileHeader
              account={account}
              onAvatarPress={handleFollowersPress}
              showBackButton={true}
              onBackPress={() => navigation.goBack()}
            />

            {/* Stats */}
            <View className="px-4 mt-3">
              <ProfileStats
                followers={followerCount}
                following={followingCount}
                posts={0}
                onFollowersPress={handleFollowersPress}
                onFollowingPress={handleFollowingPress}
              />
            </View>
          </>
        )}
        {isFetching && !isLoading ? (
          <View className="flex-row items-center gap-2 mt-6">
            <ActivityIndicator
              size="small"
              color={isDark ? "#94a3b8" : "#475569"}
            />
            <Text className="text-sm text-slate-500 dark:text-slate-400">
              Updating…
            </Text>
          </View>
        ) : null}
      </ScrollView>
    );
  }
}
