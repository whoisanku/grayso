import React from "react";
import { View, Text, TouchableOpacity, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { ChatIcon } from "@/components/icons/ChatIcon";
import { useAccentColor } from "@/state/theme/useAccentColor";
import { getBorderColor } from "@/theme/borders";
import * as Haptics from "expo-haptics";

type ProfileActionsProps = {
  isOwnProfile?: boolean;
  onEditPress?: () => void;
  onSharePress?: () => void;
  onMorePress?: () => void;
};

export function ProfileActions({
  isOwnProfile = true,
  onEditPress,
  onSharePress,
  onMorePress,
}: ProfileActionsProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { accentColor, accentStrong } = useAccentColor();

  const handlePress = (callback?: () => void) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    callback?.();
  };

  if (isOwnProfile) {
    return (
      <View className="flex-row gap-3 w-full">
        {/* Edit Profile - Primary Action */}
        <TouchableOpacity
          onPress={() => handlePress(onEditPress)}
          activeOpacity={0.7}
          className="flex-1 rounded-full px-4 py-3.5 flex-row items-center justify-center gap-2"
          style={{
            backgroundColor: accentColor,
            shadowColor: accentStrong,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <Feather name="edit-2" size={18} color="#ffffff" />
          <Text className="text-base font-bold text-white">
            Edit Profile
          </Text>
        </TouchableOpacity>

        {/* Share Profile */}
        <TouchableOpacity
          onPress={() => handlePress(onSharePress)}
          activeOpacity={0.7}
          className="rounded-full px-4 py-3.5 items-center justify-center"
          style={{
            backgroundColor: isDark ? "rgba(30, 41, 59, 0.6)" : "rgba(241, 245, 249, 0.9)",
            borderWidth: 1,
            borderColor: getBorderColor(isDark, "subtle"),
          }}
        >
          <Feather name="share-2" size={18} color={isDark ? "#94a3b8" : "#475569"} />
        </TouchableOpacity>

        {/* More Options */}
        <TouchableOpacity
          onPress={() => handlePress(onMorePress)}
          activeOpacity={0.7}
          className="rounded-full px-4 py-3.5 items-center justify-center"
          style={{
            backgroundColor: isDark ? "rgba(30, 41, 59, 0.6)" : "rgba(241, 245, 249, 0.9)",
            borderWidth: 1,
            borderColor: getBorderColor(isDark, "subtle"),
          }}
        >
          <Feather name="more-horizontal" size={18} color={isDark ? "#94a3b8" : "#475569"} />
        </TouchableOpacity>
      </View>
    );
  }

  // For other users' profiles
  return (
    <View className="flex-row gap-3 w-full">
      {/* Follow/Following Button */}
      <TouchableOpacity
        onPress={() => handlePress(onEditPress)}
        activeOpacity={0.7}
        className="flex-1 rounded-full px-4 py-3.5 flex-row items-center justify-center gap-2"
        style={{
          backgroundColor: accentColor,
          shadowColor: accentStrong,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Feather name="user-plus" size={18} color="#ffffff" />
        <Text className="text-base font-bold text-white">
          Follow
        </Text>
      </TouchableOpacity>

      {/* Message */}
      <TouchableOpacity
        onPress={() => handlePress(onSharePress)}
        activeOpacity={0.7}
        className="rounded-full px-4 py-3.5 flex-row items-center justify-center gap-2"
        style={{
          backgroundColor: isDark ? "rgba(30, 41, 59, 0.6)" : "rgba(241, 245, 249, 0.9)",
          borderWidth: 1,
          borderColor: getBorderColor(isDark, "subtle"),
        }}
      >
        <ChatIcon
          size={18}
          color={isDark ? "#94a3b8" : "#475569"}
          strokeWidth={1.7}
        />
      </TouchableOpacity>

      {/* More */}
      <TouchableOpacity
        onPress={() => handlePress(onMorePress)}
        activeOpacity={0.7}
        className="rounded-full px-4 py-3.5 items-center justify-center"
        style={{
          backgroundColor: isDark ? "rgba(30, 41, 59, 0.6)" : "rgba(241, 245, 249, 0.9)",
          borderWidth: 1,
          borderColor: getBorderColor(isDark, "subtle"),
        }}
      >
        <Feather name="more-horizontal" size={18} color={isDark ? "#94a3b8" : "#475569"} />
      </TouchableOpacity>
    </View>
  );
}
