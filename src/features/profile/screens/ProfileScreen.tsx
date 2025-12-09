import React, { useContext } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { DeSoIdentityContext } from "react-deso-protocol";
import { useColorScheme } from "nativewind";
import ScreenWrapper from "../../../components/ScreenWrapper";
import { Feather } from "@expo/vector-icons";
import { buildProfilePictureUrl } from "deso-protocol";
import { FALLBACK_PROFILE_IMAGE } from "../../../utils/deso";
import { identity } from "deso-protocol";

export function ProfileScreen() {
  const { currentUser } = useContext(DeSoIdentityContext);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

  const avatarUri = currentUser?.PublicKeyBase58Check
    ? buildProfilePictureUrl(currentUser.PublicKeyBase58Check)
    : FALLBACK_PROFILE_IMAGE;

  return (
    <ScreenWrapper
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
      edges={['top', 'left', 'right']}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="items-center mb-8">
           <View className="h-24 w-24 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-4">
              <Image
                source={{ uri: avatarUri }}
                className="h-full w-full"
                resizeMode="cover"
              />
           </View>
           <Text className="text-xl font-bold text-slate-900 dark:text-white">
             {currentUser?.ProfileEntryResponse?.Username || "Anonymous"}
           </Text>
           <Text className="text-sm text-slate-500 dark:text-slate-400 mt-1">
             {currentUser?.PublicKeyBase58Check}
           </Text>
        </View>

        <TouchableOpacity
          onPress={() => identity.logout()}
          className="flex-row items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 py-3 border border-red-200 dark:border-red-900/50"
        >
          <Feather name="log-out" size={18} color={isDark ? "#fca5a5" : "#ef4444"} />
          <Text className="ml-2 font-semibold text-red-600 dark:text-red-300">
            Log Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
}
