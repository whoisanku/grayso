import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

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
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
};

export function ProfileStats({
  followers = 0,
  following = 0,
  onFollowersPress,
  onFollowingPress,
}: StatProps) {
  const followerCount = followers ?? 0;
  const followingCount = following ?? 0;

  return (
    <View
      className="flex-row flex-wrap items-center gap-3"
      pointerEvents="box-none"
    >
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
          <Text className="ml-1 text-base text-slate-500 dark:text-slate-400">
            {pluralize(followerCount, "follower", "followers")}
          </Text>
        </TouchableOpacity>
      ) : (
        <View className="flex-row items-center">
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {formatCount(followerCount)}
          </Text>
          <Text className="ml-1 text-base text-slate-500 dark:text-slate-400">
            {pluralize(followerCount, "follower", "followers")}
          </Text>
        </View>
      )}

      <View className="h-1 w-1 rounded-full bg-slate-400 dark:bg-slate-600" />

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
          <Text className="ml-1 text-base text-slate-500 dark:text-slate-400">
            following
          </Text>
        </TouchableOpacity>
      ) : (
        <View className="flex-row items-center">
          <Text className="text-base font-semibold text-slate-900 dark:text-white">
            {formatCount(followingCount)}
          </Text>
          <Text className="ml-1 text-base text-slate-500 dark:text-slate-400">
            following
          </Text>
        </View>
      )}
    </View>
  );
}
