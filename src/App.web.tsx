import CryptoPolyfill from "./components/CryptoPolyfill";
import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { NavigationContainer, DarkTheme, DefaultTheme, LinkingOptions } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { StatusBar } from "expo-status-bar";
import { DeSoIdentityProvider } from "react-deso-protocol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configure } from "deso-protocol";
import { getTransactionSpendingLimits } from "./utils/deso";
import RootNavigator from "./navigation/RootNavigator";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./state/queryClient";
import { AppThemeProvider } from "./state/theme/AppThemeProvider";
import { AppearanceProvider } from "./state/theme/useAppearance";
import { RootStackParamList } from "./navigation/types";

// Web specific config if needed
configure({
  storageProvider: AsyncStorage,
  appName: "Grayso",
  spendingLimitOptions: getTransactionSpendingLimits(""),
});

// Web URL linking configuration - allows navigation via URLs like /profile, /settings
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [window.location.origin, 'grayso://'],
  config: {
    screens: {
      Main: {
        screens: {
          Messages: '',
          Profile: 'profile',
        },
      },
      Settings: 'settings',
      Composer: 'compose',
      Conversation: 'conversation/:threadPublicKey',
      NewChat: 'new-chat',
      Login: 'login',
    },
  },
};

export default function App() {
  const { colorScheme } = useColorScheme();

  // Set document title
  useEffect(() => {
    document.title = "Grayso";
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
        <AppThemeProvider>
          <DeSoIdentityProvider>
            <CryptoPolyfill />
            <SafeAreaProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                  <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
                  <NavigationContainer
                    linking={linking}
                    theme={colorScheme === "dark" ? DarkTheme : DefaultTheme}
                    documentTitle={{ formatter: () => "Grayso" }}
                  >
                    <RootNavigator />
                  </NavigationContainer>
              </GestureHandlerRootView>
            </SafeAreaProvider>
          </DeSoIdentityProvider>
        </AppThemeProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  );
}

