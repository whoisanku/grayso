import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useColorScheme } from "nativewind";

import { useWalletSwitcher } from "@/features/auth/hooks/useWalletSwitcher";
import { toPlatformSafeImageUrl } from "@/lib/mediaUrl";

type AvatarStackProps = {
  maxVisible?: number;
  size?: number;
};

const DEFAULT_AVATAR_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";

export function AvatarStack({ maxVisible = 5, size = 28 }: AvatarStackProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { accounts } = useWalletSwitcher();

  // Filter out current account and limit to maxVisible
  const alternateAccounts = accounts
    .filter((account) => !account.isCurrent)
    .slice(0, maxVisible);

  if (alternateAccounts.length === 0) {
    return null;
  }

  return (
    <View className="flex-row items-center" style={{ marginRight: 8 }}>
      {alternateAccounts.map((account, index) => (
        <View
          key={account.publicKey}
          style={{
            marginLeft: index > 0 ? -8 : 0,
            zIndex: alternateAccounts.length - index,
          }}
        >
          {account.avatarUrl ? (
            <Image
              source={{ uri: toPlatformSafeImageUrl(account.avatarUrl) ?? account.avatarUrl }}
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: 2,
                borderColor: isDark ? "#0f172a" : "#ffffff",
              }}
              placeholder={{ blurhash: DEFAULT_AVATAR_BLURHASH }}
              placeholderContentFit="cover"
              transition={200}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View
              style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                borderWidth: 2,
                borderColor: isDark ? "#0f172a" : "#ffffff",
                backgroundColor: isDark ? "#1e293b" : "#e2e8f0",
                alignItems: "center",
                justifyContent: "center",
              }}
            />
          )}
        </View>
      ))}
    </View>
  );
}
