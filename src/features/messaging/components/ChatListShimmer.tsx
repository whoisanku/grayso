import React, { memo } from "react";
import { View } from "react-native";
import { Shimmer } from "@/components/ui/Shimmer";

function SingleChatRowShimmer() {
  return (
    <View className="flex-row items-center px-4 py-3.5" style={{ gap: 12 }}>
      {/* Avatar */}
      <Shimmer width={52} height={52} borderRadius={26} />

      {/* Name + preview */}
      <View className="flex-1" style={{ gap: 8 }}>
        <View className="flex-row items-center justify-between">
          <Shimmer width={120} height={13} borderRadius={6} />
          <Shimmer width={40} height={10} borderRadius={5} />
        </View>
        <Shimmer width="75%" height={11} borderRadius={5} />
      </View>
    </View>
  );
}

/** Shows 7 shimmer chat rows — drop-in replacement for ActivityIndicator */
export const ChatListShimmer = memo(function ChatListShimmer() {
  return (
    <View>
      {Array.from({ length: 7 }).map((_, i) => (
        <SingleChatRowShimmer key={i} />
      ))}
    </View>
  );
});
