import React, { useMemo, useState, useEffect } from "react";
import { View, Text, Platform, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { LinearGradient } from "expo-linear-gradient";
import { type FocusAccount } from "@/lib/focus/graphql";
import {
  FALLBACK_PROFILE_IMAGE,
  formatPublicKey,
  getProfileImageUrl,
} from "@/utils/deso";
import { toPlatformSafeImageUrl } from "@/lib/mediaUrl";
import { ImageGalleryModal } from "@/features/messaging/components/ImageGalleryModal";
import { RichText } from "@/components/ui/RichText";
import { decodeHtmlEntities } from "@/lib/richText";

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
  onAvatarPress?: () => void;
  showBackButton?: boolean;
  onBackPress?: () => void;
};

export function ProfileHeader({
  account,
  onAvatarPress,
  showBackButton = false,
  onBackPress,
}: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  // Image gallery state
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
  const [hasAvatarError, setHasAvatarError] = useState(false);
  const [hasBannerError, setHasBannerError] = useState(false);
  const [isAvatarLoading, setIsAvatarLoading] = useState(true);
  const [isAvatarLoaded, setIsAvatarLoaded] = useState(false);
  const [isBannerLoading, setIsBannerLoading] = useState(true);
  const [isBannerLoaded, setIsBannerLoaded] = useState(false);

  const extraData =
    (account?.extraData as Record<string, unknown> | undefined) ?? undefined;

  const avatarUrl = useMemo(() => {
    const rawUrl =
      getExtraString(extraData, "LargeProfilePicURL") ||
      getExtraString(extraData, "NFTProfilePictureUrl") ||
      (account?.publicKey
        ? getProfileImageUrl(account.publicKey)
        : FALLBACK_PROFILE_IMAGE);
    return toPlatformSafeImageUrl(rawUrl) ?? rawUrl;
  }, [account?.publicKey, extraData]);

  // Reset error state when avatar URL changes
  useEffect(() => {
    setHasAvatarError(false);
    setIsAvatarLoading(true);
    setIsAvatarLoaded(false);
  }, [avatarUrl]);

  const bannerUrl = useMemo(() => {
    const rawUrl = getExtraString(extraData, "FeaturedImageURL") || undefined;
    if (!rawUrl) return undefined;
    return toPlatformSafeImageUrl(rawUrl) ?? rawUrl;
  }, [extraData]);

  useEffect(() => {
    setHasBannerError(false);
    setIsBannerLoading(true);
    setIsBannerLoaded(false);
  }, [bannerUrl]);

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

  const handleBannerPress = () => {
    if (bannerUrl) {
      setGalleryImages([bannerUrl]);
      setGalleryInitialIndex(0);
      setGalleryVisible(true);
    }
  };

  const handleAvatarImagePress = () => {
    setGalleryImages([avatarUrl]);
    setGalleryInitialIndex(0);
    setGalleryVisible(true);
  };

  return (
    <View
      {...(Platform.OS === "web" ? { accessibilityRole: "main" as any } : {})}
      className="w-full"
    >
      {/* Banner */}
      <View className="w-full relative overflow-hidden" style={{ height: 150 }}>
        {bannerUrl && !hasBannerError ? (
          <TouchableOpacity
            onPress={handleBannerPress}
            activeOpacity={0.9}
            className="w-full h-full"
          >
            <Image
              source={{ uri: bannerUrl }}
              contentFit="cover"
              placeholder={BANNER_BLURHASH}
              transition={300}
              cachePolicy="memory-disk"
              recyclingKey={bannerUrl}
              style={[
                {
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                },
                Platform.OS === "web"
                  ? { display: isBannerLoaded ? "flex" : "none" }
                  : { opacity: isBannerLoaded ? 1 : 0 },
              ]}
              onLoadStart={() => {
                setIsBannerLoading(true);
                setIsBannerLoaded(false);
              }}
              onLoad={() => setIsBannerLoaded(true)}
              onLoadEnd={() => setIsBannerLoading(false)}
              onError={() => {
                setHasBannerError(true);
                setIsBannerLoading(false);
                setIsBannerLoaded(false);
              }}
            />
            {isBannerLoading && (
              <LinearGradient
                colors={
                  isDark ? ["#1e293b", "#0f172a"] : ["#e2e8f0", "#cbd5e1"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0"
              />
            )}
          </TouchableOpacity>
        ) : (
          <LinearGradient
            colors={isDark ? ["#1e293b", "#0f172a"] : ["#e2e8f0", "#cbd5e1"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="w-full h-full"
          />
        )}

        {/* Back Button Overlay - Bluesky style */}
        {showBackButton && onBackPress && (
          <TouchableOpacity
            onPress={onBackPress}
            activeOpacity={0.7}
            style={{
              position: "absolute",
              top: Platform.OS === "ios" ? 50 : 16,
              left: 16,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="arrow-left" size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content Container with padding */}
      <View className="px-4">
        {/* Avatar - positioned to overlap banner */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleAvatarImagePress}
          onLongPress={onAvatarPress}
          className="rounded-full -mt-12 mb-2 items-center justify-center overflow-hidden"
          style={{
            width: 90,
            height: 90,
            borderWidth: 4,
            borderColor: isDark ? "#0a0f1a" : "#ffffff",
            backgroundColor: isDark ? "#0a0f1a" : "#ffffff",
          }}
        >
          {!hasAvatarError ? (
            <Image
              source={{ uri: avatarUrl }}
              style={[
                { width: '100%', height: '100%', borderRadius: 45 },
                Platform.OS === "web"
                  ? { display: isAvatarLoaded ? "flex" : "none" }
                  : { opacity: isAvatarLoaded ? 1 : 0 },
              ]}
              contentFit="cover"
              placeholder={DEFAULT_BLURHASH}
              transition={300}
              cachePolicy="memory-disk"
              recyclingKey={avatarUrl}
              onLoadStart={() => {
                setIsAvatarLoading(true);
                setIsAvatarLoaded(false);
              }}
              onLoad={() => setIsAvatarLoaded(true)}
              onLoadEnd={() => setIsAvatarLoading(false)}
              onError={() => {
                setHasAvatarError(true);
                setIsAvatarLoading(false);
                setIsAvatarLoaded(false);
              }}
            />
          ) : (
            <View className="w-full h-full items-center justify-center bg-slate-200 dark:bg-slate-800">
              <Text className="text-4xl font-bold text-slate-500 dark:text-slate-400">
                {(displayName || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {isAvatarLoading && (
            <View className="absolute inset-0 rounded-full bg-slate-200 dark:bg-slate-800" />
          )}
        </TouchableOpacity>

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
            <Text
              className="text-base text-slate-500 dark:text-slate-400"
              numberOfLines={1}
            >
              @{username}
            </Text>
          ) : null}
        </View>

        {/* Bio Section */}
        {bio ? (
          <View className="mb-0">
            <RichText
              text={decodeHtmlEntities(bio)}
              textClassName="text-base leading-relaxed text-slate-700 dark:text-slate-300"
            />
          </View>
        ) : null}
      </View>

      {/* Fullscreen Image Gallery Modal */}
      <ImageGalleryModal
        visible={galleryVisible}
        images={galleryImages}
        initialIndex={galleryInitialIndex}
        onClose={() => setGalleryVisible(false)}
      />
    </View>
  );
}
