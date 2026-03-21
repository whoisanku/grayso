import React from "react";
import { View } from "react-native";

import { Shimmer } from "@/components/ui/Shimmer";

export function PostThreadRepliesShimmer({
  depth = 0,
  count = 2,
}: {
  depth?: number;
  count?: number;
}) {
  const indent = Math.min(depth, 3) * 28;

  return (
    <View style={{ paddingLeft: indent }}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={`thread-reply-shimmer-${depth}-${index}`}
          className={
            depth === 0
              ? "border-b border-slate-200/80 px-4 py-3 dark:border-slate-800/80"
              : "px-0 py-2"
          }
        >
          <View className="flex-row items-start">
            <Shimmer width={24} height={24} borderRadius={12} />

            <View className="ml-2 flex-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Shimmer width={index % 2 === 0 ? "24%" : "30%"} height={12} />
                <Shimmer width={index % 2 === 0 ? "22%" : "18%"} height={11} />
                <Shimmer width={28} height={11} />
              </View>

              <View className="mt-2 gap-2">
                <Shimmer width="92%" height={12} />
                <Shimmer width={index % 2 === 0 ? "72%" : "64%"} height={12} />
              </View>

              <View className="mt-3 flex-row items-center gap-6">
                <Shimmer width={20} height={14} borderRadius={999} />
                <Shimmer width={18} height={14} borderRadius={999} />
                <Shimmer width={18} height={14} borderRadius={999} />
              </View>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
