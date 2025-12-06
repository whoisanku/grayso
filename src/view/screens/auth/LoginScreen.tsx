import React, { useContext } from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { DeSoIdentityContext } from "react-deso-protocol";
import { identity } from "deso-protocol";
import { useColorScheme } from "nativewind";
import ScreenWrapper from "../../../components/ScreenWrapper";
import AppLogo from "../../../assets/app-logo.svg";

export default function LoginScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";

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
          className="w-full rounded-full bg-[#0085ff] py-4 active:bg-[#006bd1]"
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
