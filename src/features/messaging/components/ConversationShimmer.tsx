import React, { memo } from "react";
import { View } from "react-native";
import { Shimmer } from "@/components/ui/Shimmer";

function BubbleShimmer({
  isMe, width: w,
}: {
  isMe: boolean;
  width: number;
}) {
  return (
    <View
      style={{
        alignSelf: isMe ? "flex-end" : "flex-start",
        paddingHorizontal: 16,
        marginBottom: 10,
      }}
    >
      <Shimmer width={w} height={38} borderRadius={18} />
    </View>
  );
}

/** Conversation shimmer — alternating message bubbles */
export const ConversationShimmer = memo(function ConversationShimmer() {
  return (
    <View className="flex-1 justify-end pb-4">
      <BubbleShimmer isMe={false} width={200} />
      <BubbleShimmer isMe={true} width={160} />
      <BubbleShimmer isMe={false} width={240} />
      <BubbleShimmer isMe={false} width={140} />
      <BubbleShimmer isMe={true} width={220} />
      <BubbleShimmer isMe={true} width={100} />
    </View>
  );
});
