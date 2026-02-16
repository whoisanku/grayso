import React, { memo } from "react";
import { View } from "react-native";
import { Shimmer } from "@/components/ui/Shimmer";

/** Profile page shimmer skeleton — avatar, name, username, stats, bio */
export const ProfileShimmer = memo(function ProfileShimmer() {
  return (
    <View className="items-center px-6 py-8" style={{ gap: 16 }}>
      {/* Avatar */}
      <Shimmer width={88} height={88} borderRadius={44} />

      {/* Name */}
      <Shimmer width={160} height={18} borderRadius={8} />

      {/* Username */}
      <Shimmer width={110} height={13} borderRadius={6} />

      {/* Stats row */}
      <View className="flex-row" style={{ gap: 24, marginTop: 4 }}>
        <View className="items-center" style={{ gap: 6 }}>
          <Shimmer width={36} height={16} borderRadius={6} />
          <Shimmer width={56} height={11} borderRadius={5} />
        </View>
        <View className="items-center" style={{ gap: 6 }}>
          <Shimmer width={36} height={16} borderRadius={6} />
          <Shimmer width={56} height={11} borderRadius={5} />
        </View>
        <View className="items-center" style={{ gap: 6 }}>
          <Shimmer width={36} height={16} borderRadius={6} />
          <Shimmer width={56} height={11} borderRadius={5} />
        </View>
      </View>

      {/* Bio lines */}
      <View className="w-full" style={{ gap: 8, marginTop: 8 }}>
        <Shimmer width="80%" height={12} borderRadius={6} />
        <Shimmer width="55%" height={12} borderRadius={6} />
      </View>

      {/* Edit button */}
      <Shimmer width={140} height={38} borderRadius={19} style={{ marginTop: 8 }} />
    </View>
  );
});
