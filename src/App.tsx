import CryptoPolyfill from "react-native-webview-crypto";
import "react-native-gesture-handler";
import React from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";
import { StatusBar } from "expo-status-bar";
import { DeSoIdentityProvider } from "react-deso-protocol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { configure, identity } from "deso-protocol";
import { getTransactionSpendingLimits } from "./utils/deso";
import RootNavigator from "./navigation/RootNavigator";
import { GestureHandlerRootView } from "react-native-gesture-handler";

WebBrowser.maybeCompleteAuthSession();

const redirectUri = AuthSession.makeRedirectUri({ useProxy: true } as any);

configure({
  redirectURI: redirectUri,
  identityPresenter: async (url) => {
    console.log("Opening auth session with URL:", url);
    const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
    console.log("Auth session result:", result);
    if (result.type === "success") {
      console.log("Handling redirect URI:", result.url);
      await identity.handleRedirectURI(result.url);
      console.log("Redirect URI handled successfully");
    } else {
      console.log("Auth session was not successful:", result.type);
    }
  },
  storageProvider: AsyncStorage,
  appName: "Starter App",
  spendingLimitOptions: getTransactionSpendingLimits(""),
});

export default function App() {
  const { colorScheme } = useColorScheme();

  return (
    <DeSoIdentityProvider>
      <CryptoPolyfill />
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
          <NavigationContainer theme={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <RootNavigator />
          </NavigationContainer>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </DeSoIdentityProvider>
  );
}
