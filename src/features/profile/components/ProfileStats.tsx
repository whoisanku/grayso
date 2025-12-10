import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useColorScheme } from "nativewind";

const formatCount = (value?: number | null) => {
  if (value === null || value === undefined) return "0";
  try {
    return new Intl.NumberFormat("en", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch (error) {
    return String(value);
  }
};

const pluralize = (count: number, singular: string, plural: string) => {
  return count === 1 ? singular : plural;
};

type StatProps = {
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
};

export function ProfileStats({ 
  followers = 0, 
  following = 0,
  posts = 0,
  onFollowersPress,
  onFollowingPress 
}: StatProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const followerCount = followers ?? 0;
  const followingCount = following ?? 0;
  const postCount = posts ?? 0;

  return (
    <View 
      className="flex-row items-center gap-3 flex-wrap"
      pointerEvents="box-none"
    >
      {/* Followers */}
      {onFollowersPress ? (
        <TouchableOpacity
          testID="profileStatsFollowers"
          onPress={onFollowersPress}
          activeOpacity={0.7}
          className="flex-row items-center"
        >
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {formatCount(followerCount)}
          </Text>
          <Text className="text-base text-slate-500 dark:text-slate-400 ml-1">
            {pluralize(followerCount, "follower", "followers")}
          </Text>
        </TouchableOpacity>
      ) : (
        <View className="flex-row items-center">
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {formatCount(followerCount)}
          </Text>
          <Text className="text-base text-slate-500 dark:text-slate-400 ml-1">
            {pluralize(followerCount, "follower", "followers")}
          </Text>
        </View>
      )}

      {/* Separator */}
      <Text className="text-base text-slate-400 dark:text-slate-600">·</Text>

      {/* Following */}
      {onFollowingPress ? (
        <TouchableOpacity
          testID="profileStatsFollowing"
          onPress={onFollowingPress}
          activeOpacity={0.7}
          className="flex-row items-center"
        >
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {formatCount(followingCount)}
          </Text>
          <Text className="text-base text-slate-500 dark:text-slate-400 ml-1">
            following
          </Text>
        </TouchableOpacity>
      ) : (
        <View className="flex-row items-center">
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {formatCount(followingCount)}
          </Text>
          <Text className="text-base text-slate-500 dark:text-slate-400 ml-1">
            following
          </Text>
        </View>
      )}

      {/* Separator */}
      <Text className="text-base text-slate-400 dark:text-slate-600">·</Text>

      {/* Posts */}
      <View className="flex-row items-center">
        <Text className="text-base font-semibold text-slate-900 dark:text-white">
          {formatCount(postCount)}
        </Text>
        <Text className="text-base text-slate-500 dark:text-slate-400 ml-1">
          {pluralize(postCount, "post", "posts")}
        </Text>
      </View>
    </View>
  );
}
