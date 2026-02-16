import React, { useContext, useMemo, useState, useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, Platform } from "react-native";
import { ProfileShimmer } from "../components/ProfileShimmer";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useColorScheme } from "nativewind";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import ScreenWrapper from "@/components/ScreenWrapper";
import { ProfileHeader } from "../components/ProfileHeader";
import { ProfileStats } from "../components/ProfileStats";
import { useAccountProfile } from "../api/useAccountProfile";
import { Toast } from "@/components/ui/Toast";
import { FollowListModal } from "../components/FollowListModal";
import { HomeTabParamList } from "@/navigation/types";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ProfileScreenRouteProp = RouteProp<HomeTabParamList, "Profile">;

export function ProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<ProfileScreenRouteProp>();
  const { currentUser } = useContext(DeSoIdentityContext);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  const [isModalVisible, setModalVisible] = useState(false);
  const [listTab, setListTab] = useState<"followers" | "following">("followers");

  // Get params from route (for other users) or fallback to current user
  const { username, publicKey: routePublicKey } = route.params || {};
  
  // Prioritize route params, then fallback to current user
  const publicKey = routePublicKey || currentUser?.PublicKeyBase58Check;
  
  // Check if viewing own profile
  const isOwnProfile = publicKey === currentUser?.PublicKeyBase58Check;

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

  // Update header title based on username
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

  if (!publicKey) {
    return (
      <ScreenWrapper backgroundColor={isDark ? "#0a0f1a" : "#ffffff"} edges={['top', 'left', 'right']}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-lg font-semibold text-slate-900 dark:text-white mb-2">You are not signed in</Text>
          <Text className="text-base text-center text-slate-500 dark:text-slate-400">
            Sign in to view your profile, followers, and following lists.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={{ 
          paddingBottom: isOwnProfile ? 32 : (32 + 70 + Math.max(insets.bottom, 15))
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
          <ProfileShimmer />
        ) : error ? (
          <View className="rounded-2xl p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 mx-4">
            <Text className="text-base font-semibold text-red-700 dark:text-red-300 mb-1">Unable to load profile</Text>
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
              We couldn't find profile details for this account yet. Pull to refresh or try again later.
            </Text>
          </View>
        ) : (
          <>
            {/* Profile Header (includes bio) */}
            <ProfileHeader 
              account={account} 
              onAvatarPress={handleFollowersPress}
              showBackButton={!isOwnProfile}
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
            <ActivityIndicator size="small" color={isDark ? "#94a3b8" : "#475569"} />
            <Text className="text-sm text-slate-500 dark:text-slate-400">Updating…</Text>
          </View>
        ) : null}
      </ScrollView>
      <FollowListModal
        visible={isModalVisible}
        publicKey={publicKey}
        initialTab={listTab}
        onClose={handleCloseModal}
      />
    </ScreenWrapper>
  );
}
