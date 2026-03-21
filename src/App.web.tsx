import CryptoPolyfill from "./components/CryptoPolyfill";
import "react-native-gesture-handler";
import React from "react";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  LinkingOptions,
  getStateFromPath as getNavigationStateFromPath,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { StatusBar } from "expo-status-bar";
import { DeSoIdentityProvider } from "react-deso-protocol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configure } from "deso-protocol";
import { getTransactionSpendingLimits } from "./utils/deso";
import { RootNavigator } from "./navigation/RootNavigator";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./state/queryClient";
import { AppThemeProvider } from "./state/theme/AppThemeProvider";
import { AppearanceProvider } from "./state/theme/useAppearance";
import { RootStackParamList } from "./navigation/types";
import { AppToast } from "./components/ui/Toast";
import { AuthTransitionProvider } from "@/state/auth/AuthTransitionProvider";
import { DrawerOpenProvider, DrawerSwipeDisabledProvider } from "@/state/shell";

// Web specific config if needed
configure({
  storageProvider: AsyncStorage,
  appName: "Grayso",
  spendingLimitOptions: getTransactionSpendingLimits(""),
});

// Web URL linking configuration - allows navigation via URLs like /profile, /settings
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [window.location.origin, "grayso://"],
  getStateFromPath(path, options) {
    const candidateUrl = new URL(
      path.startsWith("/") ? path : `/${path}`,
      window.location.origin,
    );
    const legacyPostThreadHash = candidateUrl.searchParams.get("postHash")?.trim();

    if (
      candidateUrl.pathname.toLowerCase() === "/postthread" &&
      legacyPostThreadHash
    ) {
      return getNavigationStateFromPath(
        `/post/${legacyPostThreadHash}`,
        options,
      );
    }

    return getNavigationStateFromPath(path, options);
  },
  config: {
    screens: {
      Main: {
        initialRouteName: "Feed",
        screens: {
          Feed: "feed",
          Messages: "messages",
          Notifications: "notifications",
          Profile: "u/:username?",
        },
      },
      Settings: "settings",
      Composer: "compose",
      Conversation: "conversation/:threadPublicKey",
      NewChat: "new-chat",
      PostThread: "post/:postHash",
      Login: "login",
    },
  },
};

export default function App() {
  const { colorScheme } = useColorScheme();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthTransitionProvider>
        <AppearanceProvider>
          <AppThemeProvider>
            <DeSoIdentityProvider>
              <CryptoPolyfill />
              <SafeAreaProvider>
                <DrawerOpenProvider>
                  <DrawerSwipeDisabledProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <StatusBar
                        style={colorScheme === "dark" ? "light" : "dark"}
                      />
                      <NavigationContainer
                        linking={linking}
                        theme={
                          colorScheme === "dark" ? DarkTheme : DefaultTheme
                        }
                        documentTitle={{ formatter: () => "Grayso" }}
                      >
                        <RootNavigator />
                      </NavigationContainer>
                      <AppToast />
                    </GestureHandlerRootView>
                  </DrawerSwipeDisabledProvider>
                </DrawerOpenProvider>
              </SafeAreaProvider>
            </DeSoIdentityProvider>
          </AppThemeProvider>
        </AppearanceProvider>
      </AuthTransitionProvider>
    </QueryClientProvider>
  );
}
