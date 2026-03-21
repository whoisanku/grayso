import React, { memo } from "react";
import { View } from "react-native";

import { Shimmer } from "@/components/ui/Shimmer";

/** Profile page shimmer skeleton - banner, avatar, name, username, stats, bio */
export const ProfileShimmer = memo(function ProfileShimmer() {
  return (
    <View className="w-full">
      <Shimmer width="100%" height={150} borderRadius={0} />

      <View className="px-4">
        <View className="-mt-12 mb-3">
          <Shimmer width={90} height={90} borderRadius={45} />
        </View>

        <View style={{ gap: 10 }}>
          <Shimmer width={176} height={24} borderRadius={10} />
          <Shimmer width={120} height={16} borderRadius={8} />
        </View>

        <View className="mt-4 flex-row items-center" style={{ gap: 18 }}>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Shimmer width={34} height={16} borderRadius={6} />
            <Shimmer width={72} height={13} borderRadius={6} />
          </View>
          <View className="flex-row items-center" style={{ gap: 6 }}>
            <Shimmer width={34} height={16} borderRadius={6} />
            <Shimmer width={72} height={13} borderRadius={6} />
          </View>
        </View>

        <View className="mt-4 w-full" style={{ gap: 8 }}>
          <Shimmer width="92%" height={14} borderRadius={7} />
          <Shimmer width="78%" height={14} borderRadius={7} />
          <Shimmer width="64%" height={14} borderRadius={7} />
        </View>
      </View>

      <View className="mt-4 border-b border-slate-200/80 dark:border-slate-800/80" />
    </View>
  );
});
