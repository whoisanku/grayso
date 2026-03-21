import React from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UserAvatar } from "@/components/UserAvatar";
import { getValidHttpUrl, toPlatformSafeImageUrl } from "@/lib/mediaUrl";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { getBorderColor } from "@/theme/borders";
import { getProfileImageUrl } from "@/utils/deso";

export function PostThreadReplyPrompt({
  onPress,
}: {
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { currentUser } = React.useContext(DeSoIdentityContext);
  const { isDark } = useAccentColor();
  const isDesktopWeb = Platform.OS === "web";

  const avatarUri = React.useMemo(() => {
    const publicKey = currentUser?.PublicKeyBase58Check;
    if (!publicKey) {
      return null;
    }

    const raw = getValidHttpUrl(getProfileImageUrl(publicKey));
    if (!raw) {
      return null;
    }

    return toPlatformSafeImageUrl(raw) ?? raw;
  }, [currentUser?.PublicKeyBase58Check]);

  const avatarName =
    currentUser?.ProfileEntryResponse?.Username ||
    currentUser?.PublicKeyBase58Check ||
    "You";

  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 bottom-0">
      <LinearGradient
        colors={
          isDark
            ? ["rgba(10,15,26,0)", "rgba(10,15,26,0.92)"]
            : ["rgba(255,255,255,0)", "rgba(255,255,255,0.96)"]
        }
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ height: 32 }}
      />

      <View
        className="px-3"
        style={{
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 10),
          backgroundColor: isDark ? "#0a0f1a" : "#ffffff",
        }}
      >
        <View
          className="w-full self-center"
          style={{ maxWidth: isDesktopWeb ? 720 : undefined }}
        >
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="Write your reply"
            style={({ pressed }) => ({
              opacity: pressed ? 0.9 : 1,
              ...(Platform.OS === "web"
                ? ({
                    cursor: "pointer",
                  } as const)
                : null),
            })}
          >
            <View
              className="flex-row items-center gap-3 rounded-full border px-3 py-3"
              style={{
                borderColor: getBorderColor(isDark, "subtle"),
                backgroundColor: isDark ? "#162133" : "#f8fafc",
              }}
            >
              <UserAvatar uri={avatarUri} name={avatarName} size={28} />
              <Text className="flex-1 text-[16px] text-slate-500 dark:text-slate-400">
                Write your reply
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
