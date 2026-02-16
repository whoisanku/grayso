import React, { memo } from "react";
import { View } from "react-native";
import { Shimmer } from "@/components/ui/Shimmer";

/**
 * A single shimmer post skeleton that mirrors the real FeedCard layout exactly:
 * - 44px avatar circle
 * - ml-3 content area with name + handle row, timestamp right-aligned
 * - Body text lines
 * - Action bar: reply · repost · like spread with justify-between
 */
function SinglePostShimmer() {
  return (
    <View
      className="border-b border-slate-200 dark:border-slate-800"
      style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 12 }}
    >
      {/* Avatar — matches FeedCard 44×44 circle */}
      <Shimmer width={44} height={44} borderRadius={22} />

      {/* Content column — matches FeedCard ml-3 flex-1 */}
      <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
        {/* Name + handle + timestamp row */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <View style={{ flex: 1, paddingRight: 12, gap: 4 }}>
            {/* Display name */}
            <Shimmer width={110} height={13} borderRadius={6} />
            {/* @handle */}
            <Shimmer width={80} height={11} borderRadius={5} />
          </View>
          {/* Timestamp */}
          <Shimmer width={28} height={11} borderRadius={5} />
        </View>

        {/* Post body text — 2 lines of varying width */}
        <View style={{ gap: 5 }}>
          <Shimmer width="92%" height={13} borderRadius={6} />
          <Shimmer width="60%" height={13} borderRadius={6} />
        </View>

        {/* Action bar — reply · repost · like in justify-between */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Shimmer width={15} height={15} borderRadius={4} />
            <Shimmer width={18} height={10} borderRadius={4} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Shimmer width={15} height={15} borderRadius={4} />
            <Shimmer width={18} height={10} borderRadius={4} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Shimmer width={15} height={15} borderRadius={4} />
            <Shimmer width={18} height={10} borderRadius={4} />
          </View>
        </View>
      </View>
    </View>
  );
}

/** Shows 4 shimmer post skeletons matching the real FeedCard layout */
export const FeedPostShimmer = memo(function FeedPostShimmer() {
  return (
    <View>
      {Array.from({ length: 4 }).map((_, i) => (
        <SinglePostShimmer key={i} />
      ))}
    </View>
  );
});
