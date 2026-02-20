import React, { memo } from "react";
import { View } from "react-native";

import { Shimmer } from "@/components/ui/Shimmer";

function NotificationRowShimmer({ withMedia = false }: { withMedia?: boolean }) {
  return (
    <View className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <View className="flex-row items-start gap-3">
        <Shimmer width={40} height={40} borderRadius={20} />
        <Shimmer width={42} height={42} borderRadius={21} />

        <View style={{ flex: 1, gap: 8 }}>
          <View className="flex-row items-start justify-between gap-2">
            <View style={{ flex: 1, gap: 6 }}>
              <Shimmer width="86%" height={13} borderRadius={6} />
              <Shimmer width={120} height={10} borderRadius={5} />
            </View>
            <Shimmer width={14} height={14} borderRadius={7} />
          </View>

          <View className="rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
            {withMedia ? (
              <View style={{ gap: 8 }}>
                <Shimmer width="100%" height={160} borderRadius={10} />
                <Shimmer width="82%" height={11} borderRadius={5} />
              </View>
            ) : (
              <Shimmer width="74%" height={11} borderRadius={5} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export const NotificationsShimmer = memo(function NotificationsShimmer() {
  return (
    <View>
      {Array.from({ length: 6 }).map((_, index) => (
        <NotificationRowShimmer
          key={index}
          withMedia={index === 0 || index === 2 || index === 4}
        />
      ))}
    </View>
  );
});

