import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { identity } from "deso-protocol";
import ScreenWrapper from "../../../components/ScreenWrapper";
import AppLogo from "../../../assets/app-logo.svg";
import { useAccentColor } from "../../../state/theme/useAccentColor";

export default function LoginScreen() {
  const { isDark } = useAccentColor();

  return (
    <ScreenWrapper
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-12 h-24 w-24 overflow-hidden rounded-3xl shadow-xl">
           <AppLogo width="100%" height="100%" />
        </View>

        <Text className="mb-2 text-center text-3xl font-bold text-slate-900 dark:text-white">
          Welcome to Social App
        </Text>
        <Text className="mb-12 text-center text-base text-slate-500 dark:text-slate-400">
          The decentralized social network.
        </Text>

        <TouchableOpacity
          onPress={() => identity.login()}
          className="w-full rounded-full py-4"
          style={{
            backgroundColor: "#2563eb",
            shadowColor: "#1d4ed8",
            shadowOpacity: isDark ? 0.15 : 0.25,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
          }}
          activeOpacity={0.9}
        >
          <Text className="text-center text-lg font-bold text-white">
            Log in / Sign up
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}
