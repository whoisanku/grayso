import CryptoPolyfill from "./components/CryptoPolyfill";
import "react-native-gesture-handler";
import React from "react";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { StatusBar } from "expo-status-bar";
import { DeSoIdentityProvider } from "react-deso-protocol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { configure, identity } from "deso-protocol";
import { getTransactionSpendingLimits } from "./utils/deso";
import { RootNavigator } from "./navigation/RootNavigator";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "./components/KeyboardProvider";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./state/queryClient";
import { AppThemeProvider } from "./state/theme/AppThemeProvider";
import { AppearanceProvider } from "./state/theme/useAppearance";
import { AppToast } from "./components/ui/Toast";
import { AuthTransitionProvider } from "@/state/auth/AuthTransitionProvider";
import { useAppFonts } from "@/hooks/useAppFonts";

WebBrowser.maybeCompleteAuthSession();

const devLog = (...args: unknown[]) => {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
     
    console.log(...args);
  }
};

const redirectUri = AuthSession.makeRedirectUri({ useProxy: true } as any);

configure({
  redirectURI: redirectUri,
  identityPresenter: async (url) => {
    devLog("Opening auth session with URL:", url);
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
    devLog("Auth session result:", result);
    if (result.type === "success") {
      devLog("Handling redirect URI:", result.url);
      await identity.handleRedirectURI(result.url);
      devLog("Redirect URI handled successfully");
    } else {
      devLog("Auth session was not successful:", result.type);
    }
  },
  storageProvider: AsyncStorage,
  appName: "Starter App",
  spendingLimitOptions: getTransactionSpendingLimits(""),
});

export default function App() {
  const { colorScheme } = useColorScheme();
  const { fontsLoaded } = useAppFonts();

  // Don't render the app until fonts are loaded
  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthTransitionProvider>
        <AppearanceProvider>
          <AppThemeProvider>
            <DeSoIdentityProvider>
              <CryptoPolyfill />
              <SafeAreaProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
                    <StatusBar
                      style={colorScheme === "dark" ? "light" : "dark"}
                    />
                    <NavigationContainer
                      theme={colorScheme === "dark" ? DarkTheme : DefaultTheme}
                    >
                      <RootNavigator />
                    </NavigationContainer>
                  </KeyboardProvider>
                  <AppToast />
                </GestureHandlerRootView>
              </SafeAreaProvider>
            </DeSoIdentityProvider>
          </AppThemeProvider>
        </AppearanceProvider>
      </AuthTransitionProvider>
    </QueryClientProvider>
  );
}
