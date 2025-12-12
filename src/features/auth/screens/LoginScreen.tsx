import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { identity } from "deso-protocol";
import ScreenWrapper from "../../../components/ScreenWrapper";
import AppLogo from "../../../assets/app-logo.svg";
import { useAccentColor } from "../../../state/theme/useAccentColor";
import {
  CENTER_CONTENT_MAX_WIDTH,
  useLayoutBreakpoints,
} from "../../../alf/breakpoints";
import { Toast } from "../../../components/ui/Toast";
import { useAuthTransition } from "@/state/auth/AuthTransitionProvider";

export function LoginScreen() {
  const { isDark } = useAccentColor();
  const { isDesktop } = useLayoutBreakpoints();
  const isWebDesktop = Platform.OS === "web" && isDesktop;
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { startAuthTransition, endAuthTransition } = useAuthTransition();

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      startAuthTransition("login");
      await identity.login();
      // Success handled by DeSoIdentityProvider
    } catch (error: any) {
      console.error("[LoginScreen] Login error:", error);
      
      // Check if user canceled/rejected
      if (error?.message?.includes("cancel") || error?.message?.includes("reject")) {
        Toast.show({
          type: "info",
          text1: "Login cancelled",
          text2: "You can try again anytime",
        });
      } else {
        Toast.show({
          type: "error",
          text1: "Login failed",
          text2: error?.message || "Please try again",
        });
      }
    } finally {
      setIsLoggingIn(false);
      endAuthTransition();
    }
  };

  return (
    <ScreenWrapper
      backgroundColor={isDark ? "#0a0f1a" : "#ffffff"}
      edges={["top", "left", "right", "bottom"]}
    >
      <View className="flex-1 items-center justify-center px-8">
        {/* Centered content container with max-width for desktop */}
        <View
          style={isWebDesktop ? styles.desktopContent : styles.mobileContent}
        >
          <View className="mb-12 h-24 w-24 self-center overflow-hidden rounded-3xl shadow-xl">
            <AppLogo width="100%" height="100%" />
          </View>

          <Text className="mb-2 text-center text-3xl font-bold text-slate-900 dark:text-white">
            Welcome to Social App
          </Text>
          <Text className="mb-12 text-center text-base text-slate-500 dark:text-slate-400">
            The decentralized social network.
          </Text>

          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoggingIn}
            className="w-full rounded-full py-4"
            style={{
              backgroundColor: isLoggingIn ? "#94a3b8" : "#2563eb",
              shadowColor: "#1d4ed8",
              shadowOpacity: isDark ? 0.15 : 0.25,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 4,
              opacity: isLoggingIn ? 0.7 : 1,
            }}
            activeOpacity={0.9}
          >
            {isLoggingIn ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-center text-lg font-bold text-white">
                Log in / Sign up
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  desktopContent: {
    width: "100%",
    maxWidth: CENTER_CONTENT_MAX_WIDTH,
    alignItems: "stretch",
  },
  mobileContent: {
    width: "100%",
    alignItems: "stretch",
  },
});
