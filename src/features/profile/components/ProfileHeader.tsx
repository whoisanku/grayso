import React, { useMemo } from "react";
import { View, Text, Platform } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { LinearGradient } from "expo-linear-gradient";
import { type FocusAccount } from "@/lib/focus/graphql";
import { FALLBACK_PROFILE_IMAGE, formatPublicKey, getProfileImageUrl } from "@/utils/deso";

const DEFAULT_BLURHASH = "L5H2EC=PM+yV0g-mq.wG9c010J}I";
const BANNER_BLURHASH = "LGF5]+Yk^6#M@-5c,1J5@[or[Q6.";

const getExtraString = (
  extraData: Record<string, unknown> | null | undefined,
  key: string
) => {
  const value = extraData?.[key];
  return typeof value === "string" && value.trim().length ? value : undefined;
};

type Props = {
  account?: FocusAccount | null;
};

export function ProfileHeader({ account }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const extraData = (account?.extraData as Record<string, unknown> | undefined) ?? undefined;

  const avatarUrl = useMemo(() => {
    return (
      getExtraString(extraData, "LargeProfilePicURL") ||
      getExtraString(extraData, "NFTProfilePictureUrl") ||
      (account?.publicKey ? getProfileImageUrl(account.publicKey) : FALLBACK_PROFILE_IMAGE)
    );
  }, [account?.publicKey, extraData]);

  const bannerUrl = useMemo(() => {
    return getExtraString(extraData, "FeaturedImageURL") || undefined;
  }, [extraData]);

  const displayName =
    getExtraString(extraData, "DisplayName") ||
    account?.username ||
    (account?.publicKey ? formatPublicKey(account.publicKey) : "");

  const username = account?.username;

  const bio =
    account?.description ||
    getExtraString(extraData, "MarkdownDescription") ||
    account?.profile?.description ||
    "";

  // Check if user is verified (placeholder - implement actual verification logic)
  const isVerified = false; // TODO: Implement verification check

  return (
    <View {...(Platform.OS === 'web' ? { accessibilityRole: 'main' as any } : {})} className="w-full">
      {/* Banner */}
      <View 
        className="w-full relative overflow-hidden"
        style={{ height: 150 }}
      >
        {bannerUrl ? (
          <Image
            source={{ uri: bannerUrl }}
            className="w-full h-full"
            contentFit="cover"
            placeholder={BANNER_BLURHASH}
            transition={300}
          />
        ) : (
          <LinearGradient
            colors={
              isDark
                ? ["#1e293b", "#0f172a"]
                : ["#e2e8f0", "#cbd5e1"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="w-full h-full"
          />
        )}
      </View>

      {/* Content Container with padding */}
      <View className="px-4">
        {/* Avatar - positioned to overlap banner */}
        <View 
          className="rounded-full -mt-12 mb-2"
          style={{
            width: 90,
            height: 90,
            borderWidth: 4,
            borderColor: isDark ? "#0a0f1a" : "#ffffff",
            backgroundColor: isDark ? "#0a0f1a" : "#ffffff",
          }}
        >
          <Image
            source={{ uri: avatarUrl }}
            className="w-full h-full rounded-full"
            contentFit="cover"
            placeholder={DEFAULT_BLURHASH}
            transition={300}
          />
        </View>

        {/* Name and Username */}
        <View className="mb-2">
          <View className="flex-row items-center gap-2 mb-0.5">
            <Text 
              className="text-2xl font-bold text-slate-900 dark:text-white" 
              numberOfLines={1}
            >
              {displayName}
            </Text>
            {isVerified && (
              <View
                className="w-5 h-5 rounded-full items-center justify-center"
                style={{
                  backgroundColor: isDark ? "#3b82f6" : "#2563eb",
                }}
              >
                <Feather name="check" size={12} color="#ffffff" />
              </View>
            )}
          </View>
          
          {username ? (
            <Text className="text-base text-slate-500 dark:text-slate-400" numberOfLines={1}>
              @{username}
            </Text>
          ) : null}
        </View>

        {/* Bio Section */}
        {bio ? (
          <View className="mb-0">
            <Text className="text-base leading-relaxed text-slate-700 dark:text-slate-300">
              {bio}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

